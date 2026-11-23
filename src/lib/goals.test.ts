import { describe, expect, it } from "vitest";
import {
  evaluateGoals,
  expectedByPace,
  goalSummaryLine,
  goalWindow,
  roundDailyPace,
  suggestGoals,
  type GoalSettings,
} from "./goals";
import type { LedgerEntry, TransactionType } from "./types";

function entry(partial: {
  id: string;
  type: TransactionType;
  amount: number;
  date: string;
  counterparty?: string | null;
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
    createdAt: `${partial.date}T08:00:00.000Z`,
  };
}

const period: GoalSettings = {
  startDate: "2026-11-01",
  endDate: "2026-11-30",
  sellAtLeast: 3_000_000,
  spendAtMost: 600_000,
  oweLessThan: 100_000,
  paySuppliers: 400_000,
};

const books: LedgerEntry[] = [
  entry({ id: "sale-in", type: "sale", amount: 1_200_000, date: "2026-11-10" }),
  entry({ id: "sale-out", type: "sale", amount: 9_000_000, date: "2026-12-02" }),
  entry({ id: "cost", type: "expense", amount: 200_000, date: "2026-11-12" }),
  entry({ id: "stock", type: "purchase", amount: 800_000, date: "2026-11-12", counterparty: "Mukwano" }),
  entry({ id: "supplier", type: "supplier_payment", amount: 150_000, date: "2026-11-18", counterparty: "Mukwano" }),
  entry({ id: "owed", type: "debt_given", amount: 80_000, date: "2026-11-05", counterparty: "Mama Grace" }),
  entry({ id: "paid", type: "debt_payment_received", amount: 30_000, date: "2026-11-20", counterparty: "Mama Grace" }),
  entry({ id: "old-paid", type: "debt_payment_received", amount: 10_000, date: "2026-10-02", counterparty: "Mama Grace" }),
];

describe("goal progress", () => {
  const today = "2026-11-16";
  const goals = evaluateGoals(period, books, today);
  const byKind = Object.fromEntries(goals.map((goal) => [goal.kind, goal]));

  it("counts only sales inside the period", () => {
    expect(byKind.sales.progress).toBe(1_200_000);
    expect(byKind.sales.percent).toBe(40);
    expect(byKind.sales.line).toContain("1,200,000 of UGX 3,000,000 (40%)");
    expect(byKind.sales.daysLeftLabel).toBe("14 days left");
  });

  it("counts expenses only, not stock or supplier payments", () => {
    expect(byKind.spend.progress).toBe(200_000);
  });

  it("uses outstanding customer debt and period collections", () => {
    expect(byKind.debt.progress).toBe(40_000);
    expect(byKind.debt.collectedThisPeriod).toBe(30_000);
  });

  it("counts supplier payments inside the period", () => {
    expect(byKind.suppliers.progress).toBe(150_000);
  });
});

describe("pace and status", () => {
  it("expects progress in proportion to the days already gone", () => {
    const window = goalWindow("2026-11-01", "2026-11-30", "2026-11-15");
    expect(window).toEqual({ periodDays: 30, elapsedDays: 15, daysLeft: 15 });
    expect(expectedByPace(3_000_000, window)).toBe(1_500_000);
    expect(roundDailyPace(1_800_000 / 18)).toBe(100_000);
  });

  it("marks sales behind pace and on track once the pace is met", () => {
    const behind = evaluateGoals(period, books, "2026-11-16").find((goal) => goal.kind === "sales");
    expect(behind?.status).toBe("behind");
    expect(behind?.hint).toBe("Sell about UGX 129,000 a day to reach your goal.");

    const ahead = evaluateGoals(
      { ...period, sellAtLeast: 1_000_000 },
      books,
      "2026-11-16",
    ).find((goal) => goal.kind === "sales");
    expect(ahead?.status).toBe("on_track");
    expect(ahead?.hint).toBe("You have reached this goal.");
  });

  it("turns spending amber when it is faster than the plan and red past the limit", () => {
    const calm = evaluateGoals(period, books, "2026-11-16").find((goal) => goal.kind === "spend");
    expect(calm?.status).toBe("on_track");

    const fast = evaluateGoals(
      { ...period, spendAtMost: 300_000 },
      [...books, entry({ id: "extra-cost", type: "expense", amount: 150_000, date: "2026-11-14" })],
      "2026-11-16",
    ).find((goal) => goal.kind === "spend");
    expect(fast?.progress).toBe(350_000);
    expect(fast?.status).toBe("over");

    const amber = evaluateGoals(
      { ...period, spendAtMost: 400_000 },
      [...books, entry({ id: "extra-cost", type: "expense", amount: 150_000, date: "2026-11-14" })],
      "2026-11-10",
    ).find((goal) => goal.kind === "spend");
    expect(amber?.progress).toBe(350_000);
    expect(amber?.status).toBe("behind");
  });

  it("turns customer debt red only when it is above the limit", () => {
    const under = evaluateGoals(period, books, "2026-11-16").find((goal) => goal.kind === "debt");
    expect(under?.status).toBe("on_track");
    const over = evaluateGoals({ ...period, oweLessThan: 20_000 }, books, "2026-11-16").find(
      (goal) => goal.kind === "debt",
    );
    expect(over?.status).toBe("over");
    expect(over?.hint).toContain("Collect about UGX 20,000");
  });
});

describe("goal suggestions and summary", () => {
  it("suggests last period sales plus 10 percent and expenses minus 10 percent", () => {
    const earlier = [
      entry({ id: "old-sale", type: "sale", amount: 100_000, date: "2026-10-10" }),
      entry({ id: "old-cost", type: "expense", amount: 50_000, date: "2026-10-11" }),
      entry({ id: "old-supplier", type: "supplier_payment", amount: 40_000, date: "2026-10-12" }),
      entry({ id: "owed", type: "debt_given", amount: 80_000, date: "2026-11-05", counterparty: "Mama Grace" }),
      entry({ id: "paid", type: "debt_payment_received", amount: 30_000, date: "2026-11-20", counterparty: "Mama Grace" }),
    ];
    expect(suggestGoals(earlier, "2026-11-01", "2026-11-30")).toEqual({
      sellAtLeast: 110_000,
      spendAtMost: 45_000,
      oweLessThan: 45_000,
      paySuppliers: 44_000,
    });
  });

  it("writes one summary line only when a goal is set", () => {
    expect(goalSummaryLine([])).toBeNull();
    const line = goalSummaryLine(evaluateGoals({ ...period, spendAtMost: null, oweLessThan: null, paySuppliers: null }, books, "2026-11-16"));
    expect(line).toBe("Goals: Sales UGX 1,200,000 of UGX 3,000,000.");
  });
});
