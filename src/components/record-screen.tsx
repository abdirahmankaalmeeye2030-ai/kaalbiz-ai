"use client";

import { Camera, Mic, PenLine, Upload } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
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

const VOICE_LIMIT_MS = 2 * 60 * 1000;

type Mode = "text" | "voice" | "receipt";
type VoiceSupport = "unknown" | "yes" | "no";

function formatVoiceClock(ms: number) {
  const totalSeconds = Math.min(120, Math.max(0, Math.floor(ms / 1000)));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function joinSpeech(parts: string[]) {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

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
  const [elapsedMs, setElapsedMs] = useState(0);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef("");
  const accumulatedRef = useRef("");
  const sessionFinalRef = useRef("");
  const sessionInterimRef = useRef("");
  const sessionIdRef = useRef(0);
  const voiceStopRef = useRef(false);
  const voiceFatalRef = useRef(false);
  const voiceStartedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const restartTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      voiceStopRef.current = true;
      sessionIdRef.current += 1;
      if (timerRef.current != null) window.clearInterval(timerRef.current);
      if (restartTimerRef.current != null) window.clearTimeout(restartTimerRef.current);
      recognitionRef.current?.abort();
    };
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

  function clearVoiceTimers() {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (restartTimerRef.current != null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }

  function commitVoiceSession() {
    const spoken = joinSpeech([
      accumulatedRef.current,
      sessionFinalRef.current,
      sessionInterimRef.current,
    ]);
    accumulatedRef.current = spoken;
    sessionFinalRef.current = "";
    sessionInterimRef.current = "";
    if (!spoken) return;
    transcriptRef.current = spoken;
    setText(spoken);
  }

  function stopVoice() {
    voiceStopRef.current = true;
    clearVoiceTimers();
    const recognition = recognitionRef.current;
    if (recognition) {
      try {
        recognition.stop();
      } catch {
        try {
          recognition.abort();
        } catch {
          // Already stopped.
        }
      }
    }
    setListening(false);
  }

  function startVoice() {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) {
      markVoiceUnsupported(setVoiceSupport, setVoiceMessage);
      return;
    }
    const session = sessionIdRef.current + 1;
    sessionIdRef.current = session;
    voiceStopRef.current = true;
    clearVoiceTimers();
    recognitionRef.current?.abort();

    const recognition = new Ctor();
    recognitionRef.current = recognition;
    recognition.lang = "en-UG";
    recognition.interimResults = true;
    recognition.continuous = true;
    let triedEnglish = false;
    accumulatedRef.current = "";
    sessionFinalRef.current = "";
    sessionInterimRef.current = "";
    transcriptRef.current = "";
    voiceStopRef.current = false;
    voiceFatalRef.current = false;
    voiceStartedAtRef.current = Date.now();
    setElapsedMs(0);
    setVoiceMessage(null);
    setListening(true);
    setError(null);

    const publishTranscript = () => {
      const spoken = joinSpeech([
        accumulatedRef.current,
        sessionFinalRef.current,
        sessionInterimRef.current,
      ]);
      if (!spoken) return;
      transcriptRef.current = spoken;
      setText(spoken);
    };

    const scheduleRestart = () => {
      if (restartTimerRef.current != null) return;
      restartTimerRef.current = window.setTimeout(() => {
        restartTimerRef.current = null;
        if (sessionIdRef.current !== session) return;
        if (voiceStopRef.current || voiceFatalRef.current) return;
        if (Date.now() - voiceStartedAtRef.current >= VOICE_LIMIT_MS) {
          setElapsedMs(VOICE_LIMIT_MS);
          stopVoice();
          return;
        }
        try {
          recognition.start();
        } catch {
          // The browser was still closing the previous session.
        }
      }, 250);
    };

    recognition.onresult = (event) => {
      if (sessionIdRef.current !== session) return;
      let finals = "";
      let interim = "";
      for (let index = 0; index < event.results.length; index += 1) {
        const piece = event.results[index][0]?.transcript ?? "";
        if (event.results[index].isFinal) finals += piece;
        else interim += piece;
      }
      sessionFinalRef.current = finals.trim();
      sessionInterimRef.current = interim.trim();
      publishTranscript();
    };
    recognition.onerror = (event) => {
      if (sessionIdRef.current !== session) return;
      if (event.error === "no-speech") {
        scheduleRestart();
        return;
      }
      if (event.error === "aborted") return;
      if (event.error === "language-not-supported" && !triedEnglish) {
        triedEnglish = true;
        recognition.lang = "en-US";
        return;
      }
      voiceFatalRef.current = true;
      if (event.error === "not-allowed") {
        setVoiceMessage("Microphone permission was blocked.");
      } else if (event.error === "language-not-supported") {
        setVoiceMessage("Not supported in this browser");
      } else {
        setVoiceMessage("Could not hear that. Try again, or type it instead.");
      }
    };
    recognition.onend = () => {
      if (sessionIdRef.current !== session) return;
      commitVoiceSession();
      const elapsed = Date.now() - voiceStartedAtRef.current;
      const keepGoing = !voiceStopRef.current && !voiceFatalRef.current && elapsed < VOICE_LIMIT_MS;
      if (keepGoing) {
        scheduleRestart();
        return;
      }
      clearVoiceTimers();
      setListening(false);
    };

    timerRef.current = window.setInterval(() => {
      if (sessionIdRef.current !== session || voiceStopRef.current) return;
      const elapsed = Date.now() - voiceStartedAtRef.current;
      if (elapsed >= VOICE_LIMIT_MS) {
        setElapsedMs(VOICE_LIMIT_MS);
        stopVoice();
        return;
      }
      setElapsedMs(elapsed);
    }, 250);

    try {
      recognition.start();
    } catch {
      voiceStopRef.current = true;
      clearVoiceTimers();
      setListening(false);
      setVoiceMessage("Not supported in this browser");
    }
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

  function onFileChosen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    void onPhoto(file);
  }

  function selectMode(next: Mode) {
    if (next !== mode && next !== "voice") stopVoice();
    setMode(next);
    if (next === "voice" && !window.SpeechRecognition && !window.webkitSpeechRecognition) {
      markVoiceUnsupported(setVoiceSupport, setVoiceMessage);
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
        <ModeButton current={mode} mode="text" label="Text" icon={<PenLine className="h-4 w-4" />} onSelect={selectMode} />
        <ModeButton current={mode} mode="voice" label="Voice" icon={<Mic className="h-4 w-4" />} onSelect={selectMode} />
        <ModeButton current={mode} mode="receipt" label="Receipt" icon={<Camera className="h-4 w-4" />} onSelect={selectMode} />
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
              <p
                className="text-center text-2xl font-semibold tabular-nums tracking-tight"
                aria-live="polite"
                aria-atomic="true"
              >
                <span className="sr-only">Recording time </span>
                {formatVoiceClock(elapsedMs)} / 2:00
              </p>
              {listening ? (
                <Button type="button" variant="destructive" className="h-14 w-full text-base" size="lg" onClick={stopVoice}>
                  Stop
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="h-14 w-full text-base"
                  size="lg"
                  onClick={startVoice}
                  disabled={voiceSupport === "no"}
                >
                  <Mic className="h-5 w-5" />
                  Tap to speak
                </Button>
              )}
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
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            aria-label="Take photo"
            onChange={onFileChosen}
          />
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            className="sr-only"
            aria-label="Upload from gallery / files"
            onChange={onFileChosen}
          />
          <Button type="button" className="h-14 w-full text-base" size="lg" onClick={() => cameraRef.current?.click()}>
            <Camera className="h-5 w-5" />
            Take photo
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-14 w-full text-base"
            size="lg"
            onClick={() => galleryRef.current?.click()}
          >
            <Upload className="h-5 w-5" />
            Upload from gallery / files
          </Button>
          <p className="text-sm leading-6 text-muted-foreground">
            Take a photo with the camera, or choose one from your gallery. The photo is shrunk on this phone before it is sent.
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
