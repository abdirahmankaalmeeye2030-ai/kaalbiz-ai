import { describe, expect, it } from "vitest";
import { contentSecurityPolicy } from "./security-headers";

describe("content security policy", () => {
  it("allows the Supabase project over https and wss", () => {
    const policy = contentSecurityPolicy("https://fjllotlodzwjmfrkmjbx.supabase.co", true);
    expect(policy).toContain("https://*.supabase.co");
    expect(policy).toContain("wss://*.supabase.co");
    expect(policy).toContain("https://fjllotlodzwjmfrkmjbx.supabase.co");
    expect(policy).toContain("wss://fjllotlodzwjmfrkmjbx.supabase.co");
    expect(policy).toContain("frame-ancestors 'none'");
  });
});
