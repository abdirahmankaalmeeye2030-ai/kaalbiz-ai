import { describe, expect, it } from "vitest";
import { parseLedger } from "./storage";
import { filterTransactions } from "./calculations";
import { ledgerToCsv } from "./ledger-sheet";
import {
  confirmFieldErrors,
  customerDebts,
  dueUrgency,
  matchStaff,
  normalizeStaff,
  normalizeUgandaPhone,
  salesByPerson,
  supplierDebts,
} from "./people";
import type { DraftTransaction, LedgerEntry, TransactionType } from "./types";

function entry(partial: Partial<LedgerEntry> & { id: string; type: TransactionType; amount: number; date: string }): LedgerEntry {
  return {
    currency: "UGX",
    description: partial.id,
    category: "Test",
    counterparty: null,
    confidence: 1,
    notes: null,
    source: "demo",
    isSample: false,
    createdAt: `${partial.date}T08:00:00.000Z`,
    ...partial,
  };
}

function draft(partial: Partial<DraftTransaction> = {}): DraftTransaction {
  return {
    type: "sale",
    amount: 10000,
    currency: "UGX",
    date: "2026-11-24",
    description: "Sugar",
    category: "Food",
    counterparty: null,
    confidence: 0.9,
    notes: null,
    draftId: "d1",
    origin: "demo",
    recordedBy: "Amina",
    ...partial,
  };
}

describe("Uganda phone numbers", () => {
  it("normalises local and international forms to +256", () => {
    expect(normalizeUgandaPhone("0772123456")).toBe("+256772123456");
    expect(normalizeUgandaPhone("+256772123456")).toBe("+256772123456");
    expect(normalizeUgandaPhone("256772123456")).toBe("+256772123456");
    expect(normalizeUgandaPhone("0772 123 456")).toBe("+256772123456");
  });

  it("rejects numbers that are not a Uganda mobile", () => {
    expect(normalizeUgandaPhone("07123")).toBeNull();
    expect(normalizeUgandaPhone("0655123456")).toBeNull();
    expect(normalizeUgandaPhone("+256812345678")).toBeNull();
    expect(normalizeUgandaPhone("")).toBeNull();
  });
});

describe("required fields", () => {
  const staff = ["Owner", "Amina"];

  it("requires who recorded every entry", () => {
    expect(confirmFieldErrors(draft({ recordedBy: null }), staff).recordedBy).toBeTruthy();
    expect(confirmFieldErrors(draft({ recordedBy: "Musa" }), staff).recordedBy).toBeTruthy();
    expect(confirmFieldErrors(draft({ recordedBy: "amina" }), staff)).toEqual({});
  });

  it("requires customer debt details and an agreed amount within the balance", () => {
    const errors = confirmFieldErrors(
      draft({
        type: "debt_given",
        amount: 50000,
        counterparty: "",
        phone: "123",
        location: "",
        dueDate: "",
        agreedAmount: 60000,
      }),
      staff,
    );
    expect(errors.counterparty).toBeTruthy();
    expect(errors.phone).toBeTruthy();
    expect(errors.location).toBeTruthy();
    expect(errors.dueDate).toBeTruthy();
    expect(errors.agreedAmount).toBeTruthy();

    expect(
      confirmFieldErrors(
        draft({
          type: "debt_given",
          amount: 50000,
          counterparty: "Grace",
          phone: "0772123456",
          location: "Nakasero",
          dueDate: "2026-12-01",
          agreedAmount: 20000,
        }),
        staff,
      ),
    ).toEqual({});
  });
});

describe("balances, overdue, and person filters", () => {
  const books = [
    entry({ id: "owe", type: "debt_given", amount: 50000, date: "2026-11-01", counterparty: "Grace", phone: "+256772123456", location: "Nakasero", dueDate: "2026-11-20", agreedAmount: 50000 }),
    entry({ id: "part", type: "debt_payment_received", amount: 20000, date: "2026-11-22", counterparty: "Grace" }),
    entry({ id: "soon", type: "debt_given", amount: 10000, date: "2026-11-24", counterparty: "Sarah", dueDate: "2026-11-26", agreedAmount: 10000 }),
    entry({ id: "supplier", type: "supplier_debt", amount: 80000, date: "2026-11-10", counterparty: "Mukwano", dueDate: "2026-12-01", agreedAmount: 80000 }),
    entry({ id: "paid-supplier", type: "supplier_payment", amount: 30000, date: "2026-11-18", counterparty: "Mukwano" }),
    entry({ id: "sale", type: "sale", amount: 15000, date: "2026-11-24", recordedBy: "Amina" }),
  ];

  it("reduces a customer balance when part is paid", () => {
    const grace = customerDebts(books, "2026-11-24").find((row) => row.name === "Grace");
    expect(grace?.balance).toBe(30000);
    expect(grace?.urgency).toBe("overdue");
    const sarah = customerDebts(books, "2026-11-24").find((row) => row.name === "Sarah");
    expect(sarah?.urgency).toBe("soon");
    expect(dueUrgency("2026-12-20", "2026-11-24")).toBe("later");
    expect(dueUrgency(null, "2026-11-24")).toBe("unset");
  });

  it("reduces what the business owes a supplier", () => {
    expect(supplierDebts(books, "2026-11-24")).toEqual([
      expect.objectContaining({ name: "Mukwano", balance: 50000, urgency: "later" }),
    ]);
  });

  it("filters the ledger by who recorded it and totals their sales", () => {
    expect(filterTransactions(books, { recordedBy: "Amina" }).map((row) => row.id)).toEqual(["sale"]);
    expect(filterTransactions(books, { recordedBy: "Not set" }).map((row) => row.id)).not.toContain("sale");
    expect(salesByPerson(books)).toEqual([{ name: "Amina", amount: 15000 }]);
    expect(matchStaff("amina", ["Owner", "Amina"])).toBe("Amina");
    expect(normalizeStaff([" Owner ", "owner", ""])).toEqual(["Owner"]);
  });
});

describe("migration and export", () => {
  it("loads an old record that has no staff or debt fields", () => {
    const raw = JSON.stringify([
      {
        id: "old",
        type: "sale",
        amount: 5000,
        currency: "UGX",
        date: "2026-11-01",
        description: "Milk",
        category: "Food",
        counterparty: null,
        confidence: 1,
        notes: null,
        source: "demo",
        isSample: false,
        createdAt: "2026-11-01T08:00:00.000Z",
      },
    ]);
    const [loaded] = parseLedger(raw);
    expect(loaded.recordedBy).toBeNull();
    expect(loaded.phone).toBeNull();
    expect(loaded.dueDate).toBeNull();
    expect(loaded.agreedAmount).toBeNull();
  });

  it("adds a Recorded by column to the CSV", () => {
    const csv = ledgerToCsv([
      entry({ id: "sale", type: "sale", amount: 15000, date: "2026-11-24", recordedBy: "Amina", description: "Sugar" }),
    ]);
    expect(csv).toContain("Recorded by");
    expect(csv).toContain("Amina");
  });
});
