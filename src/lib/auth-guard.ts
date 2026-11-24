import { isCloudConfigured } from "@/lib/cloud-config";
import { createServerSupabase } from "@/lib/supabase/server";

export async function guardAiRequest(): Promise<Response | null> {
  if (!isCloudConfigured()) return null;
  const supabase = await createServerSupabase();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!user) {
    return Response.json({ message: "Sign in to use KaalBiz AI." }, { status: 401 });
  }
  return null;
}
