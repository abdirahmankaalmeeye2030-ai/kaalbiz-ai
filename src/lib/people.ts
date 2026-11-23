import { daysBetween, isIsoDate } from "./dates";
import type { DraftTransaction, LedgerEntry, TransactionType } from "./types";

export interface Contact {
  name: string;
  phone: string | null;
  location: string | null;
  kind: "customer" | "supplier";
}

export type DueUrgency = "overdue" | "soon" | "later" | "unset";

export interface DebtAccount {
  name: string;
  balance: number;
  phone: string | null;
  location: string | null;
  dueDate: string | null;
  agreedAmount: number | null;
  urgency: DueUrgency;
}

export function normalizeUgandaPhone(raw: string): string | null {
  const compact = raw.trim().replace(/[\s()-]/g, "");
  if (!compact) return null;
  const digits = compact.replace(/^\+/, "");
  if (!/^\d+$/.test(digits)) return null;
  let national = "";
  if (digits.length === 10 && digits.startsWith("07")) national = digits.slice(1);
  else if (digits.length === 12 && digits.startsWith("2567")) national = digits.slice(3);
  else return null;
  if (!/^7\d{8}$/.test(national)) return null;
  return `+256${national}`;
}

export function normalizeStaff(names: string[]): string[] {
  const unique: string[] = [];
  for (const name of names) {
    const trimmed = name.trim().replace(/\s+/g, " ");
    if (!trimmed) continue;
    if (unique.some((item) => item.toLowerCase() === trimmed.toLowerCase())) continue;
    unique.push(trimmed);
  }
  return unique.length > 0 ? unique : ["Owner"];
}

export function matchStaff(name: string | null | undefined, staff: string[]): string | null {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  return staff.find((person) => person.toLowerCase() === trimmed.toLowerCase()) ?? null;
}

export function dueUrgency(dueDate: string | null | undefined, today: string): DueUrgency {
  if (!dueDate || !isIsoDate(dueDate)) return "unset";
  if (dueDate < today) return "overdue";
  if (daysBetween(today, dueDate) <= 3) return "soon";
  return "later";
}

export interface ConfirmFieldErrors {
  recordedBy?: string;
  counterparty?: string;
  phone?: string;
  location?: string;
  dueDate?: string;
  agreedAmount?: string;
  amount?: string;
  description?: string;
  date?: string;
}

const CREDIT_TYPES = new Set<TransactionType>(["debt_given", "supplier_debt"]);
const NAMED_PAYMENT_TYPES = new Set<TransactionType>(["debt_payment_received", "supplier_payment"]);

export function confirmFieldErrors(draft: DraftTransaction, staff: string[]): ConfirmFieldErrors {
  const errors: ConfirmFieldErrors = {};
  if (!(draft.amount > 0)) errors.amount = "Enter an amount above 0.";
  if (!draft.description.trim()) errors.description = "Say what happened.";
  if (!isIsoDate(draft.date)) errors.date = "Choose a date.";
  if (!matchStaff(draft.recordedBy, staff)) errors.recordedBy = "Choose who recorded this.";

  if (CREDIT_TYPES.has(draft.type) || NAMED_PAYMENT_TYPES.has(draft.type)) {
    if (!draft.counterparty?.trim()) {
      errors.counterparty = CREDIT_TYPES.has(draft.type) ? "Enter their name." : "Choose who this payment is for.";
    }
  }

  if (CREDIT_TYPES.has(draft.type)) {
    if (!normalizeUgandaPhone(draft.phone ?? "")) {
      errors.phone = "Use a Uganda number, 07XXXXXXXX or +2567XXXXXXXX.";
    }
    if (!draft.location?.trim()) errors.location = "Enter a location.";
    if (!isIsoDate(draft.dueDate ?? "")) errors.dueDate = "Choose the agreed pay date.";
    const agreed = draft.agreedAmount ?? 0;
    if (!(agreed > 0) || agreed > draft.amount) {
      errors.agreedAmount = "Agreed pay amount must be more than 0 and not more than the amount owed.";
    }
  }
  return errors;
}

export function customerDebts(entries: LedgerEntry[], today: string): DebtAccount[] {
  return debtAccounts(entries, "debt_given", "debt_payment_received", today);
}

export function supplierDebts(entries: LedgerEntry[], today: string): DebtAccount[] {
  return debtAccounts(entries, "supplier_debt", "supplier_payment", today);
}

export function salesByPerson(entries: LedgerEntry[]): { name: string; amount: number }[] {
  const totals = new Map<string, number>();
  for (const entry of entries) {
    if (entry.type !== "sale") continue;
    const name = entry.recordedBy?.trim() || "Not set";
    totals.set(name, (totals.get(name) ?? 0) + Math.round(entry.amount));
  }
  return [...totals.entries()]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
}

export function suggestContact(name: string, contacts: Contact[]): Contact | null {
  const trimmed = name.trim().toLowerCase();
  if (!trimmed) return null;
  return (
    contacts.find((contact) => contact.name.toLowerCase() === trimmed) ??
    contacts.find((contact) => contact.name.toLowerCase().startsWith(trimmed)) ??
    null
  );
}

function debtAccounts(
  entries: LedgerEntry[],
  debtType: TransactionType,
  paymentType: TransactionType,
  today: string,
): DebtAccount[] {
  const map = new Map<string, DebtAccount>();
  for (const entry of entries) {
    if (entry.type !== debtType && entry.type !== paymentType) continue;
    const name = entry.counterparty?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const current = map.get(key) ?? {
      name,
      balance: 0,
      phone: null,
      location: null,
      dueDate: null,
      agreedAmount: null,
      urgency: "unset",
    };
    current.balance += entry.type === debtType ? Math.round(entry.amount) : -Math.round(entry.amount);
    if (entry.type === debtType) {
      if (entry.phone) current.phone = entry.phone;
      if (entry.location?.trim()) current.location = entry.location.trim();
      if (entry.dueDate && isIsoDate(entry.dueDate)) {
        if (!current.dueDate || entry.dueDate < current.dueDate) current.dueDate = entry.dueDate;
      }
      if (entry.agreedAmount && entry.agreedAmount > 0) current.agreedAmount = Math.round(entry.agreedAmount);
    }
    map.set(key, current);
  }
  return [...map.values()]
    .filter((account) => account.balance > 0)
    .map((account) => ({ ...account, urgency: dueUrgency(account.dueDate, today) }))
    .sort((a, b) => (a.dueDate ?? "9999-99-99").localeCompare(b.dueDate ?? "9999-99-99") || a.name.localeCompare(b.name));
}
