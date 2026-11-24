export const TRANSACTION_TYPES = [
  "sale",
  "expense",
  "purchase",
  "debt_given",
  "debt_payment_received",
  "supplier_payment",
  "supplier_debt",
  "other",
] as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const PAYMENT_METHODS = ["cash", "mobile_money"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const LOW_CONFIDENCE_THRESHOLD = 0.7;

export interface ExtractedTransaction {
  type: TransactionType;
  amount: number;
  currency: string;
  date: string;
  description: string;
  category: string;
  counterparty: string | null;
  confidence: number;
  notes: string | null;
  recordedBy?: string | null;
  phone?: string | null;
  location?: string | null;
  dueDate?: string | null;
  agreedAmount?: number | null;
  paymentMethod?: PaymentMethod | null;
  unitPrice?: number | null;
  isSample?: boolean;
}

export interface DraftTransaction extends ExtractedTransaction {
  draftId: string;
  origin: "ai" | "demo" | "sample";
}

export interface LedgerEntry {
  id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  date: string;
  description: string;
  category: string;
  counterparty: string | null;
  confidence: number;
  notes: string | null;
  recordedBy?: string | null;
  phone?: string | null;
  location?: string | null;
  dueDate?: string | null;
  agreedAmount?: number | null;
  paymentMethod?: PaymentMethod | null;
  unitPrice?: number | null;
  source: "ai" | "demo" | "sample";
  isSample: boolean;
  createdAt: string;
  updatedAt?: string | null;
  deletedAt?: string | null;
}

export interface ExtractionResponse {
  source: "ai" | "demo";
  badge: string;
  model: string | null;
  reason?: "missing_key" | "ai_error";
  message?: string;
  needsKey?: boolean;
  transactions: ExtractedTransaction[];
}

export interface MoneyTotals {
  sales: number;
  expenses: number;
  cashIn: number;
  cashOut: number;
  net: number;
  outstanding: number;
  count: number;
  byType: Record<TransactionType, number>;
}

export interface DebtBalance {
  counterparty: string;
  amount: number;
}

export interface DayBucket {
  date: string;
  label: string;
  sales: number;
  cashOut: number;
}

export interface SummaryResponse {
  source: "ai" | "template";
  badge: string;
  model: string | null;
  message?: string;
  summary: string;
  tips: string[];
  totals: MoneyTotals;
  outstanding: number;
}

export interface HealthStatus {
  aiConfigured: boolean;
  provider: "openrouter";
  model: string;
  visionModel: string;
  mode: "ai" | "demo";
}
