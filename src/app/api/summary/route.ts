import { z } from "zod";
import { summarizeDay } from "@/lib/ai/extract";
import { isIsoDate } from "@/lib/dates";
import { TRANSACTION_TYPES, type LedgerEntry } from "@/lib/types";

const entrySchema = z.object({
  id: z.string().min(1),
  type: z.enum(TRANSACTION_TYPES),
  amount: z.number().finite(),
  currency: z.string().optional(),
  date: z.string(),
  description: z.string(),
  category: z.string(),
  counterparty: z.string().nullable().optional(),
  confidence: z.number().optional(),
  notes: z.string().nullable().optional(),
  source: z.enum(["ai", "demo", "sample"]).optional(),
  isSample: z.boolean().optional(),
  createdAt: z.string(),
});

const bodySchema = z.object({
  date: z.string().refine(isIsoDate, "Use a real date."),
  transactions: z.array(entrySchema).max(500),
});

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ message: "Send a JSON body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ message: "Could not read the day's records." }, { status: 400 });
  }

  const transactions: LedgerEntry[] = parsed.data.transactions
    .filter((tx) => isIsoDate(tx.date) && tx.amount > 0)
    .map((tx) => ({
      id: tx.id,
      type: tx.type,
      amount: Math.round(tx.amount),
      currency: "UGX",
      date: tx.date,
      description: tx.description,
      category: tx.category,
      counterparty: tx.counterparty ?? null,
      confidence: tx.confidence ?? 1,
      notes: tx.notes ?? null,
      source: tx.source ?? "demo",
      isSample: Boolean(tx.isSample),
      createdAt: tx.createdAt,
    }));

  const result = await summarizeDay(transactions, parsed.data.date);
  return Response.json(result);
}
