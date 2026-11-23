import { z } from "zod";
import { parseModelJson } from "../schema";

export const VOICE_LANGUAGES = ["en", "lg", "so"] as const;

export type VoiceLanguage = (typeof VOICE_LANGUAGES)[number];

export const voiceLanguageSchema = z.enum(VOICE_LANGUAGES);

const transcriptField = z.preprocess((value) => {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return value;
}, z.string().trim().min(1));

const bilingualSchema = z.object({
  original: transcriptField,
  english: transcriptField,
});

export interface VoiceTranscript {
  language: VoiceLanguage;
  original: string;
  english: string;
}

export class TranscriptParseError extends Error {
  constructor() {
    super("The transcript was not usable.");
    this.name = "TranscriptParseError";
  }
}

const ENGLISH_INSTRUCTION =
  "Transcribe this audio exactly. The speaker is a small business owner in Kampala, Uganda; may mix English, Luganda, Swahili. Return only the transcript text.";

const LUGANDA_INSTRUCTION = [
  "The speaker chose Luganda. They are a small business owner in Kampala, Uganda, and may mix Luganda with English words.",
  'Return only a JSON object with two string fields and no markdown: {"original":"...","english":"..."}',
  "original: the verbatim transcript in the language they spoke. Do not translate this field. Keep names as spoken.",
  "english: a faithful English translation of the whole utterance.",
  "In english, write amounts, prices, and counts as digits, not number words. emitwalo kkumi means 100000.",
  "Keep every number that was spoken. Do not round. Keep personal names and place names exactly as spoken.",
  "Assume money is Uganda shillings (UGX) unless they clearly name another currency. Do not add facts they did not say.",
].join(" ");

const SOMALI_INSTRUCTION = [
  "The speaker chose Somali. They are a small business owner and may mix Somali with English words.",
  'Return only a JSON object with two string fields and no markdown: {"original":"...","english":"..."}',
  "original: the verbatim transcript in the language they spoke. Do not translate this field. Keep names as spoken.",
  "english: a faithful English translation of the whole utterance.",
  "In english, write amounts, prices, and counts as digits, not number words. kun means 1000. toban kun means 10000.",
  "Keep every number that was spoken. Do not round. Keep personal names and place names exactly as spoken.",
  "Assume money is Uganda shillings (UGX) unless they clearly name another currency. Do not add facts they did not say.",
].join(" ");

export function transcriptionInstruction(language: VoiceLanguage): string {
  if (language === "lg") return LUGANDA_INSTRUCTION;
  if (language === "so") return SOMALI_INSTRUCTION;
  return ENGLISH_INSTRUCTION;
}

export function parseVoiceTranscript(language: VoiceLanguage, raw: string): VoiceTranscript {
  const text = raw.trim();
  if (language === "en") {
    if (!text) throw new TranscriptParseError();
    return { language, original: text, english: text };
  }

  let json: unknown;
  try {
    json = parseModelJson(text);
  } catch {
    throw new TranscriptParseError();
  }

  const parsed = bilingualSchema.safeParse(json);
  if (!parsed.success) throw new TranscriptParseError();
  return { language, original: parsed.data.original, english: parsed.data.english };
}
