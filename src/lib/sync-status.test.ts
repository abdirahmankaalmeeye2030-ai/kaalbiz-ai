import { describe, expect, it } from "vitest";
import { isPermissionDenied, syncStatusLabel } from "./sync-status";

describe("sync status", () => {
  it("keeps a real offline phone distinct from a failed backup", () => {
    expect(syncStatusLabel("offline", null)).toBe("Offline, will sync later");
    expect(syncStatusLabel("failed", null)).toBe("Backup failed, retrying");
    expect(syncStatusLabel("backed-up", null)).toBe("Backed up ✓");
    expect(syncStatusLabel("needs-shop", null)).toBe("Name your shop to back up");
  });

  it("recognises a missing table grant", () => {
    expect(isPermissionDenied({ code: "42501", message: "permission denied for table business_members" })).toBe(true);
    expect(isPermissionDenied({ message: "Failed to fetch" })).toBe(false);
  });
});
