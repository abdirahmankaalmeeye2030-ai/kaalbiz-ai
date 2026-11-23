import type { CloudPhase } from "@/lib/sync-status";

const COLORS = ["#0e6b4c", "#1d4e89", "#8a4b08", "#6b2d5b", "#0f5f6b", "#7a2e2e"];

export function avatarInitial(email: string | null): string {
  const letter = email?.trim().charAt(0).toUpperCase() ?? "";
  return /^[A-Z0-9]$/.test(letter) ? letter : "?";
}

export function avatarColor(email: string | null): string {
  const key = (email ?? "").trim().toLowerCase();
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return COLORS[hash % COLORS.length] ?? COLORS[0];
}

export type SyncDot = "green" | "amber" | "red" | "none";

export function syncDot(phase: CloudPhase): SyncDot {
  if (phase === "backed-up") return "green";
  if (phase === "failed") return "red";
  if (phase === "syncing" || phase === "offline" || phase === "needs-shop") return "amber";
  return "none";
}

export function profilePhotoKey(email: string): string {
  return `kaalbiz.profile.photo:${email.trim().toLowerCase()}`;
}
