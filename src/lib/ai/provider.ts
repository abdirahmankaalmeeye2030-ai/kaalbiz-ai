/**
 * The only module that talks to the model provider.
 * Swap OpenRouter for another OpenAI-compatible API by editing this file.
 */

export const DEFAULT_TEXT_MODEL = "x-ai/grok-4.3";
export const DEFAULT_VISION_MODEL = "google/gemini-2.5-flash";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function isAiConfigured(): boolean {
  return Boolean(readEnv("OPENROUTER_API_KEY"));
}

export function textModel(): string {
  return readEnv("OPENROUTER_MODEL") ?? DEFAULT_TEXT_MODEL;
}

export function visionModel(): string {
  return readEnv("OPENROUTER_VISION_MODEL") ?? DEFAULT_VISION_MODEL;
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super("OPENROUTER_API_KEY is not set");
    this.name = "AiNotConfiguredError";
  }
}

export class AiRequestError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "AiRequestError";
    this.status = status;
  }
}

export type ChatContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | {
          type: "image_url";
          image_url: { url: string; detail?: "low" | "high" | "auto" };
        }
    >;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: ChatContent;
}

function providerMessage(status: number, body: string): string {
  let detail = "";
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } | string };
    if (typeof parsed.error === "string") detail = parsed.error;
    else if (parsed.error && typeof parsed.error.message === "string") {
      detail = parsed.error.message;
    }
  } catch {
    detail = body;
  }
  const clean = detail.replace(/Bearer\s+\S+/gi, "Bearer [redacted]").replace(/\s+/g, " ").trim();
  const clipped = clean.slice(0, 160);
  return clipped
    ? `OpenRouter returned ${status}. ${clipped}`
    : `OpenRouter returned ${status}.`;
}

function readContent(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const choice = (data as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0];
  const content = choice?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
          return part.text;
        }
        return "";
      })
      .join("\n");
  }
  return "";
}

async function postChat(
  key: string,
  referer: string,
  body: unknown,
  timeoutMs: number,
): Promise<Response> {
  return fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": referer,
      "X-Title": "KaalBiz AI",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

export async function completeChat(options: {
  model: string;
  messages: ChatMessage[];
  timeoutMs?: number;
}): Promise<string> {
  const key = readEnv("OPENROUTER_API_KEY");
  if (!key) throw new AiNotConfiguredError();

  const referer = readEnv("OPENROUTER_SITE_URL") ?? "http://localhost:38471";
  const timeoutMs = options.timeoutMs ?? 50_000;
  const base = {
    model: options.model,
    messages: options.messages,
    temperature: 0,
    max_tokens: 2500,
  };

  let response = await postChat(
    key,
    referer,
    { ...base, response_format: { type: "json_object" } },
    timeoutMs,
  );

  if (response.status === 400) {
    response = await postChat(key, referer, base, timeoutMs);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new AiRequestError(providerMessage(response.status, body), response.status);
  }

  const text = readContent(await response.json());
  if (!text.trim()) throw new AiRequestError("The model returned an empty response.");
  return text;
}

export function safeErrorMessage(error: unknown): string {
  if (error instanceof AiNotConfiguredError) return "No AI key is set.";
  const raw = error instanceof Error ? error.message : "The AI call failed.";
  if (error instanceof Error && error.name === "TimeoutError") {
    return "The AI took too long to answer.";
  }
  return raw.replace(/Bearer\s+\S+/gi, "Bearer [redacted]").slice(0, 180);
}
