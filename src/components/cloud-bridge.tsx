"use client";

import { useEffect, useState } from "react";
import { publishSyncStatus } from "@/components/account-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { entryWriteSchema } from "@/lib/cloud-schema";
import { isCloudConfigured } from "@/lib/cloud-config";
import { LEDGER_EVENT, LEDGER_KEY, parseLedger, saveLedger } from "@/lib/storage";
import { isPermissionDenied } from "@/lib/sync-status";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { isCloudId, syncPlan } from "@/lib/sync";
import { CLEAR_SYNC_KEY } from "@/lib/use-ledger";
import type { LedgerEntry } from "@/lib/types";

const QUEUE_KEY = "kaalbiz.sync.queue.v1";
const BUSINESS_KEY = "kaalbiz.businessId";
const MIGRATION_KEY = "kaalbiz.cloud.migration";
const SYNCED_KEY = "kaalbiz.sync.last";
const SHADOW_KEY = "kaalbiz.sync.shadow.v1";
const FORCE_KEY = "kaalbiz.sync.force";
let applyingRemote = false;

export function CloudBridge() {
  const cloud = isCloudConfigured();
  const [shopName, setShopName] = useState("");
  const [needShop, setNeedShop] = useState(false);
  const [needUpload, setNeedUpload] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backupNote, setBackupNote] = useState<string | null>(null);

  useEffect(() => {
    if (!cloud) {
      publishSyncStatus({ phase: "off", lastSyncedAt: null, email: null });
      return;
    }
    const client = createBrowserSupabase();
    if (!client) return;

    let stopped = false;
    let retryTimer = 0;
    function scheduleRetry() {
      window.clearTimeout(retryTimer);
      retryTimer = window.setTimeout(() => {
        if (!stopped) void refresh();
      }, 15000);
    }
    async function refresh() {
      if (!client || stopped) return;
      if (!navigator.onLine) {
        publishSyncStatus({ phase: "offline", lastSyncedAt: readSynced(), email: null });
        return;
      }
      try {
        const { data, error: userError } = await client.auth.getUser();
        if (userError || !data.user) {
          if (userError && navigator.onLine) {
            noteFailure(userError, null);
            scheduleRetry();
          } else {
            publishSyncStatus({ phase: "signed-out", lastSyncedAt: null, email: null });
            setNeedShop(false);
          }
          return;
        }
        const email = data.user.email ?? null;
        const { data: membership, error: memberError } = await client
          .from("business_members")
          .select("business_id")
          .limit(1);
        if (memberError) {
          noteFailure(memberError, email);
          scheduleRetry();
          return;
        }
        setBackupNote(null);
        const businessId = membership?.[0]?.business_id as string | undefined;
        if (!businessId) {
          setNeedShop(true);
          publishSyncStatus({ phase: "needs-shop", lastSyncedAt: null, email });
          return;
        }
        window.localStorage.setItem(BUSINESS_KEY, businessId);
        setNeedShop(false);
        const migration = window.localStorage.getItem(MIGRATION_KEY);
        if (!migration && parseLedger(window.localStorage.getItem(LEDGER_KEY)).length > 0) {
          setNeedUpload(true);
        }
    const result = await runSync(businessId, email);
        if (result.status === "failed") {
          noteFailure(result.error, email);
          scheduleRetry();
        } else if (result.status === "ok") {
          setBackupNote(null);
        }
      } catch (err) {
        noteFailure(err instanceof Error ? { message: err.message } : null, null);
        scheduleRetry();
      }
    }
    function noteFailure(error: { code?: string; message?: string } | null, email: string | null) {
      publishSyncStatus({ phase: "failed", lastSyncedAt: readSynced(), email });
      setBackupNote(
        isPermissionDenied(error)
          ? "Backup failed, retrying. The database refused access. Paste the grants SQL, then reopen this page. Your records stay on this phone."
          : "Backup failed, retrying. Your records stay on this phone.",
      );
    }

    function onLocalChange() {
      if (applyingRemote) return;
      if (!navigator.onLine) {
        publishSyncStatus({ phase: "offline", lastSyncedAt: readSynced(), email: null });
        setBackupNote(null);
        return;
      }
      const businessId = window.localStorage.getItem(BUSINESS_KEY);
      if (!businessId) return;
      void runSync(businessId, null).then((result) => {
        if (result.status === "failed") noteFailure(result.error, null);
        if (result.status === "ok") setBackupNote(null);
      });
    }

    void refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("offline", onLocalChange);
    window.addEventListener(LEDGER_EVENT, onLocalChange);
    return () => {
      stopped = true;
      window.clearTimeout(retryTimer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", onLocalChange);
      window.removeEventListener(LEDGER_EVENT, onLocalChange);
    };
  }, [cloud]);

  async function createShop() {
    const supabase = createBrowserSupabase();
    const name = shopName.trim();
    if (!supabase || !name) return;
    const { data, error: createError } = await supabase.rpc("create_business", { shop_name: name });
    if (createError || !data) {
      setError("Could not create the shop. Try again.");
      return;
    }
    window.localStorage.setItem(BUSINESS_KEY, String(data));
    setNeedShop(false);
    if (parseLedger(window.localStorage.getItem(LEDGER_KEY)).length > 0) setNeedUpload(true);
    else window.localStorage.setItem(MIGRATION_KEY, "no");
  }

  return (
    <>
      {backupNote ? (
        <div className="border-b border-border bg-card px-4 py-3">
          <p className="text-sm text-destructive">{backupNote}</p>
        </div>
      ) : null}
      {needShop ? (
        <div className="border-b border-border bg-card px-4 py-4">
          <p className="font-semibold">Name your shop</p>
          <p className="mt-1 text-sm text-muted-foreground">This is the business your records will belong to.</p>
          <div className="mt-3 flex gap-2">
            <Input aria-label="Shop name" value={shopName} onChange={(event) => setShopName(event.target.value)} />
            <Button type="button" onClick={() => void createShop()}>
              Create
            </Button>
          </div>
          {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        </div>
      ) : null}
      {needUpload ? (
        <div className="border-b border-border bg-card px-4 py-4">
          <p className="font-semibold">Upload the records on this phone to your account?</p>
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              onClick={() => {
                window.localStorage.setItem(MIGRATION_KEY, "yes");
                window.localStorage.setItem(FORCE_KEY, "1");
                setNeedUpload(false);
                const businessId = window.localStorage.getItem(BUSINESS_KEY);
                if (businessId) void runSync(businessId, null);
              }}
            >
              Yes, upload
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                window.localStorage.setItem(MIGRATION_KEY, "no");
                setNeedUpload(false);
              }}
            >
              No
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}

let syncing = false;
let rerun = false;

async function runSync(
  businessId: string,
  email: string | null,
): Promise<
  { status: "ok" } | { status: "offline" } | { status: "queued" } | { status: "failed"; error: { code?: string; message?: string } | null }
> {
  if (syncing) {
    rerun = true;
    return { status: "queued" };
  }
  syncing = true;
  try {
    let result: Awaited<ReturnType<typeof runSyncOnce>> = { status: "ok" };
    do {
      rerun = false;
      result = await runSyncOnce(businessId, email);
    } while (rerun && result.status === "ok");
    return result;
  } finally {
    syncing = false;
  }
}

async function runSyncOnce(
  businessId: string,
  email: string | null,
): Promise<
  { status: "ok" } | { status: "offline" } | { status: "failed"; error: { code?: string; message?: string } | null }
> {
  const supabase = createBrowserSupabase();
  if (!supabase) return { status: "failed", error: { message: "Cloud backup is off." } };
  if (!navigator.onLine) {
    publishSyncStatus({ phase: "offline", lastSyncedAt: readSynced(), email });
    return { status: "offline" };
  }
  publishSyncStatus({ phase: "syncing", lastSyncedAt: readSynced(), email });
  try {
    const local = syncRows(parseLedger(window.localStorage.getItem(LEDGER_KEY)));
    let shadow = syncRows(readShadow());
    if (shadow.length === 0 && window.localStorage.getItem(MIGRATION_KEY) === "no") {
      shadow = local;
      writeShadow(local);
    }
    const forcePush = window.localStorage.getItem(FORCE_KEY) === "1";
    const clearRemote = Boolean(window.localStorage.getItem(CLEAR_SYNC_KEY));
    const now = new Date().toISOString();
    const leading = syncPlan({ shadow, local, remote: [], now, forcePush });
    await upsertEntries(supabase, businessId, leading.push);
    const { data, error } = await supabase
      .from("entries")
      .select(
        "id,type,amount,currency,date,description,category,counterparty,confidence,notes,recorded_by,phone,location,due_date,agreed_amount,source,is_sample,created_at,updated_at,deleted_at",
      )
      .eq("business_id", businessId);
    if (error) throw error;
    const remote = (data ?? []).map(fromRemote).filter((entry): entry is LedgerEntry => Boolean(entry));
    const fresh = syncRows(parseLedger(window.localStorage.getItem(LEDGER_KEY)));
    const planned = syncPlan({ shadow, local: fresh, remote: syncRows(remote), now, forcePush, clearRemote });
    const already = new Set(leading.push.map((row) => `${row.id}:${row.updatedAt}:${row.deletedAt ?? ""}`));
    await upsertEntries(
      supabase,
      businessId,
      planned.push.filter((row) => !already.has(`${row.id}:${row.updatedAt}:${row.deletedAt ?? ""}`)),
    );
    const afterPush = JSON.stringify(syncRows(parseLedger(window.localStorage.getItem(LEDGER_KEY))));
    if (afterPush !== JSON.stringify(fresh)) {
      rerun = true;
      return { status: "ok" };
    }
    writeLedger(planned.merged);
    writeShadow(planned.merged);
    window.localStorage.removeItem(FORCE_KEY);
    if (clearRemote) window.localStorage.removeItem(CLEAR_SYNC_KEY);
    window.localStorage.removeItem(QUEUE_KEY);
    const synced = new Date().toISOString();
    window.localStorage.setItem(SYNCED_KEY, synced);
    publishSyncStatus({ phase: "backed-up", lastSyncedAt: synced, email });
    return { status: "ok" };
  } catch (err) {
    const error = err && typeof err === "object" ? (err as { code?: string; message?: string }) : null;
    publishSyncStatus({ phase: "failed", lastSyncedAt: readSynced(), email });
    return { status: "failed", error };
  }
}

async function upsertEntries(
  supabase: NonNullable<ReturnType<typeof createBrowserSupabase>>,
  businessId: string,
  rows: Array<LedgerEntry & { updatedAt: string; deletedAt: string | null }>,
) {
  const ready = rows
    .filter((row) => isCloudId(row.id))
    .map((entry) => ({
      id: entry.id,
      business_id: businessId,
      type: entry.type,
      amount: Math.round(entry.amount),
      currency: "UGX",
      date: entry.date,
      description: entry.description,
      category: entry.category,
      counterparty: entry.counterparty,
      confidence: entry.confidence,
      notes: entry.notes,
      recorded_by: entry.recordedBy ?? null,
      phone: entry.phone ?? null,
      location: entry.location ?? null,
      due_date: entry.dueDate ?? null,
      agreed_amount: entry.agreedAmount ?? null,
      ...(entry.paymentMethod ? { payment_method: entry.paymentMethod } : {}),
      source: entry.source,
      is_sample: entry.isSample,
      created_at: entry.createdAt,
      updated_at: entry.updatedAt,
      deleted_at: entry.deletedAt,
    }))
    .filter((row) => entryWriteSchema.safeParse(row).success);
  if (ready.length === 0) return;
  let { error } = await supabase.from("entries").upsert(ready);
  if (error && /payment_method/i.test(error.message ?? "")) {
    const stripped = ready.map((row) => {
      const { payment_method: _ignored, ...rest } = row;
      void _ignored;
      return rest;
    });
    const retry = await supabase.from("entries").upsert(stripped);
    error = retry.error;
  }
  if (error) throw error;
}

function fromRemote(row: Record<string, unknown>): LedgerEntry | null {
  const source = row.source === "ai" || row.source === "sample" ? row.source : "demo";
  const [entry] = parseLedger(
    JSON.stringify([
      {
        id: row.id,
        type: row.type,
        amount: Number(row.amount),
        currency: "UGX",
        date: String(row.date ?? "").slice(0, 10),
        description: row.description ?? "Transaction",
        category: row.category ?? "Other",
        counterparty: row.counterparty ?? null,
        confidence: Number(row.confidence ?? 1),
        notes: row.notes ?? null,
        recordedBy: row.recorded_by ?? null,
        phone: row.phone ?? null,
        location: row.location ?? null,
        dueDate: row.due_date ? String(row.due_date).slice(0, 10) : null,
        agreedAmount: row.agreed_amount == null ? null : Number(row.agreed_amount),
        source,
        isSample: Boolean(row.is_sample),
        createdAt: row.created_at ?? row.updated_at ?? new Date().toISOString(),
        updatedAt: row.updated_at ?? row.created_at ?? new Date().toISOString(),
        deletedAt: row.deleted_at,
      },
    ]),
  );
  return entry ?? null;
}

function syncRows(entries: LedgerEntry[]) {
  return entries.map((entry) => ({
    ...entry,
    updatedAt: entry.updatedAt || entry.createdAt,
    deletedAt: entry.deletedAt ?? null,
  }));
}

function readShadow(): LedgerEntry[] {
  try {
    return parseLedger(window.localStorage.getItem(SHADOW_KEY));
  } catch {
    return [];
  }
}

function writeShadow(entries: LedgerEntry[]) {
  window.localStorage.setItem(SHADOW_KEY, JSON.stringify(entries));
}

function writeLedger(entries: LedgerEntry[]) {
  applyingRemote = true;
  try {
    saveLedger(entries);
  } finally {
    applyingRemote = false;
  }
}

function readSynced() {
  return window.localStorage.getItem(SYNCED_KEY);
}
