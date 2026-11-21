import { describe, expect, it } from "vitest";
import {
  computeTotals,
  filterTransactions,
  last7Days,
  outstandingByCustomer,
  recentTransactions,
} from "./calculations";
import { formatUgx } from "./money";
import type { LedgerEntry, TransactionType } from "./types";

function entry(partial: {
  id: string;
  type: TransactionType;
  amount: number;
  date: string;
  counterparty?: string | null;
  createdAt?: string;
}): LedgerEntry {
  return {
    id: partial.id,
    type: partial.type,
    amount: partial.amount,
    currency: "UGX",
    date: partial.date,
    description: partial.id,
    category: "Test",
    counterparty: partial.counterparty ?? null,
    confidence: 1,
    notes: null,
    source: "demo",
    isSample: false,
    createdAt: partial.createdAt ?? `${partial.date}T08:00:00.000Z`,
  };
}

describe("formatUgx", () => {
  it("formats whole shillings with commas and no decimals", () => {
    expect(formatUgx(25000)).toBe("UGX 25,000");
    expect(formatUgx(1_200_000)).toBe("UGX 1,200,000");
    expect(formatUgx(10.6)).toBe("UGX 11");
    expect(formatUgx(-1500)).toBe("−UGX 1,500");
  });
});

describe("computeTotals", () => {
  it("returns zeros for an empty ledger", () => {
    const totals = computeTotals([]);
    expect(totals).toMatchObject({
      sales: 0,
      expenses: 0,
      cashIn: 0,
      cashOut: 0,
      net: 0,
      outstanding: 0,
      count: 0,
    });
  });

  it("keeps sales, spending, cash, and other records apart", () => {
    const totals = computeTotals([
      entry({ id: "sale", type: "sale", amount: 10000, date: "2026-11-21" }),
      entry({
        id: "debt",
        type: "debt_given",
        amount: 5000,
        date: "2026-11-21",
        counterparty: "Mama Grace",
      }),
      entry({ id: "cost", type: "expense", amount: 2000, date: "2026-11-21" }),
      entry({ id: "stock", type: "purchase", amount: 8000, date: "2026-11-21" }),
      entry({ id: "supplier", type: "supplier_payment", amount: 4000, date: "2026-11-21" }),
      entry({
        id: "repay",
        type: "debt_payment_received",
        amount: 3000,
        date: "2026-11-21",
        counterparty: "Mama Grace",
      }),
      entry({ id: "other", type: "other", amount: 9999, date: "2026-11-21" }),
    ]);

    expect(totals.sales).toBe(10000);
    expect(totals.expenses).toBe(14000);
    expect(totals.cashIn).toBe(13000);
    expect(totals.cashOut).toBe(14000);
    expect(totals.net).toBe(-1000);
    expect(totals.outstanding).toBe(2000);
    expect(totals.count).toBe(7);
    expect(totals.byType.other).toBe(9999);
    expect(totals.sales).not.toBe(totals.sales + totals.byType.other);
  });
});

describe("outstandingByCustomer", () => {
  it("nets payments per person and ignores overpayment", () => {
    const rows = outstandingByCustomer([
      entry({
        id: "a1",
        type: "debt_given",
        amount: 10000,
        date: "2026-11-18",
        counterparty: "Mama Grace",
      }),
      entry({
        id: "a2",
        type: "debt_payment_received",
        amount: 15000,
        date: "2026-11-19",
        counterparty: "mama grace",
      }),
      entry({
        id: "b1",
        type: "debt_given",
        amount: 4000,
        date: "2026-11-19",
        counterparty: "Uncle John",
      }),
    ]);

    expect(rows).toEqual([{ counterparty: "Uncle John", amount: 4000 }]);
  });

  it("groups missing names as Unknown customer", () => {
    const rows = outstandingByCustomer([
      entry({ id: "u1", type: "debt_given", amount: 1000, date: "2026-11-21" }),
      entry({ id: "u2", type: "debt_given", amount: 2000, date: "2026-11-21" }),
    ]);
    expect(rows).toEqual([{ counterparty: "Unknown customer", amount: 3000 }]);
  });
});

describe("last7Days", () => {
  it("includes today and six days back, and drops the day before that", () => {
    const days = last7Days(
      [
        entry({ id: "old", type: "sale", amount: 999, date: "2026-11-14" }),
        entry({ id: "edge", type: "sale", amount: 500, date: "2026-11-15" }),
        entry({ id: "now", type: "sale", amount: 1000, date: "2026-11-21" }),
        entry({ id: "bill", type: "expense", amount: 200, date: "2026-11-21" }),
      ],
      "2026-11-21",
    );

    expect(days).toHaveLength(7);
    expect(days[0]).toMatchObject({ date: "2026-11-15", label: "Sun", sales: 500, cashOut: 0 });
    expect(days[1]).toMatchObject({ date: "2026-11-16", sales: 0, cashOut: 0 });
    expect(days[6]).toMatchObject({ date: "2026-11-21", label: "Sat", sales: 1000, cashOut: 200 });
    expect(days.some((day) => day.date === "2026-11-14")).toBe(false);
  });
});

describe("recentTransactions and filterTransactions", () => {
  const rows = [
    entry({
      id: "a",
      type: "sale",
      amount: 1,
      date: "2026-11-20",
      createdAt: "2026-11-20T10:00:00.000Z",
    }),
    entry({
      id: "b",
      type: "expense",
      amount: 2,
      date: "2026-11-21",
      createdAt: "2026-11-21T08:00:00.000Z",
    }),
    entry({
      id: "c",
      type: "sale",
      amount: 3,
      date: "2026-11-21",
      createdAt: "2026-11-21T09:00:00.000Z",
    }),
  ];

  it("sorts newest date, then newest time", () => {
    expect(recentTransactions(rows, 2).map((row) => row.id)).toEqual(["c", "b"]);
  });

  it("filters by type and date", () => {
    expect(
      filterTransactions(rows, { type: "sale", from: "2026-11-21", to: "2026-11-21" }).map(
        (row) => row.id,
      ),
    ).toEqual(["c"]);
  });
});
