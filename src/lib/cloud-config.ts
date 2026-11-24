export function isCloudConfigured(): boolean {
  return supabasePublicConfig() !== null;
}

export function supabasePublicConfig(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function isMissingSession(error: { name?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.name === "AuthSessionMissingError" || /auth session missing/i.test(error.message ?? "");
}
