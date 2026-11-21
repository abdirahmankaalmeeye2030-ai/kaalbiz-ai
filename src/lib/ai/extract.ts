import { computeTotals, outstandingByCustomer } from "../calculations";
import { formatDisplayDate } from "../dates";
import { formatUgx } from "../money";
import { parseTransactions } from "../parser";
import { normalizeExtracted, parseModelJson, summarySchema } from "../schema";
import { templateSummary } from "../summary-template";
import type { ExtractionResponse, LedgerEntry, SummaryResponse } from "../types";
import { TYPE_LABELS } from "../labels";
import {
  completeChat,
  isAiConfigured,
  safeErrorMessage,
  textModel,
  visionModel,
} from "./provider";
import {
  extractionSystemPrompt,
  receiptSystemPrompt,
  summarySystemPrompt,
  summaryUserPrompt,
} from "./prompts";

export const DEMO_BADGE = "Demo mode: rule-based parser, not real AI";
export const TEMPLATE_BADGE = "Demo mode: template summary, not real AI";

export function aiExtractedBadge(model: string): string {
  return `AI extracted · ${model}`;
}

export function aiWrittenBadge(model: string): string {
  return `AI written · ${model}`;
}

function sampleReceipt(clientDate: string) {
  return {
    type: "purchase" as const,
    amount: 24000,
    currency: "UGX",
    date: clientDate,
    description: "Sample only: 2 crates of soda (not read from your photo)",
    category: "Stock",
    counterparty: "Sample supplier",
    confidence: 0.2,
    notes: "Sample receipt. This was not read from your photo.",
    isSample: true,
  };
}

export async function extractText(text: string, clientDate: string): Promise<ExtractionResponse> {
  const fallback = parseTransactions(text, clientDate);
  if (!isAiConfigured()) {
    return {
      source: "demo",
      badge: DEMO_BADGE,
      model: null,
      reason: "missing_key",
      message: "No AI key is set, so this used the rule-based parser.",
      transactions: fallback,
    };
  }

  const model = textModel();
  try {
    const raw = await completeChat({
      model,
      messages: [
        { role: "system", content: extractionSystemPrompt(clientDate) },
        { role: "user", content: text },
      ],
    });
    return {
      source: "ai",
      badge: aiExtractedBadge(model),
      model,
      transactions: normalizeExtracted(parseModelJson(raw), clientDate),
    };
  } catch (error) {
    return {
      source: "demo",
      badge: DEMO_BADGE,
      model,
      reason: "ai_error",
      message: `The AI call failed, so this used the rule-based parser. ${safeErrorMessage(error)}`,
      transactions: fallback,
    };
  }
}

export async function extractReceipt(
  imageBase64: string,
  mimeType: string,
  clientDate: string,
): Promise<ExtractionResponse> {
  if (!isAiConfigured()) {
    return {
      source: "demo",
      badge: DEMO_BADGE,
      model: null,
      reason: "missing_key",
      needsKey: true,
      message:
        "Receipt reading needs an AI key (OPENROUTER_API_KEY). This photo was not read. The card below is a labelled sample, not your receipt.",
      transactions: [sampleReceipt(clientDate)],
    };
  }

  const model = visionModel();
  try {
    const raw = await completeChat({
      model,
      timeoutMs: 70_000,
      messages: [
        { role: "system", content: receiptSystemPrompt(clientDate) },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: "high" },
            },
            { type: "text", text: "Read this receipt and return the JSON transactions." },
          ],
        },
      ],
    });
    return {
      source: "ai",
      badge: aiExtractedBadge(model),
      model,
      transactions: normalizeExtracted(parseModelJson(raw), clientDate),
    };
  } catch (error) {
    return {
      source: "demo",
      badge: DEMO_BADGE,
      model,
      reason: "ai_error",
      needsKey: false,
      message: `Receipt reading failed, so the photo was not read. ${safeErrorMessage(error)}`,
      transactions: [],
    };
  }
}

export async function summarizeDay(
  transactions: LedgerEntry[],
  date: string,
): Promise<SummaryResponse> {
  const day = transactions.filter((tx) => tx.date === date);
  const totals = computeTotals(day);
  const outstanding = computeTotals(transactions).outstanding;
  const topDebtor = outstandingByCustomer(transactions)[0] ?? null;
  const written = templateSummary({
    dateLabel: formatDisplayDate(date),
    totals,
    outstanding,
    topDebtor,
  });

  if (!isAiConfigured()) {
    return {
      source: "template",
      badge: TEMPLATE_BADGE,
      model: null,
      message: "No AI key is set, so this summary was written from a template.",
      ...written,
      totals,
      outstanding,
    };
  }

  const model = textModel();
  try {
    const lines = day.map((tx) => {
      const who = tx.counterparty ? ` with ${tx.counterparty}` : "";
      return `${TYPE_LABELS[tx.type]}: ${formatUgx(tx.amount)} — ${tx.description}${who}`;
    });
    const raw = await completeChat({
      model,
      messages: [
        { role: "system", content: summarySystemPrompt() },
        {
          role: "user",
          content: summaryUserPrompt({
            dateLabel: formatDisplayDate(date),
            sales: totals.sales,
            expenses: totals.expenses,
            cashIn: totals.cashIn,
            cashOut: totals.cashOut,
            net: totals.net,
            outstanding,
            lines,
          }),
        },
      ],
    });
    const parsed = summarySchema.parse(parseModelJson(raw));
    return {
      source: "ai",
      badge: aiWrittenBadge(model),
      model,
      summary: parsed.summary,
      tips: parsed.tips.slice(0, 3),
      totals,
      outstanding,
    };
  } catch (error) {
    return {
      source: "template",
      badge: TEMPLATE_BADGE,
      model,
      message: `The AI call failed, so this is a template summary. ${safeErrorMessage(error)}`,
      ...written,
      totals,
      outstanding,
    };
  }
}
