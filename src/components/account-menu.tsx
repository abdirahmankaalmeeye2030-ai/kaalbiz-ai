"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isCloudConfigured } from "@/lib/cloud-config";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

export type CloudPhase = "off" | "signed-out" | "syncing" | "backed-up" | "offline";

const STATUS_EVENT = "kaalbiz:sync-status";

export function publishSyncStatus(detail: { phase: CloudPhase; lastSyncedAt: string | null; email: string | null }) {
  window.dispatchEvent(new CustomEvent(STATUS_EVENT, { detail }));
}

export function AccountMenu({ layout = "header" }: { layout?: "header" | "side" }) {
  const cloud = isCloudConfigured();
  const [email, setEmail] = useState<string | null>(null);
  const [phase, setPhase] = useState<CloudPhase>(cloud ? "signed-out" : "off");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!cloud) return;
    const supabase = createBrowserSupabase();
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, [cloud]);

  useEffect(() => {
    function onStatus(event: Event) {
      const detail = (event as CustomEvent<{ phase: CloudPhase; lastSyncedAt: string | null; email: string | null }>).detail;
      if (!detail) return;
      setPhase(detail.phase);
      setLastSyncedAt(detail.lastSyncedAt);
      if (detail.email) setEmail(detail.email);
    }
    window.addEventListener(STATUS_EVENT, onStatus);
    return () => window.removeEventListener(STATUS_EVENT, onStatus);
  }, []);

  const status = statusLabel(cloud ? phase : "off", lastSyncedAt);

  if (!cloud) {
    return <p className={cn("text-xs text-muted-foreground", layout === "side" && "px-3")}>Cloud backup is off</p>;
  }

  if (!email) {
    return (
      <Link href="/sign-in" className="text-sm font-semibold text-primary">
        Sign in
      </Link>
    );
  }

  return (
    <div className={cn("relative", layout === "side" && "px-1")}>
      <button
        type="button"
        className="max-w-44 truncate text-left text-sm font-semibold text-foreground"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {email}
      </button>
      <p className="text-xs text-muted-foreground" role="status">
        {status}
      </p>
      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-56 rounded-2xl border border-border bg-card p-3 shadow-lg">
          <p className="text-sm font-semibold">{email}</p>
          <p className="mt-1 text-xs text-muted-foreground">{status}</p>
          <button
            type="button"
            className="mt-3 text-sm font-semibold text-destructive"
            onClick={() => {
              void fetch("/api/auth/sign-out", { method: "POST" }).then(() => {
                router.push("/");
                router.refresh();
              });
            }}
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

function statusLabel(phase: CloudPhase, lastSyncedAt: string | null): string {
  if (phase === "off") return "Cloud backup is off";
  if (phase === "syncing") return "Syncing…";
  if (phase === "offline") return "Offline, will sync later";
  if (phase === "backed-up") {
    if (!lastSyncedAt) return "Backed up ✓";
    const time = new Date(lastSyncedAt);
    const label = Number.isNaN(time.getTime())
      ? ""
      : time.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" });
    return label ? `Backed up ✓ · ${label}` : "Backed up ✓";
  }
  return "Sign in to back up";
}
