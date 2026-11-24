"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isCloudConfigured } from "@/lib/cloud-config";
import { postJson } from "@/lib/client";

export function SignInScreen() {
  const cloud = isCloudConfigured();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(cloud ? null : "Cloud backup is off.");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      const response = await postJson<{ message: string }>("/api/auth/magic-link", { email });
      setMessage(response.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the login email.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div>
        <h1 className="font-serif text-3xl tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {cloud
            ? "We will email you a login link. No password."
            : "Cloud backup is off. Records stay on this phone until a Supabase project is connected."}
        </p>
      </div>
      <form className="space-y-3" onSubmit={(event) => void submit(event)}>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            className="mt-1"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            disabled={!cloud || sending}
            onChange={(event) => setEmail(event.target.value)}
            required={cloud}
          />
        </div>
        <Button type="submit" className="w-full" disabled={!cloud || sending}>
          {sending ? "Sending…" : "Email me a login link"}
        </Button>
      </form>
      {message ? <p className="text-sm font-semibold text-primary">{message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
