import { describe, expect, it } from "vitest";
import { parseTransactions } from "./parser";

const TODAY = "2026-11-21";

describe("parseTransactions", () => {
  it("splits a partly paid sale and ignores the item count", () => {
    const rows = parseTransactions(
      "Sold 3 bags of sugar to Mama Grace for 15k, she paid 10k cash and owes 5k",
      TODAY,
    );

    expect(rows.map((row) => [row.type, row.amount])).toEqual([
      ["sale", 10000],
      ["debt_given", 5000],
    ]);
    expect(rows.every((row) => row.counterparty === "Mama Grace")).toBe(true);
    expect(rows.every((row) => row.date === TODAY)).toBe(true);
    expect(rows.every((row) => row.currency === "UGX")).toBe(true);
    expect(rows.every((row) => row.confidence < 0.7)).toBe(true);
    expect(rows.reduce((sum, row) => sum + row.amount, 0)).toBe(15000);
  });

  it("keeps a simple sale total when nothing is still owed", () => {
    const [row] = parseTransactions("Sold 3 bags of sugar to Mama Grace for 15k", TODAY);
    expect(row.type).toBe("sale");
    expect(row.amount).toBe(15000);
    expect(row.counterparty).toBe("Mama Grace");
    expect(row.category).toBe("Food and groceries");
  });

  it("reads rent, stock, airtime, millions, and supplier payments", () => {
    expect(parseTransactions("Paid rent 200k", TODAY)[0]).toMatchObject({
      type: "expense",
      amount: 200000,
      category: "Rent",
    });
    expect(parseTransactions("Bought stock from Mukwano for UGX 80,000", TODAY)[0]).toMatchObject({
      type: "purchase",
      amount: 80000,
      counterparty: "Mukwano",
      category: "Stock",
    });
    expect(parseTransactions("Spent 1.2m on a generator", TODAY)[0]).toMatchObject({
      type: "expense",
      amount: 1_200_000,
    });
    expect(parseTransactions("shs 25000 airtime", TODAY)[0]).toMatchObject({
      type: "expense",
      amount: 25000,
      category: "Airtime",
    });
    expect(parseTransactions("Paid supplier 40k", TODAY)[0]).toMatchObject({
      type: "supplier_payment",
      amount: 40000,
      category: "Suppliers",
    });
  });

  it("reads a debt payment and yesterday", () => {
    const [payment] = parseTransactions("Uncle John paid 15,000 of what he owed", TODAY);
    expect(payment).toMatchObject({
      type: "debt_payment_received",
      amount: 15000,
      counterparty: "Uncle John",
    });

    const [milk] = parseTransactions("Sold milk yesterday for 8k", TODAY);
    expect(milk).toMatchObject({ type: "sale", amount: 8000, date: "2026-11-20" });
  });

  it("splits lines into separate records", () => {
    const rows = parseTransactions("Sold rice for 20k\nPaid boda 3k", TODAY);
    expect(rows.map((row) => [row.type, row.amount, row.category])).toEqual([
      ["sale", 20000, "Food and groceries"],
      ["expense", 3000, "Transport"],
    ]);
  });

  it("returns nothing when there is no amount", () => {
    expect(parseTransactions("", TODAY)).toEqual([]);
    expect(parseTransactions("Hello, how is the shop?", TODAY)).toEqual([]);
  });
});
