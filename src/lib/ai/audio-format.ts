export const AUDIO_FORMATS = ["webm", "mp4", "ogg", "wav", "mp3"] as const;

export type AudioFormat = (typeof AUDIO_FORMATS)[number];

/** Map a recorder MIME type to the format string OpenRouter chat completions expects. */
export function audioFormatForMime(mimeType: string): AudioFormat | null {
  const base = mimeType.toLowerCase().split(";")[0]?.trim() ?? "";
  switch (base) {
    case "audio/webm":
      return "webm";
    case "audio/mp4":
    case "audio/m4a":
    case "audio/x-m4a":
      return "mp4";
    case "audio/ogg":
    case "application/ogg":
      return "ogg";
    case "audio/wav":
    case "audio/wave":
    case "audio/x-wav":
      return "wav";
    case "audio/mpeg":
    case "audio/mp3":
      return "mp3";
    default:
      return null;
  }
}
