import { isCloudConfigured } from "@/lib/cloud-config";
import { magicLinkSchema } from "@/lib/cloud-schema";
import { tooManyRequests } from "@/lib/rate-limit";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!isCloudConfigured()) {
    return Response.json({ message: "Cloud backup is off." }, { status: 404 });
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (tooManyRequests(`magic:${ip}`)) {
    return Response.json({ message: "Too many login emails. Wait a few minutes and try again." }, { status: 429 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ message: "Send a JSON body." }, { status: 400 });
  }
  const parsed = magicLinkSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ message: "Enter a real email address." }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  if (!supabase) return Response.json({ message: "Cloud backup is off." }, { status: 404 });
  const origin = new URL(request.url).origin;
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) {
    return Response.json({ message: "Could not send the login email. Try again." }, { status: 502 });
  }
  return Response.json({ message: "Check your email for a login link." });
}
