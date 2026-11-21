import { addDays } from "./dates";
import type { LedgerEntry, TransactionType } from "./types";

function sample(
  today: string,
  offset: number,
  id: string,
  fields: {
    type: TransactionType;
    amount: number;
    description: string;
    category: string;
    counterparty?: string | null;
  },
): LedgerEntry {
  return {
    id,
    type: fields.type,
    amount: fields.amount,
    currency: "UGX",
    date: addDays(today, offset),
    description: fields.description,
    category: fields.category,
    counterparty: fields.counterparty ?? null,
    confidence: 1,
    notes: "Sample data for the demo. Not a real record from your shop.",
    source: "sample",
    isSample: true,
    createdAt: `${addDays(today, offset)}T09:00:00.000Z`,
  };
}

export function buildDemoTransactions(today: string): LedgerEntry[] {
  return [
    sample(today, -6, "sample-sugar", {
      type: "sale",
      amount: 45000,
      description: "3 bags of sugar sold to Mama Grace",
      category: "Food and groceries",
      counterparty: "Mama Grace",
    }),
    sample(today, -6, "sample-rice-credit", {
      type: "debt_given",
      amount: 30000,
      description: "Rice taken on credit by Mama Grace",
      category: "Customer credit",
      counterparty: "Mama Grace",
    }),
    sample(today, -5, "sample-airtime", {
      type: "expense",
      amount: 5000,
      description: "MTN airtime for the shop line",
      category: "Airtime",
    }),
    sample(today, -5, "sample-braids", {
      type: "sale",
      amount: 35000,
      description: "Braiding for Aisha",
      category: "Salon",
      counterparty: "Aisha",
    }),
    sample(today, -4, "sample-nails", {
      type: "purchase",
      amount: 80000,
      description: "Nails and cement from Mukwano",
      category: "Stock",
      counterparty: "Mukwano",
    }),
    sample(today, -4, "sample-cement-credit", {
      type: "debt_given",
      amount: 20000,
      description: "Cement on credit for Uncle John",
      category: "Customer credit",
      counterparty: "Uncle John",
    }),
    sample(today, -3, "sample-rolex", {
      type: "sale",
      amount: 28000,
      description: "Rolex and tea sales at lunch",
      category: "Food and groceries",
    }),
    sample(today, -3, "sample-boda", {
      type: "expense",
      amount: 3000,
      description: "Boda to Nakasero market",
      category: "Transport",
    }),
    sample(today, -2, "sample-grace-pay", {
      type: "debt_payment_received",
      amount: 15000,
      description: "Mama Grace paid part of the rice",
      category: "Customer credit",
      counterparty: "Mama Grace",
    }),
    sample(today, -1, "sample-dress", {
      type: "sale",
      amount: 65000,
      description: "Dress sold to Sarah",
      category: "Boutique",
      counterparty: "Sarah",
    }),
    sample(today, -1, "sample-rent", {
      type: "expense",
      amount: 150000,
      description: "Shop rent for the week",
      category: "Rent",
    }),
    sample(today, 0, "sample-soda", {
      type: "sale",
      amount: 22000,
      description: "Soda and water sales",
      category: "Food and groceries",
    }),
    sample(today, 0, "sample-supplier", {
      type: "supplier_payment",
      amount: 40000,
      description: "Paid the soda supplier",
      category: "Suppliers",
      counterparty: "Century Bottling",
    }),
    sample(today, 0, "sample-yaka", {
      type: "expense",
      amount: 25000,
      description: "Yaka electricity",
      category: "Utilities",
    }),
  ];
}
