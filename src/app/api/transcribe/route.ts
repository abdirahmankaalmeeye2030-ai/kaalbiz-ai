import { z } from "zod";
import { guardAiRequest } from "@/lib/auth-guard";
import { audioFormatForMime } from "@/lib/ai/audio-format";
import { AiNotConfiguredError, isAiConfigured, transcribeAudio } from "@/lib/ai/provider";

export const maxDuration = 60;

/** About 15MB of decoded audio. Base64 is larger; the proxy limit covers the JSON body. */
const MAX_AUDIO_BYTES = 15 * 1024 * 1024;
const MAX_BASE64_CHARS = Math.ceil(MAX_AUDIO_BYTES / 3) * 4 + 256;

const bodySchema = z.object({
  audioBase64: z.string().min(1).max(MAX_BASE64_CHARS),
  mimeType: z.string().trim().min(1).max(120),
});

function decodedAudioBytes(base64: string): number {
  const cleaned = base64.replace(/\s/g, "");
  if (cleaned.length === 0 || cleaned.length % 4 !== 0) return -1;
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned)) return -1;
  const padding = cleaned.endsWith("==") ? 2 : cleaned.endsWith("=") ? 1 : 0;
  return (cleaned.length * 3) / 4 - padding;
}

export async function POST(request: Request) {
  const denied = await guardAiRequest();
  if (denied) return denied;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ message: "Send a JSON body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { message: "That recording is too long to send. Try a shorter one, or type it instead." },
      { status: 400 },
    );
  }

  const audioBase64 = parsed.data.audioBase64.replace(/\s/g, "");
  const bytes = decodedAudioBytes(audioBase64);
  if (bytes < 0 || !audioFormatForMime(parsed.data.mimeType)) {
    return Response.json(
      { message: "That recording could not be sent. Type it instead." },
      { status: 400 },
    );
  }
  if (bytes > MAX_AUDIO_BYTES) {
    return Response.json(
      { message: "That recording is too long to send. Try a shorter one, or type it instead." },
      { status: 413 },
    );
  }

  if (!isAiConfigured()) {
    return Response.json({ message: "Transcription needs OPENROUTER_API_KEY." }, { status: 503 });
  }

  try {
    const transcript = await transcribeAudio(audioBase64, parsed.data.mimeType);
    return Response.json({ transcript });
  } catch (error) {
    if (error instanceof AiNotConfiguredError) {
      return Response.json({ message: "Transcription needs OPENROUTER_API_KEY." }, { status: 503 });
    }
    if (error instanceof Error && error.name === "TimeoutError") {
      return Response.json({ message: "Transcription took too long. Type it instead." }, { status: 504 });
    }
    return Response.json({ message: "Transcription failed. Type it instead." }, { status: 502 });
  }
}
