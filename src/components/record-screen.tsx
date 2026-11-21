"use client";

import { Camera, Mic, PenLine } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DraftCard } from "@/components/draft-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { postJson } from "@/lib/client";
import { compressImage } from "@/lib/compress-image";
import { kampalaToday } from "@/lib/dates";
import { useLedger } from "@/lib/use-ledger";
import type { DraftTransaction, ExtractionResponse, LedgerEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

const EXAMPLE =
  "Sold 3 bags of sugar to Mama Grace for 15k, she paid 10k cash and owes 5k";

type Mode = "text" | "voice" | "receipt";
type VoiceSupport = "unknown" | "yes" | "no";

function toDrafts(response: ExtractionResponse): DraftTransaction[] {
  return response.transactions.map((tx) => ({
    ...tx,
    currency: "UGX",
    draftId: crypto.randomUUID(),
    origin: tx.isSample ? "sample" : response.source === "ai" ? "ai" : "demo",
  }));
}

function toEntry(draft: DraftTransaction): LedgerEntry {
  return {
    id: crypto.randomUUID(),
    type: draft.type,
    amount: Math.round(draft.amount),
    currency: "UGX",
    date: draft.date,
    description: draft.description.trim() || "Transaction",
    category: draft.category.trim() || "Other",
    counterparty: draft.counterparty?.trim() || null,
    confidence: draft.confidence,
    notes: draft.notes,
    source: draft.origin,
    isSample: Boolean(draft.isSample) || draft.origin === "sample",
    createdAt: new Date().toISOString(),
  };
}

export function RecordScreen() {
  const { add } = useLedger();
  const [mode, setMode] = useState<Mode>("text");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractionResponse | null>(null);
  const [drafts, setDrafts] = useState<DraftTransaction[]>([]);
  const [saved, setSaved] = useState(0);
  const [voiceSupport, setVoiceSupport] = useState<VoiceSupport>("unknown");
  const [listening, setListening] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ base64: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef("");

  useEffect(() => {
    return () => recognitionRef.current?.abort();
  }, []);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function readText(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Type what happened first.");
      setResult(null);
      setDrafts([]);
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(0);
    try {
      const response = await postJson<ExtractionResponse>("/api/extract", {
        text: trimmed,
        clientDate: kampalaToday(),
      });
      setResult(response);
      setDrafts(toDrafts(response));
    } catch (err) {
      setResult(null);
      setDrafts([]);
      setError(err instanceof Error ? err.message : "Could not read that.");
    } finally {
      setBusy(false);
    }
  }

  function startVoice() {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) {
      markVoiceUnsupported(setVoiceSupport, setVoiceMessage);
      return;
    }
    recognitionRef.current?.abort();
    const recognition = new Ctor();
    recognitionRef.current = recognition;
    recognition.lang = "en-UG";
    recognition.interimResults = true;
    recognition.continuous = false;
    let triedEnglish = false;
    transcriptRef.current = "";
    setVoiceMessage(null);
    setListening(true);
    setError(null);

    recognition.onresult = (event) => {
      let spoken = "";
      for (let index = 0; index < event.results.length; index += 1) {
        spoken += event.results[index][0].transcript;
      }
      transcriptRef.current = spoken.trim();
      setText(spoken.trim());
    };
    recognition.onerror = (event) => {
      if (event.error === "language-not-supported" && !triedEnglish) {
        triedEnglish = true;
        recognition.lang = "en-US";
        try {
          recognition.start();
          return;
        } catch {
          setVoiceMessage("Not supported in this browser");
        }
      } else if (event.error === "not-allowed") {
        setVoiceMessage("Microphone permission was blocked.");
      } else if (event.error !== "aborted" && event.error !== "no-speech") {
        setVoiceMessage("Could not hear that. Try again, or type it instead.");
      }
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
      const spoken = transcriptRef.current.trim();
      if (spoken) void readText(spoken);
    };
    try {
      recognition.start();
    } catch {
      setListening(false);
      setVoiceMessage("Not supported in this browser");
    }
  }

  function stopVoice() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setError(null);
    setSaved(0);
    try {
      const compressed = await compressImage(file);
      setPreview((current) => {
        if (current) URL.revokeObjectURL(current);
        return compressed.previewUrl;
      });
      setReceipt({ base64: compressed.base64 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that photo.");
    }
  }

  async function readReceipt() {
    if (!receipt) {
      setError("Choose a photo first.");
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(0);
    try {
      const response = await postJson<ExtractionResponse>("/api/receipt", {
        imageBase64: receipt.base64,
        mimeType: "image/jpeg",
        clientDate: kampalaToday(),
      });
      setResult(response);
      setDrafts(toDrafts(response));
    } catch (err) {
      setResult(null);
      setDrafts([]);
      setError(err instanceof Error ? err.message : "Could not read that photo.");
    } finally {
      setBusy(false);
    }
  }

  function confirm(ids: string[]) {
    const chosen = drafts.filter(
      (draft) => ids.includes(draft.draftId) && draft.amount > 0 && draft.description.trim(),
    );
    if (chosen.length === 0) return;
    add(chosen.map(toEntry));
    setDrafts((current) => current.filter((draft) => !ids.includes(draft.draftId)));
    setSaved(chosen.length);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-3xl leading-tight tracking-tight">What happened?</h1>
        <p className="mt-2 text-base leading-6 text-muted-foreground">
          Tell your assistant what happened in your business. It organizes the information.
          Nothing is saved until you confirm.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="How to tell KaalBiz">
        <ModeButton current={mode} mode="text" label="Text" icon={<PenLine className="h-4 w-4" />} onSelect={setMode} />
        <ModeButton
          current={mode}
          mode="voice"
          label="Voice"
          icon={<Mic className="h-4 w-4" />}
          onSelect={(next) => {
            setMode(next);
            if (next === "voice" && !window.SpeechRecognition && !window.webkitSpeechRecognition) {
              markVoiceUnsupported(setVoiceSupport, setVoiceMessage);
            }
          }}
        />
        <ModeButton current={mode} mode="receipt" label="Receipt" icon={<Camera className="h-4 w-4" />} onSelect={setMode} />
      </div>

      {mode !== "receipt" ? (
        <div className="space-y-3">
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={EXAMPLE}
            aria-label="What happened in the business"
          />
          {mode === "text" ? (
            <button
              type="button"
              className="text-left text-sm font-semibold text-primary"
              onClick={() => setText(EXAMPLE)}
            >
              Use an example
            </button>
          ) : (
            <div className="space-y-2">
              <Button
                type="button"
                variant={listening ? "secondary" : "outline"}
                className="w-full"
                onClick={listening ? stopVoice : startVoice}
                disabled={voiceSupport === "no"}
              >
                <Mic className="h-4 w-4" />
                {listening ? "Listening… tap to stop" : "Tap to speak"}
              </Button>
              <p className="text-sm text-muted-foreground" role="status">
                {voiceSupport === "no"
                  ? "Not supported in this browser"
                  : voiceMessage ||
                    "Speak in English. The words fill the box, then KaalBiz reads them."}
              </p>
            </div>
          )}
          <Button type="button" className="w-full" size="lg" disabled={busy} onClick={() => void readText(text)}>
            {busy ? "Reading…" : "Read this"}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              void onPhoto(file);
            }}
          />
          <Button type="button" variant="outline" className="w-full" size="lg" onClick={() => fileRef.current?.click()}>
            <Camera className="h-4 w-4" />
            Take a photo or upload
          </Button>
          <p className="text-sm leading-6 text-muted-foreground">
            The photo is shrunk on this phone before it is sent. On a phone, this opens the camera.
          </p>
          {preview ? (
            // The preview is a local blob URL, which next/image does not accept.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Receipt preview" className="max-h-56 w-full rounded-2xl object-cover" />
          ) : null}
          <Button type="button" className="w-full" size="lg" disabled={busy || !receipt} onClick={() => void readReceipt()}>
            {busy ? "Reading…" : "Read receipt"}
          </Button>
        </div>
      )}

      {error ? (
        <p className="rounded-2xl bg-destructive/10 px-3 py-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {saved > 0 ? (
        <p className="rounded-2xl bg-primary/10 px-3 py-3 text-sm text-primary" role="status">
          Saved {saved} {saved === 1 ? "record" : "records"} to your ledger.{" "}
          <Link href="/dashboard" className="font-semibold underline">
            See today
          </Link>
        </p>
      ) : null}

      {result ? (
        <div className="space-y-3">
          <Badge variant={result.source === "ai" ? "default" : "warning"}>{result.badge}</Badge>
          {result.message ? (
            <p className="text-sm leading-6 text-muted-foreground">{result.message}</p>
          ) : null}
          {drafts.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
              Nothing to save from that. Try a sentence with an amount, like “Sold rice for 20k”.
            </p>
          ) : (
            <>
              {drafts.map((draft) => (
                <DraftCard
                  key={draft.draftId}
                  draft={draft}
                  onChange={(next) =>
                    setDrafts((current) => current.map((item) => (item.draftId === next.draftId ? next : item)))
                  }
                  onDiscard={() =>
                    setDrafts((current) => current.filter((item) => item.draftId !== draft.draftId))
                  }
                  onConfirm={() => confirm([draft.draftId])}
                />
              ))}
              {drafts.length > 1 ? (
                <Button type="button" className="w-full" onClick={() => confirm(drafts.map((draft) => draft.draftId))}>
                  Confirm all
                </Button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function markVoiceUnsupported(
  setVoiceSupport: (value: VoiceSupport) => void,
  setVoiceMessage: (value: string) => void,
) {
  setVoiceSupport("no");
  setVoiceMessage("Not supported in this browser");
}

function ModeButton({
  current,
  mode,
  label,
  icon,
  onSelect,
}: {
  current: Mode;
  mode: Mode;
  label: string;
  icon: React.ReactNode;
  onSelect: (mode: Mode) => void;
}) {
  const selected = current === mode;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={() => onSelect(mode)}
      className={cn(
        "flex h-16 flex-col items-center justify-center gap-1 rounded-2xl border text-sm font-semibold",
        selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
