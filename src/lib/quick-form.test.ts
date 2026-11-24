import { describe, expect, it } from "vitest";
import { parseLedger } from "./storage";
import { entryWriteSchema } from "./cloud-schema";
import { amountFromGrouped, groupDigits, quickFieldErrors, quickFormEntry, type QuickDraftInput } from "./quick-form";

const staff = ["Owner", "Amina"];

function input(partial: Partial<QuickDraftInput> = {}): QuickDraftInput {
  return {
    type: "sale",
    item: "sugar",
    quantity: 3,
    amount: 15000,
    paymentMethod: "cash",
    recordedBy: "Amina",
    name: "",
    phone: "",
    location: "",
    dueDate: "",
    agreedAmount: 0,
    today: "2026-11-24",
    staff,
    ...partial,
  };
}

describe("quick form", () => {
  it("groups shillings as they are typed", () => {
    expect(groupDigits("15000")).toBe("15,000");
    expect(groupDigits("15,000")).toBe("15,000");
    expect(amountFromGrouped("15,000")).toBe(15000);
    expect(amountFromGrouped("")).toBe(0);
  });

  it("builds a sale without calling for AI", () => {
    const entry = quickFormEntry(input());
    expect(entry).toMatchObject({
      type: "sale",
      amount: 15000,
      description: "3 sugar",
      paymentMethod: "cash",
      recordedBy: "Amina",
      confidence: 1,
      date: "2026-11-24",
      counterparty: null,
    });
    expect(quickFieldErrors(input({ item: " ", paymentMethod: null })).item).toBeTruthy();
    expect(quickFieldErrors(input({ paymentMethod: null })).paymentMethod).toBeTruthy();
  });

  it("requires the same debt details as a credit sale", () => {
    const missing = quickFieldErrors(
      input({ type: "debt_given", paymentMethod: null, amount: 50000, agreedAmount: 50000 }),
    );
    expect(missing.name).toBeTruthy();
    expect(missing.phone).toBeTruthy();
    expect(missing.location).toBeTruthy();
    expect(missing.dueDate).toBeTruthy();
    const entry = quickFormEntry(
      input({
        type: "supplier_debt",
        paymentMethod: null,
        item: "cement",
        amount: 80000,
        agreedAmount: 80000,
        name: "Mukwano",
        phone: "0772123456",
        location: "Nakasero",
        dueDate: "2026-12-01",
      }),
    );
    expect(entry).toMatchObject({
      type: "supplier_debt",
      description: "cement",
      counterparty: "Mukwano",
      phone: "+256772123456",
      paymentMethod: null,
    });
  });

  it("names an old-debt payment from the person who owes", () => {
    expect(quickFieldErrors(input({ type: "debt_payment_received", paymentMethod: null, item: "" })).name).toBeTruthy();
    const entry = quickFormEntry(
      input({ type: "debt_payment_received", paymentMethod: null, item: "", amount: 20000, name: "Grace" }),
    );
    expect(entry).toMatchObject({
      type: "debt_payment_received",
      description: "Grace paid an old debt",
      counterparty: "Grace",
      amount: 20000,
    });
  });

  it("keeps an old ledger row and accepts the optional payment method", () => {
    const [loaded] = parseLedger(
      JSON.stringify([
        {
          id: "old",
          type: "sale",
          amount: 5000,
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
      ]),
    );
    expect(loaded?.paymentMethod).toBeNull();
    const parsed = entryWriteSchema.parse({
      id: "8d8b6c1e-4b1a-4e2a-9c1a-0b1c2d3e4f50",
      business_id: "8d8b6c1e-4b1a-4e2a-9c1a-0b1c2d3e4f51",
      type: "sale",
      amount: 15000,
      currency: "UGX",
      date: "2026-11-24",
      description: "3 sugar",
      category: "Sales",
      counterparty: null,
      confidence: 1,
      notes: null,
      recorded_by: "Amina",
      phone: null,
      location: null,
      due_date: null,
      agreed_amount: null,
      payment_method: "mobile_money",
      source: "demo",
      is_sample: false,
      created_at: "2026-11-24T08:00:00.000Z",
      updated_at: "2026-11-24T08:00:00.000Z",
      deleted_at: null,
    });
    expect(parsed.payment_method).toBe("mobile_money");
    expect(entryWriteSchema.safeParse({ ...parsed, payment_method: "card" }).success).toBe(false);
  });
});
