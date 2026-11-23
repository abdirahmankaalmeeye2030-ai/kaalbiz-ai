import type { TransactionType } from "./types";

export const TYPE_LABELS: Record<TransactionType, string> = {
  sale: "Sale",
  expense: "Cost",
  purchase: "Stock bought",
  debt_given: "Customer owes",
  debt_payment_received: "Debt paid",
  supplier_payment: "Supplier paid",
  supplier_debt: "Money I owe a supplier",
  other: "Other",
};

export const TYPE_HINTS: Record<TransactionType, string> = {
  sale: "Customer paid now",
  expense: "A cost of running the business",
  purchase: "Stock you bought and paid for",
  debt_given: "A customer still owes you",
  debt_payment_received: "A customer paid an old balance",
  supplier_payment: "Money you paid a supplier",
  supplier_debt: "You still owe a supplier",
  other: "Something else",
};
