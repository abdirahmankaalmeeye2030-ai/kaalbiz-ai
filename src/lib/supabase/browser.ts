import { createBrowserClient } from "@supabase/ssr";
import { supabasePublicConfig } from "@/lib/cloud-config";

export function createBrowserSupabase() {
  const config = supabasePublicConfig();
  if (!config) return null;
  return createBrowserClient(config.url, config.anonKey);
}
