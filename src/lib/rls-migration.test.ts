import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/20261124000000_accounts.sql", "utf8");
const grants = readFileSync("supabase/migrations/20261125000000_api_grants.sql", "utf8");

describe("account migration", () => {
  it("turns on row level security for every cloud table", () => {
    for (const table of ["businesses", "business_members", "entries", "contacts", "staff", "goals"]) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
    expect(sql).toContain("auth.uid()");
    expect(sql).toContain("is_business_member");
    expect(sql).toContain("check (amount >= 0)");
    expect(sql).not.toContain("service_role");
    expect(sql).toContain("grant select, insert, update, delete on table");
    expect(sql).toContain("to authenticated");
  });

  it("grants the signed-in API role access when automatic grants were off", () => {
    for (const table of ["businesses", "business_members", "entries", "contacts", "staff", "goals"]) {
      expect(grants).toContain(`public.${table}`);
    }
    expect(grants).toContain("to authenticated");
    expect(grants).toContain("notify pgrst, 'reload schema'");
    expect(grants).not.toContain("service_role");
    expect(grants).not.toContain("to anon");
  });
});
