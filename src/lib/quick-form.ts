import { isIsoDate } from "./dates";
import { matchStaff, normalizeUgandaPhone } from "./people";
import type { ExtractedTransaction, PaymentMethod, TransactionType } from "./types";
import { PAYMENT_METHODS } from "./types";

export const QUICK_TYPES = [
  "sale",
  "purchase",
  "expense",
  "debt_given",
  "supplier_debt",
  "debt_payment_received",
  "supplier_payment",
] as const;

export type QuickType = (typeof QUICK_TYPES)[number];

export const QUICK_TYPE_LABELS: Record<QuickType, string> = {
  sale: "Sale",
  purchase: "Stock bought",
  expense: "Expense",
  debt_given: "Money owed to me",
  supplier_debt: "Money I owe",
  debt_payment_received: "Old debt paid",
  supplier_payment: "Money I paid a supplier",
};

export { PAYMENT_METHODS };
export type { PaymentMethod };

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  mobile_money: "Mobile money",
};

const CATEGORY: Record<QuickType, string> = {
  sale: "Sales",
  purchase: "Stock",
  expense: "Costs",
  debt_given: "Customer credit",
  supplier_debt: "Suppliers",
  debt_payment_received: "Customer credit",
  supplier_payment: "Suppliers",
};

export function parsePaymentMethod(value: unknown): PaymentMethod | null {
  return PAYMENT_METHODS.includes(value as PaymentMethod) ? (value as PaymentMethod) : null;
}

export function groupDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function amountFromGrouped(raw: string): number {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return 0;
  const value = Number(digits);
  if (!Number.isFinite(value) || value <= 0 || value > 2_000_000_000) return 0;
  return Math.round(value);
}

export function lineTotal(quantity: number, unitPrice: number): number {
  const qty = Math.round(quantity);
  const price = Math.round(unitPrice);
  if (!(qty > 0) || !(price > 0)) return 0;
  const total = qty * price;
  if (!Number.isFinite(total) || total <= 0 || total > 2_000_000_000) return 0;
  return total;
}

export function priceLine(quantity: number, unitPrice: number, amount: number): string | null {
  const computed = lineTotal(quantity, unitPrice);
  if (!computed) return null;
  const formula = `${Math.round(quantity)} × ${groupDigits(String(Math.round(unitPrice)))} = ${groupDigits(String(computed))}`;
  if (computed === Math.round(amount)) return formula;
  return `${formula}. Total kept at ${groupDigits(String(Math.round(amount)))} because that was edited last.`;
}

export function reviewPriceNote(unitPrice: number, amount: number): string {
  const price = Math.round(unitPrice);
  const total = Math.round(amount);
  if (!(price > 0)) return "";
  if (total > 0 && total % price === 0) {
    return priceLine(total / price, price, total) ?? `Unit price ${groupDigits(String(price))}`;
  }
  return `Unit price ${groupDigits(String(price))}. Total is ${groupDigits(String(total))}.`;
}

export function parseUnitPrice(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 2_000_000_000) return null;
  return Math.round(value);
}

export interface QuickDraftInput {
  type: QuickType;
  item: string;
  quantity: number;
  amount: number;
  unitPrice: number;
  paymentMethod: PaymentMethod | null;
  recordedBy: string;
  name: string;
  phone: string;
  location: string;
  dueDate: string;
  agreedAmount: number;
  today: string;
  staff: string[];
}

const ITEM_TYPES = new Set<TransactionType>(["sale", "purchase", "expense", "debt_given", "supplier_debt"]);
const CREDIT_TYPES = new Set<TransactionType>(["debt_given", "supplier_debt"]);
const PAYMENT_TYPES = new Set<TransactionType>(["debt_payment_received", "supplier_payment"]);

export function quickFieldErrors(input: QuickDraftInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!matchStaff(input.recordedBy, input.staff)) errors.recordedBy = "Choose who recorded this.";
  if (!(input.amount > 0)) errors.amount = "Enter an amount above 0.";
  if (ITEM_TYPES.has(input.type) && !input.item.trim()) {
    errors.item = input.type === "expense" ? "Say what the cost was." : "Enter the item.";
  }
  if ((input.type === "sale" || input.type === "purchase") && !(input.quantity > 0)) {
    errors.quantity = "Enter a quantity.";
  }
  if (input.type === "sale" && !input.paymentMethod) errors.paymentMethod = "Choose cash or mobile money.";
  if (CREDIT_TYPES.has(input.type) || PAYMENT_TYPES.has(input.type)) {
    if (!input.name.trim()) errors.name = CREDIT_TYPES.has(input.type) ? "Enter their name." : "Choose who this payment is for.";
  }
  if (CREDIT_TYPES.has(input.type)) {
    if (!normalizeUgandaPhone(input.phone)) errors.phone = "Use a Uganda number, 07XXXXXXXX or +2567XXXXXXXX.";
    if (!input.location.trim()) errors.location = "Enter a location.";
    if (!isIsoDate(input.dueDate)) errors.dueDate = "Choose the agreed pay date.";
    if (!(input.agreedAmount > 0) || input.agreedAmount > input.amount) {
      errors.agreedAmount = "Agreed pay amount must be more than 0 and not more than the amount owed.";
    }
  }
  return errors;
}

export function quickFormEntry(input: QuickDraftInput): ExtractedTransaction | null {
  if (Object.keys(quickFieldErrors(input)).length > 0) return null;
  const item = input.item.trim();
  const named = input.name.trim();
  let description = item;
  if ((input.type === "sale" || input.type === "purchase") && input.quantity > 1) {
    description = `${input.quantity} ${item}`;
  }
  if (input.type === "debt_payment_received") description = `${named} paid an old debt`;
  if (input.type === "supplier_payment") description = `Paid ${named}`;
  const credit = CREDIT_TYPES.has(input.type);
  const payment = PAYMENT_TYPES.has(input.type);
  return {
    type: input.type,
    amount: Math.round(input.amount),
    currency: "UGX",
    date: input.today,
    description: description.slice(0, 180),
    category: CATEGORY[input.type],
    counterparty: credit || payment ? named : null,
    confidence: 1,
    notes: null,
    recordedBy: matchStaff(input.recordedBy, input.staff),
    phone: credit ? normalizeUgandaPhone(input.phone) : null,
    location: credit ? input.location.trim() : null,
    dueDate: credit ? input.dueDate : null,
    agreedAmount: credit ? Math.round(input.agreedAmount) : null,
    paymentMethod: input.type === "sale" ? input.paymentMethod : null,
    unitPrice: input.type === "sale" || input.type === "purchase" ? parseUnitPrice(input.unitPrice) : null,
  };
}
