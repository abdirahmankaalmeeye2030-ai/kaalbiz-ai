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
import { isCloudId, queueChange, type QueuedChange, type SyncRecord } from "@/lib/sync";

const QUEUE_KEY = "kaalbiz.sync.queue.v1";
const BUSINESS_KEY = "kaalbiz.businessId";
const MIGRATION_KEY = "kaalbiz.cloud.migration";
const SYNCED_KEY = "kaalbiz.sync.last";

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

async function runSync(
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
    const local = parseLedger(window.localStorage.getItem(LEDGER_KEY));
    const shouldUpload = window.localStorage.getItem(MIGRATION_KEY) === "yes";
    if (shouldUpload) {
      const now = new Date().toISOString();
      let queue = readQueue();
      for (const entry of local) {
        queue = queueChange(queue, {
          table: "entries",
          record: {
            id: entry.id,
            updatedAt: entry.updatedAt ?? entry.createdAt,
            deletedAt: entry.deletedAt ?? null,
          },
        });
      }
      window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
      const rows = local.map((entry) => ({
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
        updated_at: entry.updatedAt ?? now,
        deleted_at: entry.deletedAt ?? null,
      }));
      const ready = rows.filter((row) => isCloudId(row.id) && entryWriteSchema.safeParse(row).success);
      if (ready.length > 0) {
        const { error } = await supabase.from("entries").upsert(ready);
        if (error) throw error;
      }
      window.localStorage.setItem(QUEUE_KEY, "[]");
    }
    const { data, error } = await supabase.from("entries").select("id,updated_at,deleted_at").eq("business_id", businessId);
    if (error) throw error;
    const remoteIds = new Set((data ?? []).filter((row) => !row.deleted_at).map((row) => row.id as string));
    if (window.localStorage.getItem(MIGRATION_KEY) === "yes") {
      const kept = local.filter((entry) => remoteIds.has(entry.id) || !entry.deletedAt);
      saveLedger(kept);
    }
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

function readSynced() {
  return window.localStorage.getItem(SYNCED_KEY);
}

function readQueue(): QueuedChange<SyncRecord>[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(QUEUE_KEY) ?? "[]") as QueuedChange<SyncRecord>[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
