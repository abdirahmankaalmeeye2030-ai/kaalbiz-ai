export function contentSecurityPolicy(supabaseUrl: string | undefined, production: boolean): string {
  const scriptSrc = production ? "'self' 'unsafe-inline'" : "'self' 'unsafe-inline' 'unsafe-eval'";
  const connect = ["'self'", "https://*.supabase.co", "wss://*.supabase.co", "https://openrouter.ai"];
  const extra = supabaseConnectSources(supabaseUrl);
  for (const source of extra) {
    if (!connect.includes(source)) connect.push(source);
  }
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connect.join(" ")}`,
    "media-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

export function supabaseConnectSources(supabaseUrl: string | undefined): string[] {
  if (!supabaseUrl?.trim()) return [];
  try {
    const parsed = new URL(supabaseUrl.trim());
    const socket = parsed.protocol === "https:" ? "wss:" : "ws:";
    return [parsed.origin, `${socket}//${parsed.host}`];
  } catch {
    return [];
  }
}
