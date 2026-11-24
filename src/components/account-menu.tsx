"use client";

import { User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { avatarColor, avatarInitial, profilePhotoKey, syncDot } from "@/lib/avatar";
import { isCloudConfigured } from "@/lib/cloud-config";
import { syncStatusLabel, type CloudPhase } from "@/lib/sync-status";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

export type { CloudPhase };

const STATUS_EVENT = "kaalbiz:sync-status";

export function publishSyncStatus(detail: { phase: CloudPhase; lastSyncedAt: string | null; email: string | null }) {
  window.dispatchEvent(new CustomEvent(STATUS_EVENT, { detail }));
}

export function AccountMenu({ layout = "dock" }: { layout?: "dock" | "side" }) {
  const cloud = isCloudConfigured();
  const [email, setEmail] = useState<string | null>(null);
  const [phase, setPhase] = useState<CloudPhase>(cloud ? "signed-out" : "off");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [photo, setPhoto] = useProfilePhoto(email);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!cloud) return;
    const supabase = createBrowserSupabase();
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, [cloud]);

  useEffect(() => {
    function onStatus(event: Event) {
      const detail = (event as CustomEvent<{ phase: CloudPhase; lastSyncedAt: string | null; email: string | null }>).detail;
      if (!detail) return;
      setPhase(detail.phase);
      setLastSyncedAt(detail.lastSyncedAt);
      if (detail.email) setEmail(detail.email);
    }
    window.addEventListener(STATUS_EVENT, onStatus);
    return () => window.removeEventListener(STATUS_EVENT, onStatus);
  }, []);

  const status = syncStatusLabel(cloud ? phase : "off", lastSyncedAt);

  if (!cloud) {
    return (
      <p className={cn("text-xs text-muted-foreground", layout === "side" && "px-3")}>Cloud backup is off</p>
    );
  }

  if (!email) {
    return (
      <Link
        href="/sign-in"
        aria-label="Sign in"
        className="grid h-11 w-11 place-items-center rounded-full border border-border bg-card text-foreground shadow-sm"
      >
        <User className="h-5 w-5" aria-hidden="true" />
      </Link>
    );
  }

  const dot = syncDot(phase);

  async function choosePhoto(file: File | undefined) {
    setPhotoError(null);
    if (!file || !email) return;
    if (!file.type.startsWith("image/")) {
      setPhotoError("Choose a picture.");
      return;
    }
    const dataUrl = await squarePhoto(file);
    if (!dataUrl) {
      setPhotoError("That picture could not be used.");
      return;
    }
    window.localStorage.setItem(profilePhotoKey(email), dataUrl);
    setPhoto(dataUrl);
  }

  return (
    <>
      <button
        type="button"
        className="relative grid h-11 w-11 place-items-center rounded-full text-base font-semibold text-white shadow-sm"
        style={photo ? undefined : { backgroundColor: avatarColor(email) }}
        aria-label={`Account. ${status}`}
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="h-11 w-11 rounded-full object-cover" />
        ) : (
          <span aria-hidden="true">{avatarInitial(email)}</span>
        )}
        {dot === "none" ? null : (
          <span
            aria-hidden="true"
            className={cn(
              "absolute bottom-0 right-0 h-3 w-3 rounded-full ring-2 ring-background",
              dot === "green" && "bg-primary",
              dot === "amber" && "bg-warning",
              dot === "red" && "bg-destructive",
            )}
          />
        )}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-auto bottom-0 left-0 w-full max-w-lg translate-x-0 translate-y-0 rounded-b-none rounded-t-3xl pb-8 sm:left-1/2 sm:w-[min(100%-2rem,24rem)] sm:-translate-x-1/2">
          <DialogTitle className="sr-only">Account</DialogTitle>
          <div className="flex items-center gap-3">
            <span
              className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full text-xl font-semibold text-white"
              style={photo ? undefined : { backgroundColor: avatarColor(email) }}
            >
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt="" className="h-14 w-14 object-cover" />
              ) : (
                avatarInitial(email)
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{email}</p>
              <p className="mt-1 text-xs text-muted-foreground" role="status">
                {status}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <label className="cursor-pointer text-sm font-semibold text-primary">
              Choose a photo
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  void choosePhoto(file);
                  event.target.value = "";
                }}
              />
            </label>
            {photo ? (
              <button
                type="button"
                className="text-sm font-semibold text-muted-foreground"
                onClick={() => {
                  window.localStorage.removeItem(profilePhotoKey(email));
                  setPhoto(null);
                }}
              >
                Remove photo
              </button>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">This photo stays on this phone.</p>
          {photoError ? <p className="mt-2 text-sm text-destructive">{photoError}</p> : null}
          <button
            type="button"
            className="mt-5 text-sm font-semibold text-destructive"
            onClick={() => {
              void fetch("/api/auth/sign-out", { method: "POST" }).then(() => {
                router.push("/");
                router.refresh();
              });
            }}
          >
            Sign out
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}

function useProfilePhoto(email: string | null): [string | null, (value: string | null) => void] {
  const key = email ? profilePhotoKey(email) : null;
  const photo = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("kaalbiz:profile-photo", onChange);
      return () => window.removeEventListener("kaalbiz:profile-photo", onChange);
    },
    () => (key ? window.localStorage.getItem(key) : null),
    () => null,
  );
  function save(value: string | null) {
    if (!key) return;
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
    window.dispatchEvent(new Event("kaalbiz:profile-photo"));
  }
  return [photo, save];
}

function squarePhoto(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve(null);
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const size = 128;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx || image.width < 1 || image.height < 1) {
          resolve(null);
          return;
        }
        const scale = Math.max(size / image.width, size / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        ctx.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        resolve(dataUrl.length > 120_000 ? null : dataUrl);
      };
      image.onerror = () => resolve(null);
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
