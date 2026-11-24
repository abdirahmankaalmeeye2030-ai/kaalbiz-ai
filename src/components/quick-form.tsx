"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { customerDebts, suggestContact, supplierDebts, type Contact } from "@/lib/people";
import {
  PAYMENT_METHOD_LABELS,
  QUICK_TYPES,
  QUICK_TYPE_LABELS,
  lineTotal,
  priceLine,
  amountFromGrouped,
  groupDigits,
  quickFieldErrors,
  quickFormEntry,
  type PaymentMethod,
  type QuickType,
} from "@/lib/quick-form";
import type { ExtractedTransaction, LedgerEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

export function QuickForm({
  staff,
  lastUsed,
  contacts,
  entries,
  today,
  onReview,
}: {
  staff: string[];
  lastUsed: string;
  contacts: Contact[];
  entries: LedgerEntry[];
  today: string;
  onReview: (transaction: ExtractedTransaction) => void;
}) {
  const [type, setType] = useState<QuickType>("sale");
  const [item, setItem] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [amount, setAmount] = useState(0);
  const [unitPrice, setUnitPrice] = useState(0);
  const [priceDriver, setPriceDriver] = useState<"unit" | "total">("unit");
  const [agreed, setAgreed] = useState(0);
  const [agreedEdited, setAgreedEdited] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [recordedBy, setRecordedBy] = useState(lastUsed);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const credit = type === "debt_given" || type === "supplier_debt";
  const payingCustomer = type === "debt_payment_received";
  const payingSupplier = type === "supplier_payment";
  const paying = payingCustomer || payingSupplier;
  const kind = type === "supplier_debt" || payingSupplier ? "supplier" : "customer";
  const namedContacts = contacts.filter((contact) => contact.kind === kind);
  const debts = payingCustomer ? customerDebts(entries, today) : payingSupplier ? supplierDebts(entries, today) : [];
  const quantityNumber = Number(quantity.replace(/\D/g, "")) || 0;
  const hasQuantity = type === "sale" || type === "purchase";

  function applyTotal(next: number, edited: "unit" | "total") {
    setAmount(next);
    if (!agreedEdited) setAgreed(next);
    setPriceDriver(edited);
  }

  function onUnitPrice(next: number) {
    setUnitPrice(next);
    const total = lineTotal(quantityNumber, next);
    if (total) applyTotal(total, "unit");
    else setPriceDriver("unit");
  }

  function onQuantity(raw: string) {
    setQuantity(raw);
    const qty = Number(raw.replace(/\D/g, "")) || 0;
    if (priceDriver === "total") return;
    const total = lineTotal(qty, unitPrice);
    if (total) applyTotal(total, "unit");
  }

  function onTotal(next: number) {
    applyTotal(next, "total");
  }

  function review() {
    const draft = {
      type,
      item,
      quantity: quantityNumber,
      amount,
      unitPrice,
      paymentMethod,
      recordedBy: recordedBy || lastUsed,
      name,
      phone,
      location,
      dueDate,
      agreedAmount: agreed,
      today,
      staff,
    };
    const found = quickFieldErrors(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const transaction = quickFormEntry(draft);
    if (transaction) onReview(transaction);
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        review();
      }}
    >
      <p className="text-sm leading-6 text-muted-foreground">
        Fill the boxes. Nothing is sent to AI. You still confirm before it is saved.
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Type of record">
        {QUICK_TYPES.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={type === option}
            onClick={() => {
              setType(option);
              setErrors({});
            }}
            className={cn(
              "rounded-full border px-3 py-2 text-left text-sm font-semibold",
              type === option ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground",
            )}
          >
            {QUICK_TYPE_LABELS[option]}
          </button>
        ))}
      </div>

      {type === "sale" || type === "purchase" || credit ? (
        <Field label="Item" error={errors.item}>
          <Input aria-label="Item" value={item} onChange={(event) => setItem(event.target.value)} />
        </Field>
      ) : null}
      {type === "expense" ? (
        <Field label="What" error={errors.item}>
          <Input aria-label="What" value={item} onChange={(event) => setItem(event.target.value)} />
        </Field>
      ) : null}
      {type === "sale" || type === "purchase" ? (
        <Field label="Quantity" error={errors.quantity}>
          <Input
            aria-label="Quantity"
            inputMode="numeric"
            value={quantity}
            onChange={(event) => onQuantity(event.target.value.replace(/\D/g, ""))}
          />
        </Field>
      ) : null}
      {hasQuantity ? (
        <Field label="Unit price (UGX)">
          <Input
            aria-label="Unit price (UGX)"
            inputMode="numeric"
            value={unitPrice ? groupDigits(String(unitPrice)) : ""}
            onChange={(event) => onUnitPrice(amountFromGrouped(event.target.value))}
          />
        </Field>
      ) : null}

      {paying ? (
        <Field label={payingCustomer ? "Who owes you" : "Who you owe"} error={errors.name}>
          {debts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {payingCustomer ? "Nobody owes you yet." : "You do not owe a supplier yet."}
            </p>
          ) : (
            <select
              aria-label={payingCustomer ? "Who owes you" : "Who you owe"}
              className="h-11 w-full rounded-xl border border-input bg-card px-3 text-base"
              value={name}
              onChange={(event) => {
                const picked = debts.find((debt) => debt.name === event.target.value);
                setName(picked?.name ?? "");
                if (picked) onTotal(picked.balance);
              }}
            >
              <option value="">Choose a person</option>
              {debts.map((debt) => (
                <option key={debt.name} value={debt.name}>
                  {debt.name} · UGX {groupDigits(String(debt.balance))}
                </option>
              ))}
            </select>
          )}
        </Field>
      ) : null}

      <Field label="Amount (UGX)" error={errors.amount}>
        <Input
          aria-label="Amount (UGX)"
          inputMode="numeric"
          value={amount ? groupDigits(String(amount)) : ""}
          onChange={(event) => onTotal(amountFromGrouped(event.target.value))}
        />
        {hasQuantity && priceLine(quantityNumber, unitPrice, amount) ? (
          <p className="mt-1 text-xs text-muted-foreground">{priceLine(quantityNumber, unitPrice, amount)}</p>
        ) : null}
      </Field>

      {type === "sale" ? (
        <Field label="Payment method" error={errors.paymentMethod}>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Payment method">
            {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((method) => (
              <button
                key={method}
                type="button"
                aria-pressed={paymentMethod === method}
                onClick={() => setPaymentMethod(method)}
                className={cn(
                  "h-11 rounded-xl border text-sm font-semibold",
                  paymentMethod === method
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground",
                )}
              >
                {PAYMENT_METHOD_LABELS[method]}
              </button>
            ))}
          </div>
        </Field>
      ) : null}

      {credit ? (
        <>
          <Field label="Name" error={errors.name}>
            <Input
              aria-label="Name"
              list="quick-contacts"
              value={name}
              onChange={(event) => {
                const next = event.target.value;
                setName(next);
                const match = suggestContact(next, namedContacts);
                if (match?.phone) setPhone(match.phone);
                if (match?.location) setLocation(match.location);
              }}
            />
            <datalist id="quick-contacts">
              {namedContacts.map((contact) => (
                <option key={contact.name} value={contact.name} />
              ))}
            </datalist>
          </Field>
          <Field label="Phone" error={errors.phone}>
            <Input aria-label="Phone" inputMode="tel" placeholder="07XXXXXXXX" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </Field>
          <Field label="Location" error={errors.location}>
            <Input aria-label="Location" value={location} onChange={(event) => setLocation(event.target.value)} />
          </Field>
          <Field label="Agreed pay date" error={errors.dueDate}>
            <Input aria-label="Agreed pay date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </Field>
          <Field label="Agreed pay amount (UGX)" error={errors.agreedAmount}>
            <Input
              aria-label="Agreed pay amount (UGX)"
              inputMode="numeric"
              value={agreed ? groupDigits(String(agreed)) : ""}
              onChange={(event) => {
                setAgreedEdited(true);
                setAgreed(amountFromGrouped(event.target.value));
              }}
            />
          </Field>
        </>
      ) : null}

      <Field label="Recorded by" error={errors.recordedBy}>
        <select
          aria-label="Recorded by"
          className="h-11 w-full rounded-xl border border-input bg-card px-3 text-base"
          value={recordedBy || lastUsed}
          onChange={(event) => setRecordedBy(event.target.value)}
        >
          <option value="">Choose a person</option>
          {staff.map((person) => (
            <option key={person} value={person}>
              {person}
            </option>
          ))}
        </select>
      </Field>

      <Button type="submit" className="w-full" size="lg">
        Review this
      </Button>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1">{children}</div>
      {error ? <p className="mt-1 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
