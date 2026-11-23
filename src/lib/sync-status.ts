export type CloudPhase = "off" | "signed-out" | "needs-shop" | "syncing" | "backed-up" | "offline" | "failed";

export function syncStatusLabel(phase: CloudPhase, lastSyncedAt: string | null): string {
  if (phase === "off") return "Cloud backup is off";
  if (phase === "syncing") return "Syncing…";
  if (phase === "offline") return "Offline, will sync later";
  if (phase === "failed") return "Backup failed, retrying";
  if (phase === "needs-shop") return "Name your shop to back up";
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

export function isPermissionDenied(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "42501" || /permission denied/i.test(error.message ?? "");
}
