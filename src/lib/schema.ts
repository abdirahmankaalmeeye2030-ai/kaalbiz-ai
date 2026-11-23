import { z } from "zod";
import { isIsoDate } from "./dates";
import type { ExtractedTransaction, TransactionType } from "./types";
import { TRANSACTION_TYPES } from "./types";

function coerceAmount(value: unknown): unknown {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return value;
  const cleaned = value.toLowerCase().replace(/ugx|ush|shs|shillings|,|\s/g, "");
  const match = cleaned.match(/^(\d+(?:\.\d+)?)([km])?$/);
  if (!match) return value;
  const numeric = Number(match[1]);
  if (!Number.isFinite(numeric)) return value;
  if (match[2] === "k") return Math.round(numeric * 1_000);
  if (match[2] === "m") return Math.round(numeric * 1_000_000);
  return Math.round(numeric);
}

function coerceConfidence(value: unknown): unknown {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : undefined;
  }
  return undefined;
}

function emptyToNull(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "null" || trimmed === "-") return null;
  return trimmed;
}

const extractedSchema = z.object({
  type: z.preprocess(
    (value) => (typeof value === "string" ? value.toLowerCase().trim() : value),
    z.enum(TRANSACTION_TYPES),
  ),
  amount: z.preprocess(coerceAmount, z.number()),
  currency: z.preprocess(emptyToNull, z.string().nullable().optional()),
  date: z.preprocess(emptyToNull, z.string().nullable().optional()),
  description: z.preprocess(emptyToNull, z.string().nullable().optional()),
  category: z.preprocess(emptyToNull, z.string().nullable().optional()),
  counterparty: z.preprocess(emptyToNull, z.string().nullable().optional()),
  confidence: z.preprocess(coerceConfidence, z.number().optional()),
  notes: z.preprocess(emptyToNull, z.string().nullable().optional()),
  recordedBy: z.preprocess(emptyToNull, z.string().nullable().optional()),
  phone: z.preprocess(emptyToNull, z.string().nullable().optional()),
  location: z.preprocess(emptyToNull, z.string().nullable().optional()),
  dueDate: z.preprocess(emptyToNull, z.string().nullable().optional()),
  agreedAmount: z.preprocess(coerceAmount, z.number().nullable().optional()),
});

const DEFAULT_CATEGORY: Record<TransactionType, string> = {
  sale: "Sales",
  expense: "Costs",
  purchase: "Stock",
  debt_given: "Customer credit",
  debt_payment_received: "Customer credit",
  supplier_payment: "Suppliers",
  supplier_debt: "Suppliers",
  other: "Other",
};

function cleanDateOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match && isIsoDate(match[1])) return match[1];
  return null;
}

function cleanDate(value: string | null | undefined, clientDate: string): string {
  if (!value) return clientDate;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match && isIsoDate(match[1])) return match[1];
  return clientDate;
}

export function parseModelJson(text: string): unknown {
  let source = text.trim();
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) source = fenced[1].trim();
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start >= 0 && end > start) source = source.slice(start, end + 1);
  return JSON.parse(source);
}

export function normalizeExtracted(
  input: unknown,
  clientDate: string,
  confidenceDefault = 0.8,
): ExtractedTransaction[] {
  const wrapped = z
    .object({ transactions: z.array(z.unknown()).optional() })
    .safeParse(input);
  const items = Array.isArray(input)
    ? input
    : wrapped.success
      ? (wrapped.data.transactions ?? [])
      : [];

  const transactions: ExtractedTransaction[] = [];
  for (const item of items) {
    const parsed = extractedSchema.safeParse(item);
    if (!parsed.success) continue;
    const amount = Math.round(parsed.data.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 2_000_000_000) continue;
    const confidenceRaw = parsed.data.confidence ?? confidenceDefault;
    const confidence = Math.min(1, Math.max(0, confidenceRaw));
    transactions.push({
      type: parsed.data.type,
      amount,
      currency: "UGX",
      date: cleanDate(parsed.data.date, clientDate),
      description: (parsed.data.description ?? "Transaction").slice(0, 180),
      category: (parsed.data.category ?? DEFAULT_CATEGORY[parsed.data.type]).slice(0, 40),
      counterparty: parsed.data.counterparty ?? null,
      recordedBy: parsed.data.recordedBy ?? null,
      phone: parsed.data.phone ?? null,
      location: parsed.data.location ?? null,
      dueDate: cleanDateOrNull(parsed.data.dueDate),
      agreedAmount:
        parsed.data.agreedAmount && parsed.data.agreedAmount > 0
          ? Math.round(parsed.data.agreedAmount)
          : null,
      confidence,
      notes: parsed.data.notes ? parsed.data.notes.slice(0, 240) : null,
    });
  }
  return transactions;
}

export const summarySchema = z.object({
  summary: z.string().trim().min(1).max(800),
  tips: z.array(z.string().trim().min(1).max(240)).min(1).max(4),
});
