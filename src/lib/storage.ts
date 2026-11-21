import { buildDemoTransactions } from "./demo-data";
import { TRANSACTION_TYPES, type LedgerEntry, type TransactionType } from "./types";

export const LEDGER_KEY = "kaalbiz.ledger.v1";
export const LEDGER_EVENT = "kaalbiz:ledger";

function isType(value: unknown): value is TransactionType {
  return typeof value === "string" && TRANSACTION_TYPES.includes(value as TransactionType);
}

function isEntry(value: unknown): value is LedgerEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<LedgerEntry>;
  return (
    typeof entry.id === "string" &&
    isType(entry.type) &&
    typeof entry.amount === "number" &&
    Number.isFinite(entry.amount) &&
    typeof entry.date === "string" &&
    typeof entry.description === "string" &&
    typeof entry.category === "string" &&
    typeof entry.createdAt === "string" &&
    (entry.counterparty === null || typeof entry.counterparty === "string")
  );
}

export function parseLedger(raw: string | null): LedgerEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry).map((entry) => ({
      ...entry,
      currency: "UGX",
      confidence: typeof entry.confidence === "number" ? entry.confidence : 1,
      notes: typeof entry.notes === "string" ? entry.notes : null,
      source: entry.source === "ai" || entry.source === "sample" ? entry.source : "demo",
      isSample: Boolean(entry.isSample),
    }));
  } catch {
    return [];
  }
}

export function loadLedger(): LedgerEntry[] {
  if (typeof window === "undefined") return [];
  return parseLedger(window.localStorage.getItem(LEDGER_KEY));
}

export function saveLedger(entries: LedgerEntry[]): void {
  window.localStorage.setItem(LEDGER_KEY, JSON.stringify(entries));
  window.dispatchEvent(new Event(LEDGER_EVENT));
}

export function withDemoData(existing: LedgerEntry[], today: string): LedgerEntry[] {
  return [...existing.filter((entry) => !entry.isSample), ...buildDemoTransactions(today)];
}
