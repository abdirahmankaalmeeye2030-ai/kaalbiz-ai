import { addDays, weekdayShort } from "./dates";
import type {
  DayBucket,
  DebtBalance,
  LedgerEntry,
  MoneyTotals,
  TransactionType,
} from "./types";
import { TRANSACTION_TYPES } from "./types";

function emptyByType(): Record<TransactionType, number> {
  return {
    sale: 0,
    expense: 0,
    purchase: 0,
    debt_given: 0,
    debt_payment_received: 0,
    supplier_payment: 0,
    other: 0,
  };
}

export function outstandingByCustomer(transactions: LedgerEntry[]): DebtBalance[] {
  const map = new Map<string, { label: string; amount: number }>();

  for (const tx of transactions) {
    if (tx.type !== "debt_given" && tx.type !== "debt_payment_received") continue;
    const label = tx.counterparty?.trim() || "Unknown customer";
    const key = label.toLowerCase();
    const current = map.get(key) ?? { label, amount: 0 };
    current.amount += tx.type === "debt_given" ? tx.amount : -tx.amount;
    map.set(key, current);
  }

  return [...map.values()]
    .filter((row) => row.amount > 0)
    .map((row) => ({ counterparty: row.label, amount: row.amount }))
    .sort(
      (a, b) => b.amount - a.amount || a.counterparty.localeCompare(b.counterparty),
    );
}

export function computeTotals(transactions: LedgerEntry[]): MoneyTotals {
  const byType = emptyByType();
  for (const tx of transactions) {
    if (!TRANSACTION_TYPES.includes(tx.type)) continue;
    byType[tx.type] += tx.amount;
  }

  const sales = byType.sale;
  const expenses = byType.expense + byType.purchase + byType.supplier_payment;
  const cashIn = byType.sale + byType.debt_payment_received;
  const cashOut = expenses;
  const net = cashIn - cashOut;
  const outstanding = outstandingByCustomer(transactions).reduce(
    (sum, row) => sum + row.amount,
    0,
  );

  return {
    sales,
    expenses,
    cashIn,
    cashOut,
    net,
    outstanding,
    count: transactions.length,
    byType,
  };
}

export function last7Days(transactions: LedgerEntry[], today: string): DayBucket[] {
  const days: DayBucket[] = [];
  for (let offset = -6; offset <= 0; offset += 1) {
    const date = addDays(today, offset);
    days.push({ date, label: weekdayShort(date), sales: 0, cashOut: 0 });
  }
  const index = new Map(days.map((day, i) => [day.date, i]));

  for (const tx of transactions) {
    const slot = index.get(tx.date);
    if (slot === undefined) continue;
    if (tx.type === "sale") days[slot].sales += tx.amount;
    if (
      tx.type === "expense" ||
      tx.type === "purchase" ||
      tx.type === "supplier_payment"
    ) {
      days[slot].cashOut += tx.amount;
    }
  }

  return days;
}

export function recentTransactions(
  transactions: LedgerEntry[],
  limit = 5,
): LedgerEntry[] {
  return [...transactions]
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
      return a.id < b.id ? 1 : -1;
    })
    .slice(0, limit);
}

export function filterTransactions(
  transactions: LedgerEntry[],
  filter: { type?: TransactionType | "all"; from?: string; to?: string },
): LedgerEntry[] {
  return transactions.filter((tx) => {
    if (filter.type && filter.type !== "all" && tx.type !== filter.type) return false;
    if (filter.from && tx.date < filter.from) return false;
    if (filter.to && tx.date > filter.to) return false;
    return true;
  });
}

export function sortTransactions(transactions: LedgerEntry[]): LedgerEntry[] {
  return recentTransactions(transactions, transactions.length);
}
