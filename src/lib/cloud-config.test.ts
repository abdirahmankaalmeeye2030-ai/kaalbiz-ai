import { describe, expect, it } from "vitest";
import { isMissingSession } from "./cloud-config";

describe("cloud config", () => {
  it("treats a signed-out Supabase call as no session, not a failed backup", () => {
    expect(isMissingSession({ name: "AuthSessionMissingError", message: "Auth session missing!" })).toBe(true);
    expect(isMissingSession({ message: "Failed to fetch" })).toBe(false);
    expect(isMissingSession(null)).toBe(false);
  });
});
