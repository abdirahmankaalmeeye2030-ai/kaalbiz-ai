import { Workbook } from "exceljs";
import { describe, expect, it } from "vitest";
import { filterTransactions } from "./calculations";
import {
  ledgerFilename,
  ledgerSheetTotals,
  ledgerToCsv,
  ledgerToXlsx,
  toLedgerSheetRow,
} from "./ledger-sheet";
import type { LedgerEntry, TransactionType } from "./types";

function entry(partial: {
  id: string;
  type: TransactionType;
  amount: number;
  date: string;
  description?: string;
  counterparty?: string | null;
  isSample?: boolean;
}): LedgerEntry {
  return {
    id: partial.id,
    type: partial.type,
    amount: partial.amount,
    currency: "UGX",
    date: partial.date,
    description: partial.description ?? partial.id,
    category: "Test",
    counterparty: partial.counterparty ?? null,
    confidence: 1,
    notes: null,
    source: partial.isSample ? "sample" : "demo",
    isSample: Boolean(partial.isSample),
    createdAt: `${partial.date}T08:00:00.000Z`,
  };
}

const rows = [
  entry({
    id: "sale",
    type: "sale",
    amount: 10000,
    date: "2026-11-21",
    description: "Sugar, 2 bags",
    counterparty: "Mama Grace",
  }),
  entry({
    id: "owed",
    type: "debt_given",
    amount: 5000,
    date: "2026-11-20",
    description: "Rice on credit",
    counterparty: "Mama Grace",
    isSample: true,
  }),
  entry({
    id: "cost",
    type: "expense",
    amount: 3000,
    date: "2026-11-19",
    description: "Airtime",
  }),
  entry({
    id: "stock",
    type: "purchase",
    amount: 4000,
    date: "2026-11-18",
    description: "Cement",
    counterparty: "Mukwano",
  }),
  entry({
    id: "paid",
    type: "debt_payment_received",
    amount: 2000,
    date: "2026-11-17",
    description: "Grace paid",
    counterparty: "Mama Grace",
  }),
  entry({
    id: "supplier",
    type: "supplier_payment",
    amount: 1000,
    date: "2026-11-16",
    description: "Paid Mukwano",
    counterparty: "Mukwano",
  }),
];

describe("ledger sheet rows and totals", () => {
  it("maps each record into plain columns", () => {
    expect(toLedgerSheetRow(rows[0])).toEqual({
      date: "2026-11-21",
      type: "Sale",
      description: "Sugar, 2 bags",
      person: "Mama Grace",
      amount: 10000,
      payment: "Paid",
    });
    expect(toLedgerSheetRow(rows[1])).toMatchObject({
      type: "Money owed to me",
      description: "Rice on credit (sample)",
      payment: "Not paid yet",
    });
    expect(toLedgerSheetRow(rows[2]).type).toBe("Expense");
    expect(toLedgerSheetRow(rows[5]).type).toBe("Money I paid a supplier");
  });

  it("adds money in, money out, and net with the existing totals helper", () => {
    expect(ledgerSheetTotals(rows)).toEqual({
      moneyIn: 12000,
      moneyOut: 8000,
      net: 4000,
    });
    expect(ledgerSheetTotals(rows.slice(0, 2))).toEqual({
      moneyIn: 10000,
      moneyOut: 0,
      net: 10000,
    });
  });
});

describe("ledger CSV", () => {
  it("writes a UTF-8 BOM, quoted text, and the totals", () => {
    const csv = ledgerToCsv([rows[0], rows[1]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.startsWith("\uFEFFDate,Type,Description,Person,Amount (UGX),Payment")).toBe(true);
    expect(csv).toContain('"Sugar, 2 bags"');
    expect(csv).toContain("Money owed to me");
    expect(csv).toContain("Rice on credit (sample)");
    expect(csv).toContain(",,Money in,,10000,");
    expect(csv).toContain(",,Money out,,0,");
    expect(csv).toContain(",,Net,,10000,");
    expect(csv.includes("\r\n")).toBe(true);
  });
});

describe("ledger xlsx", () => {
  it("writes a workbook that can be read back with dates, amounts, and totals", async () => {
    const buffer = await ledgerToXlsx([rows[0], rows[2]]);
    const workbook = new Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.getWorksheet("Ledger");
    expect(sheet).toBeTruthy();
    expect(sheet?.getRow(1).getCell(1).value).toBe("Date");
    expect(sheet?.getRow(1).getCell(5).value).toBe("Amount (UGX)");
    expect(sheet?.getRow(1).font?.bold).toBe(true);
    expect(sheet?.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });

    const date = sheet?.getRow(2).getCell(1).value;
    expect(date).toBeInstanceOf(Date);
    expect((date as Date).getUTCFullYear()).toBe(2026);
    expect((date as Date).getUTCMonth()).toBe(10);
    expect((date as Date).getUTCDate()).toBe(21);
    expect(sheet?.getRow(2).getCell(1).numFmt).toBe("yyyy-mm-dd");
    expect(sheet?.getRow(2).getCell(2).value).toBe("Sale");
    expect(sheet?.getRow(2).getCell(3).value).toBe("Sugar, 2 bags");
    expect(sheet?.getRow(2).getCell(4).value).toBe("Mama Grace");
    expect(sheet?.getRow(2).getCell(5).value).toBe(10000);
    expect(sheet?.getRow(2).getCell(5).numFmt).toBe("#,##0");
    expect(sheet?.getRow(2).getCell(6).value).toBe("Paid");
    expect(sheet?.getRow(3).getCell(2).value).toBe("Expense");
    expect(sheet?.getRow(3).getCell(5).value).toBe(3000);

    const labels = [5, 6, 7].map((index) => sheet?.getRow(index).getCell(3).value);
    expect(labels).toEqual(["Money in", "Money out", "Net"]);
    expect(sheet?.getRow(5).getCell(5).value).toBe(10000);
    expect(sheet?.getRow(6).getCell(5).value).toBe(3000);
    expect(sheet?.getRow(7).getCell(5).value).toBe(7000);
    expect(sheet?.getRow(5).getCell(5).numFmt).toBe("#,##0");
    expect(sheet?.getColumn(1).width).toBe(14);
    expect(ledgerFilename("2026-11-23", "xlsx")).toBe("kaalbiz-ledger-2026-11-23.xlsx");
    expect(ledgerFilename("2026-11-24", "xlsx", ["sale"])).toBe("kaalbiz-ledger-sales-2026-11-24.xlsx");
    expect(ledgerFilename("2026-11-24", "csv", ["expense", "sale"])).toBe(
      "kaalbiz-ledger-sales-expenses-2026-11-24.csv",
    );
  });
});

describe("filtered ledger totals and export", () => {
  it("totals and CSV include only the chosen types", () => {
    const sales = filterTransactions(rows, { types: ["sale"] });
    const expenses = filterTransactions(rows, { types: ["expense"] });
    expect(sales.map((row) => row.id)).toEqual(["sale"]);
    expect(ledgerSheetTotals(sales)).toEqual({ moneyIn: 10000, moneyOut: 0, net: 10000 });
    expect(ledgerSheetTotals(expenses)).toEqual({ moneyIn: 0, moneyOut: 3000, net: -3000 });

    const csv = ledgerToCsv(expenses);
    expect(csv).toContain("Expense,Airtime");
    expect(csv).not.toContain("Sale");
    expect(csv).toContain(",,Money out,,3000,");
    expect(csv).toContain(",,Net,,-3000,");
  });
});
