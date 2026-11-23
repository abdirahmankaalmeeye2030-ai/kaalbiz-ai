import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/20261124000000_accounts.sql", "utf8");

describe("account migration", () => {
  it("turns on row level security for every cloud table", () => {
    for (const table of ["businesses", "business_members", "entries", "contacts", "staff", "goals"]) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
    expect(sql).toContain("auth.uid()");
    expect(sql).toContain("is_business_member");
    expect(sql).toContain("check (amount >= 0)");
    expect(sql).not.toContain("service_role");
  });
});
