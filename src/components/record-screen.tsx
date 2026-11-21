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
const MAX_AUDIO_BYTES = 15 * 1024 * 1024;
const RECORDER_MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];

type Mode = "text" | "voice" | "receipt";

function formatVoiceClock(ms: number) {
  const totalSeconds = Math.min(120, Math.max(0, Math.floor(ms / 1000)));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function pickRecorderMime(): string | undefined {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return undefined;
  return RECORDER_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("Could not read that recording."));
    reader.readAsDataURL(blob);
  });
}

function microphoneError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Microphone permission was denied. Type it instead.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") {
    return "No microphone found. Type it instead.";
  }
  if (name === "SecurityError") {
    return "Voice recording needs a secure connection (HTTPS). Type it instead.";
  }
  return "Could not use the microphone. Type it instead.";
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
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [voiceMessage, setVoiceMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ base64: string } | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const sessionRef = useRef(0);
  const discardRef = useRef(false);
  const mountedRef = useRef(true);
  const transcribingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      discardRef.current = true;
      sessionRef.current += 1;
      if (timerRef.current != null) window.clearInterval(timerRef.current);
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch {
          // Already stopped.
        }
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
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

  function releaseStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function clearVoiceTimer() {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function stopRecording() {
    clearVoiceTimer();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
        return;
      } catch {
        // Fall through and release the mic ourselves.
      }
    }
    releaseStream();
    if (mountedRef.current) setRecording(false);
  }

  async function sendRecording(blob: Blob, mimeType: string) {
    if (blob.size < 1) {
      setVoiceMessage("No audio was recorded. Type it instead.");
      return;
    }
    if (blob.size > MAX_AUDIO_BYTES) {
      setVoiceMessage("That recording is too long to send. Try a shorter one, or type it instead.");
      return;
    }
    transcribingRef.current = true;
    setTranscribing(true);
    setVoiceMessage(null);
    try {
      const audioBase64 = await blobToBase64(blob);
      const response = await postJson<{ transcript: string }>("/api/transcribe", { audioBase64, mimeType });
      const transcript = response.transcript?.trim() ?? "";
      if (!transcript) {
        setVoiceMessage("Transcription failed. Type it instead.");
        return;
      }
      setText(transcript);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (
        message.includes("OPENROUTER_API_KEY") ||
        message.includes("Type it instead") ||
        message.includes("too long")
      ) {
        setVoiceMessage(message);
      } else {
        setVoiceMessage("Transcription failed. Type it instead.");
      }
    } finally {
      transcribingRef.current = false;
      if (mountedRef.current) setTranscribing(false);
    }
  }

  async function startRecording() {
    if (recording || transcribing || transcribingRef.current) return;
    setVoiceMessage(null);
    setError(null);
    if (!window.isSecureContext) {
      setVoiceMessage("Voice recording needs a secure connection (HTTPS). Type it instead.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setVoiceMessage("This browser cannot record audio. Type it instead.");
      return;
    }

    const session = sessionRef.current + 1;
    sessionRef.current = session;
    discardRef.current = false;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setVoiceMessage(microphoneError(err));
      return;
    }
    if (!mountedRef.current || sessionRef.current !== session) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    const mimeType = pickRecorderMime();
    let recorder: MediaRecorder;
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      setVoiceMessage("This browser cannot record audio. Type it instead.");
      return;
    }

    streamRef.current = stream;
    recorderRef.current = recorder;
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const type = recorder.mimeType || mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type });
      chunksRef.current = [];
      releaseStream();
      clearVoiceTimer();
      recorderRef.current = null;
      if (mountedRef.current) setRecording(false);
      if (discardRef.current || !mountedRef.current) return;
      void sendRecording(blob, type);
    };

    try {
      recorder.start();
    } catch {
      releaseStream();
      recorderRef.current = null;
      setVoiceMessage("This browser cannot record audio. Type it instead.");
      return;
    }

    startedAtRef.current = Date.now();
    setElapsedMs(0);
    setRecording(true);
    timerRef.current = window.setInterval(() => {
      if (sessionRef.current !== session) return;
      const elapsed = Date.now() - startedAtRef.current;
      if (elapsed >= VOICE_LIMIT_MS) {
        setElapsedMs(VOICE_LIMIT_MS);
        stopRecording();
        return;
      }
      setElapsedMs(elapsed);
    }, 250);
  }

  function selectMode(next: Mode) {
    if (next !== "voice") {
      sessionRef.current += 1;
      discardRef.current = true;
      stopRecording();
    }
    setMode(next);
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

  function onFileChosen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    void onPhoto(file);
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
              {recording ? (
                <Button type="button" variant="destructive" className="h-14 w-full text-base" size="lg" onClick={stopRecording}>
                  Stop
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="h-14 w-full text-base"
                  size="lg"
                  onClick={() => void startRecording()}
                  disabled={transcribing}
                >
                  <Mic className="h-5 w-5" />
                  {transcribing ? "Transcribing…" : "Tap to speak"}
                </Button>
              )}
              <p className="text-sm text-muted-foreground" role="status">
                {voiceMessage ||
                  (transcribing
                    ? "Transcribing…"
                    : "Record up to 2 minutes. Review the words in the box, then tap Read this.")}
              </p>
            </div>
          )}
          <Button type="button" className="w-full" size="lg" disabled={busy || transcribing} onClick={() => void readText(text)}>
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
