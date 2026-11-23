import { isCloudConfigured } from "@/lib/cloud-config";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST() {
  if (!isCloudConfigured()) return Response.json({ ok: true });
  const supabase = await createServerSupabase();
  await supabase?.auth.signOut();
  return Response.json({ ok: true });
}
