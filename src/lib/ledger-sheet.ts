import { Workbook } from "exceljs";
import { computeTotals } from "./calculations";
import type { LedgerEntry, TransactionType } from "./types";

export const LEDGER_HEADERS = [
  "Date",
  "Type",
  "Description",
  "Person",
  "Amount (UGX)",
  "Payment",
] as const;

const TYPE_WORDS: Record<TransactionType, string> = {
  sale: "Sale",
  expense: "Expense",
  purchase: "Stock bought",
  debt_given: "Money owed to me",
  debt_payment_received: "Old debt paid",
  supplier_payment: "Money I paid a supplier",
  other: "Other",
};

const PAYMENT_WORDS: Record<TransactionType, string> = {
  sale: "Paid",
  expense: "Paid",
  purchase: "Paid",
  debt_given: "Not paid yet",
  debt_payment_received: "Paid",
  supplier_payment: "Paid",
  other: "",
};

export interface LedgerSheetRow {
  date: string;
  type: string;
  description: string;
  person: string;
  amount: number;
  payment: string;
}

export interface LedgerSheetTotals {
  moneyIn: number;
  moneyOut: number;
  net: number;
}

export function ledgerTypeLabel(type: TransactionType): string {
  return TYPE_WORDS[type];
}

export function ledgerPaymentStatus(type: TransactionType): string {
  return PAYMENT_WORDS[type];
}

export function toLedgerSheetRow(entry: LedgerEntry): LedgerSheetRow {
  const sample = entry.isSample ? " (sample)" : "";
  return {
    date: entry.date,
    type: ledgerTypeLabel(entry.type),
    description: `${entry.description.trim() || "Transaction"}${sample}`,
    person: entry.counterparty?.trim() ?? "",
    amount: Math.round(entry.amount),
    payment: ledgerPaymentStatus(entry.type),
  };
}

export function ledgerSheetTotals(entries: LedgerEntry[]): LedgerSheetTotals {
  const totals = computeTotals(entries);
  return {
    moneyIn: totals.cashIn,
    moneyOut: totals.cashOut,
    net: totals.net,
  };
}

export function ledgerFilename(date: string, extension: "xlsx" | "csv"): string {
  const safe = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "export";
  return `kaalbiz-ledger-${safe}.${extension}`;
}

function csvCell(value: string | number): string {
  const text = String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function csvLine(values: Array<string | number>): string {
  return values.map(csvCell).join(",");
}

export function ledgerToCsv(entries: LedgerEntry[]): string {
  const totals = ledgerSheetTotals(entries);
  const lines = [
    csvLine([...LEDGER_HEADERS]),
    ...entries.map((entry) => {
      const row = toLedgerSheetRow(entry);
      return csvLine([row.date, row.type, row.description, row.person, row.amount, row.payment]);
    }),
    "",
    csvLine(["", "", "Money in", "", totals.moneyIn, ""]),
    csvLine(["", "", "Money out", "", totals.moneyOut, ""]),
    csvLine(["", "", "Net", "", totals.net, ""]),
  ];
  return `\uFEFF${lines.join("\r\n")}`;
}

export function isoToExcelDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1, 12, 0, 0));
}

export async function ledgerToXlsx(entries: LedgerEntry[]): Promise<ArrayBuffer> {
  const workbook = new Workbook();
  workbook.creator = "KaalBiz AI";
  const sheet = workbook.addWorksheet("Ledger");
  sheet.views = [{ state: "frozen", ySplit: 1, xSplit: 0, showGridLines: true }];
  sheet.columns = [
    { width: 14 },
    { width: 28 },
    { width: 42 },
    { width: 22 },
    { width: 16 },
    { width: 16 },
  ];

  const header = sheet.addRow([...LEDGER_HEADERS]);
  header.font = { bold: true };
  header.alignment = { vertical: "middle" };

  for (const entry of entries) {
    const row = toLedgerSheetRow(entry);
    const added = sheet.addRow([
      isoToExcelDate(row.date),
      row.type,
      row.description,
      row.person,
      row.amount,
      row.payment,
    ]);
    added.getCell(1).numFmt = "yyyy-mm-dd";
    added.getCell(5).numFmt = "#,##0";
    added.getCell(5).alignment = { horizontal: "right" };
  }

  const totals = ledgerSheetTotals(entries);
  sheet.addRow([]);
  for (const [label, amount] of [
    ["Money in", totals.moneyIn],
    ["Money out", totals.moneyOut],
    ["Net", totals.net],
  ] as const) {
    const totalRow = sheet.addRow(["", "", label, "", amount, ""]);
    totalRow.font = { bold: true };
    totalRow.getCell(5).numFmt = "#,##0";
    totalRow.getCell(5).alignment = { horizontal: "right" };
  }

  const raw = await workbook.xlsx.writeBuffer();
  return copyBuffer(raw);
}

function copyBuffer(raw: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (raw instanceof ArrayBuffer) return raw;
  const copy = new Uint8Array(raw.byteLength);
  copy.set(raw);
  return copy.buffer;
}
