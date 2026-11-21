import { addDays } from "./dates";
import type { ExtractedTransaction, TransactionType } from "./types";

const MONEY_SOURCE =
  "(?:(?:ugx|ush|u\\s?sh|shs|shillings?)\\s*)?(\\d{1,3}(?:,\\d{3})+|\\d+(?:\\.\\d+)?)(\\s*[kKmM]\\b)?(?:\\s*(?:ugx|ush|shs|shillings?|\\/[=]))?";

const QUANTITY_AFTER =
  /^\s*(?:bags?|bottles?|pieces?|pcs|kgs?|kilograms?|litres?|liters?|plates?|cups?|tins?|crates?|boxes?|packets?|sachets?|rolls?|pairs?|dozens?|eggs?|chapati(?:s)?|rolex(?:es)?)\b/i;

const NAME_STOP = new Set([
  "cash",
  "credit",
  "today",
  "yesterday",
  "tomorrow",
  "the",
  "shop",
  "market",
  "stock",
  "sugar",
  "rice",
  "rent",
  "airtime",
  "supplier",
  "customer",
  "paid",
  "sale",
  "sold",
]);

interface MoneyHit {
  amount: number;
  before: string;
  kind: "owes" | "paid" | "total" | "other";
}

function shorten(text: string): string {
  const clean = text.replace(/\s+/g, " ").replace(/[.]+$/g, "").trim();
  return clean.length > 120 ? `${clean.slice(0, 117)}…` : clean;
}

function scaleAmount(value: number, suffix?: string): number {
  const mark = suffix?.trim().toLowerCase();
  if (mark === "k") return Math.round(value * 1_000);
  if (mark === "m") return Math.round(value * 1_000_000);
  return Math.round(value);
}

function contextKind(before: string): MoneyHit["kind"] {
  const text = before.toLowerCase();
  if (/\b(owes?|owing|unpaid|borrowed|on credit)\b/.test(text)) return "owes";
  if (/\b(paid|cash|momo|received)\b/.test(text)) return "paid";
  if (/\b(for|worth|total|costing|price)\b/.test(text)) return "total";
  return "other";
}

function findMoney(clause: string): MoneyHit[] {
  const expression = new RegExp(MONEY_SOURCE, "gi");
  const hits: MoneyHit[] = [];
  for (const match of clause.matchAll(expression)) {
    const num = match[1];
    const suffix = match[2];
    if (!num || match.index === undefined) continue;
    const hasSuffix = Boolean(suffix?.trim());
    const hasCurrency = /ugx|ush|shs|shilling|\/=/i.test(match[0]);
    const numeric = Number(num.replace(/,/g, ""));
    const after = clause.slice(match.index + match[0].length);
    if (
      !hasSuffix &&
      !hasCurrency &&
      !num.includes(",") &&
      numeric < 100 &&
      QUANTITY_AFTER.test(after)
    ) {
      continue;
    }
    const amount = scaleAmount(numeric, suffix);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const before = clause.slice(Math.max(0, match.index - 40), match.index);
    hits.push({ amount, before, kind: contextKind(before) });
  }
  return hits;
}

function classifyClause(text: string): TransactionType {
  const t = text.toLowerCase();
  if (
    /\b(paid (?:me |us )?(?:back|their|his|her)|paid what (?:he|she|they) owed|of what (?:he|she|they) owed|cleared (?:their|his|her|the) balance|debt payment|instal+ments?)\b/.test(
      t,
    )
  ) {
    return "debt_payment_received";
  }
  if (/\bsupplier\b/.test(t) && /\b(paid|payment|settled)\b/.test(t)) {
    return "supplier_payment";
  }
  if (/\b(bought|buy|purchase|purchased|restock|stocked)\b/.test(t)) {
    return "purchase";
  }
  if (/\b(sold|sale)\b/.test(t)) return "sale";
  if (/\b(owes?|owing|on credit|borrowed)\b/.test(t)) return "debt_given";
  if (
    /\b(rent|airtime|transport|boda|salary|wages|electricity|umeme|yaka|water|nwsc|fuel|petrol|expense|spent)\b/.test(
      t,
    )
  ) {
    return "expense";
  }
  if (/\bpaid\b/.test(t)) return "expense";
  return "other";
}

function categoryFor(text: string, type: TransactionType): string {
  const t = text.toLowerCase();
  if (type === "debt_given" || type === "debt_payment_received") return "Customer credit";
  if (type === "supplier_payment") return "Suppliers";
  if (/\brent\b/.test(t)) return "Rent";
  if (/\b(airtime|data bundle|mtn|airtel)\b/.test(t)) return "Airtime";
  if (/\b(boda|transport|taxi|fuel|petrol)\b/.test(t)) return "Transport";
  if (/\b(electricity|umeme|yaka|water|nwsc)\b/.test(t)) return "Utilities";
  if (/\b(salon|braid|hair|nails)\b/.test(t)) return "Salon";
  if (/\b(dress|blouse|boutique|clothes|shirt)\b/.test(t)) return "Boutique";
  if (/\b(sugar|rice|posho|beans|flour|oil|soda|milk|bread|chapati|rolex|food|water)\b/.test(t)) {
    return type === "purchase" ? "Stock" : "Food and groceries";
  }
  if (/\b(stock|goods|nails|cement|hardware)\b/.test(t)) return "Stock";
  if (type === "sale") return "Sales";
  if (type === "purchase") return "Stock";
  if (type === "expense") return "Costs";
  return "Other";
}

function titleName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function cleanName(raw: string | undefined): string | null {
  if (!raw) return null;
  const words = raw
    .trim()
    .split(/\s+/)
    .filter((word) => !NAME_STOP.has(word.toLowerCase()) && word.toLowerCase() !== "for");
  if (words.length === 0) return null;
  return titleName(words.slice(0, 3).join(" "));
}

function extractCounterparty(text: string): string | null {
  const patterns = [
    /\b(?:to|from)\s+((?:mama|uncle|auntie|aunt|mr|mrs|ms|hajji|hajjat)\s+[a-z]+)/i,
    /\b(?:to|from)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/,
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:paid|owes|owe)\b/,
    /\b((?:mama|uncle|auntie|aunt)\s+[a-z]+)\b/i,
  ];
  for (const pattern of patterns) {
    const name = cleanName(text.match(pattern)?.[1]);
    if (name) return name;
  }
  return null;
}

function resolveDate(clause: string, full: string, clientDate: string): string {
  const local = clause.toLowerCase();
  if (/\byesterday\b/.test(local)) return addDays(clientDate, -1);
  if (/\btoday\b/.test(local)) return clientDate;
  if (/\btomorrow\b/.test(local)) return addDays(clientDate, 1);
  const whole = full.toLowerCase();
  if (/\byesterday\b/.test(whole) && !/\btoday\b/.test(whole)) {
    return addDays(clientDate, -1);
  }
  return clientDate;
}

function make(
  clause: string,
  full: string,
  clientDate: string,
  fields: {
    type: TransactionType;
    amount: number;
    description: string;
    confidence: number;
    notes: string;
  },
): ExtractedTransaction {
  return {
    type: fields.type,
    amount: fields.amount,
    currency: "UGX",
    date: resolveDate(clause, full, clientDate),
    description: fields.description,
    category: categoryFor(clause, fields.type),
    counterparty: extractCounterparty(clause),
    confidence: fields.confidence,
    notes: fields.notes,
  };
}

const CHECK = "Rule-based guess. Please check the amount and the type.";

function fromClause(
  clause: string,
  full: string,
  clientDate: string,
): ExtractedTransaction[] {
  const hits = findMoney(clause);
  if (hits.length === 0) return [];
  const type = classifyClause(clause);
  const base = shorten(clause);

  if (type === "sale" && hits.some((hit) => hit.kind === "paid") && hits.some((hit) => hit.kind === "owes")) {
    const paid = hits
      .filter((hit) => hit.kind === "paid")
      .reduce((sum, hit) => sum + hit.amount, 0);
    const owed = hits
      .filter((hit) => hit.kind === "owes")
      .reduce((sum, hit) => sum + hit.amount, 0);
    const rows: ExtractedTransaction[] = [];
    if (paid > 0) {
      rows.push(
        make(clause, full, clientDate, {
          type: "sale",
          amount: paid,
          description: `Cash received: ${base}`,
          confidence: 0.58,
          notes: `Split into cash received and the amount still owed. ${CHECK}`,
        }),
      );
    }
    if (owed > 0) {
      rows.push(
        make(clause, full, clientDate, {
          type: "debt_given",
          amount: owed,
          description: `Still owed: ${base}`,
          confidence: 0.58,
          notes: `This is the part the customer has not paid. ${CHECK}`,
        }),
      );
    }
    return rows;
  }

  if (hits.length === 1) {
    const hit = hits[0];
    const localType = type === "sale" && hit.kind === "owes" ? "debt_given" : type;
    return [
      make(clause, full, clientDate, {
        type: localType,
        amount: hit.amount,
        description: base,
        confidence: localType === "other" ? 0.4 : 0.66,
        notes:
          localType === "other"
            ? "Could not tell what kind of record this is. Please choose a type."
            : CHECK,
      }),
    ];
  }

  return hits.map((hit) => {
    let localType = type;
    if (hit.kind === "owes") localType = "debt_given";
    return make(clause, full, clientDate, {
      type: localType,
      amount: hit.amount,
      description: base,
      confidence: 0.48,
      notes: `Several amounts were in one sentence. Please check each one. ${CHECK}`,
    });
  });
}

function splitClauses(text: string): string[] {
  return text
    .split(/\n+|;+|(?<=[.!?])\s+|\bthen\b/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function parseTransactions(text: string, clientDate: string): ExtractedTransaction[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  return splitClauses(trimmed).flatMap((clause) => fromClause(clause, trimmed, clientDate));
}
