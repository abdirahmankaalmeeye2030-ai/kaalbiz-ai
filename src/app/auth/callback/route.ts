import { NextResponse } from "next/server";
import { isCloudConfigured } from "@/lib/cloud-config";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  if (!isCloudConfigured()) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/sign-in?error=1", request.url));
  const supabase = await createServerSupabase();
  const { error } = await supabase!.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/sign-in?error=1", request.url));
  return NextResponse.redirect(new URL("/dashboard", request.url));
}
