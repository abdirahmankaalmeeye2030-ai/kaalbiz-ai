"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatUgx } from "@/lib/money";
import { TYPE_LABELS } from "@/lib/labels";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/quick-form";
import { confirmFieldErrors, normalizeUgandaPhone, suggestContact, type Contact } from "@/lib/people";
import { LOW_CONFIDENCE_THRESHOLD, TRANSACTION_TYPES, type DraftTransaction } from "@/lib/types";

function FieldError({ children }: { children: string }) {
  return <p className="mt-1 text-sm text-destructive">{children}</p>;
}

const fieldClass =
  "h-11 w-full rounded-xl border border-input bg-card px-3 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function DraftCard({
  draft,
  staff,
  contacts,
  onChange,
  onDiscard,
  onConfirm,
}: {
  draft: DraftTransaction;
  staff: string[];
  contacts: Contact[];
  onChange: (next: DraftTransaction) => void;
  onDiscard: () => void;
  onConfirm: () => void;
}) {
  const [attempted, setAttempted] = useState(false);
  const low = draft.confidence < LOW_CONFIDENCE_THRESHOLD;
  const errors = confirmFieldErrors(draft, staff);
  const credit = draft.type === "debt_given" || draft.type === "supplier_debt";
  const namedPayment = draft.type === "debt_payment_received" || draft.type === "supplier_payment";
  const visibleErrors = attempted ? errors : {};

  return (
    <article
      className={
        low
          ? "rounded-2xl border-2 border-warning bg-warning-bg/40 p-4"
          : "rounded-2xl border border-border bg-card p-4"
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {low ? <Badge variant="warning">Please check this one</Badge> : null}
        {draft.isSample ? <Badge variant="sample">Sample</Badge> : null}
        <span className="text-xs text-muted-foreground">
          Confidence {Math.round(draft.confidence * 100)}%
        </span>
      </div>

      <div className="grid gap-3">
        <div>
          <Label htmlFor={`${draft.draftId}-by`}>Recorded by</Label>
          <select
            id={`${draft.draftId}-by`}
            className={`${fieldClass} mt-1`}
            value={draft.recordedBy ?? ""}
            aria-invalid={Boolean(visibleErrors.recordedBy)}
            onChange={(event) => onChange({ ...draft, recordedBy: event.target.value })}
          >
            <option value="">Choose a person</option>
            {staff.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          {visibleErrors.recordedBy ? <FieldError>{visibleErrors.recordedBy}</FieldError> : null}
        </div>
        <div>
          <Label htmlFor={`${draft.draftId}-type`}>Type</Label>
          <select
            id={`${draft.draftId}-type`}
            className={`${fieldClass} mt-1`}
            value={draft.type}
            onChange={(event) =>
              onChange({ ...draft, type: event.target.value as DraftTransaction["type"] })
            }
          >
            {TRANSACTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>
        {draft.paymentMethod ? (
          <div>
            <Label htmlFor={`${draft.draftId}-pay`}>Payment method</Label>
            <select
              id={`${draft.draftId}-pay`}
              className={`${fieldClass} mt-1`}
              value={draft.paymentMethod}
              onChange={(event) =>
                onChange({ ...draft, paymentMethod: event.target.value as PaymentMethod })
              }
            >
              {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((method) => (
                <option key={method} value={method}>
                  {PAYMENT_METHOD_LABELS[method]}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor={`${draft.draftId}-amount`}>Amount (UGX)</Label>
            <Input
              id={`${draft.draftId}-amount`}
              className="mt-1"
              inputMode="numeric"
              value={draft.amount ? String(draft.amount) : ""}
              onChange={(event) => {
                const digits = event.target.value.replace(/[^\d]/g, "");
                onChange({ ...draft, amount: digits ? Number(digits) : 0 });
              }}
            />
            <p className="mt-1 text-xs text-muted-foreground">{formatUgx(draft.amount)}</p>
          </div>
          <div>
            <Label htmlFor={`${draft.draftId}-date`}>Date</Label>
            <Input
              id={`${draft.draftId}-date`}
              className="mt-1"
              type="date"
              value={draft.date}
              onChange={(event) => onChange({ ...draft, date: event.target.value })}
            />
          </div>
        </div>
        <div>
          <Label htmlFor={`${draft.draftId}-description`}>What happened</Label>
          <Input
            id={`${draft.draftId}-description`}
            className="mt-1"
            value={draft.description}
            onChange={(event) => onChange({ ...draft, description: event.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor={`${draft.draftId}-category`}>Category</Label>
            <Input
              id={`${draft.draftId}-category`}
              className="mt-1"
              value={draft.category}
              onChange={(event) => onChange({ ...draft, category: event.target.value })}
            />
          </div>
          <div>
            <Label htmlFor={`${draft.draftId}-who`}>Customer or supplier</Label>
            <Input
              id={`${draft.draftId}-who`}
              className="mt-1"
              list={`${draft.draftId}-contacts`}
              value={draft.counterparty ?? ""}
              placeholder={credit || namedPayment ? "Required" : "Optional"}
              aria-invalid={Boolean(visibleErrors.counterparty)}
              onChange={(event) => {
                const name = event.target.value;
                const match = suggestContact(name, contacts);
                onChange({
                  ...draft,
                  counterparty: name.trim() ? name : null,
                  phone: match?.phone ?? draft.phone ?? null,
                  location: match?.location ?? draft.location ?? null,
                });
              }}
            />
            <datalist id={`${draft.draftId}-contacts`}>
              {contacts.map((contact) => (
                <option key={`${contact.kind}-${contact.name}`} value={contact.name} />
              ))}
            </datalist>
            {visibleErrors.counterparty ? <FieldError>{visibleErrors.counterparty}</FieldError> : null}
          </div>
        </div>
        {credit ? (
          <div className="grid gap-3">
            <div>
              <Label htmlFor={`${draft.draftId}-phone`}>Phone</Label>
              <Input
                id={`${draft.draftId}-phone`}
                className="mt-1"
                inputMode="tel"
                value={draft.phone ?? ""}
                placeholder="07XXXXXXXX"
                aria-invalid={Boolean(visibleErrors.phone)}
                onChange={(event) => onChange({ ...draft, phone: event.target.value })}
                onBlur={(event) => {
                  const phone = normalizeUgandaPhone(event.target.value);
                  if (phone) onChange({ ...draft, phone });
                }}
              />
              {visibleErrors.phone ? <FieldError>{visibleErrors.phone}</FieldError> : null}
            </div>
            <div>
              <Label htmlFor={`${draft.draftId}-location`}>Location</Label>
              <Input
                id={`${draft.draftId}-location`}
                className="mt-1"
                value={draft.location ?? ""}
                aria-invalid={Boolean(visibleErrors.location)}
                onChange={(event) => onChange({ ...draft, location: event.target.value })}
              />
              {visibleErrors.location ? <FieldError>{visibleErrors.location}</FieldError> : null}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor={`${draft.draftId}-due`}>Agreed pay date</Label>
                <Input
                  id={`${draft.draftId}-due`}
                  className="mt-1"
                  type="date"
                  value={draft.dueDate ?? ""}
                  aria-invalid={Boolean(visibleErrors.dueDate)}
                  onChange={(event) => onChange({ ...draft, dueDate: event.target.value })}
                />
                {visibleErrors.dueDate ? <FieldError>{visibleErrors.dueDate}</FieldError> : null}
              </div>
              <div>
                <Label htmlFor={`${draft.draftId}-agreed`}>Agreed pay amount</Label>
                <Input
                  id={`${draft.draftId}-agreed`}
                  className="mt-1"
                  inputMode="numeric"
                  value={draft.agreedAmount ? String(draft.agreedAmount) : ""}
                  aria-invalid={Boolean(visibleErrors.agreedAmount)}
                  onChange={(event) => {
                    const digits = event.target.value.replace(/[^\d]/g, "");
                    onChange({ ...draft, agreedAmount: digits ? Number(digits) : 0 });
                  }}
                />
                {visibleErrors.agreedAmount ? <FieldError>{visibleErrors.agreedAmount}</FieldError> : null}
              </div>
            </div>
          </div>
        ) : null}
        {draft.notes ? <p className="text-sm leading-6 text-muted-foreground">{draft.notes}</p> : null}
      </div>

      <div className="mt-4 flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onDiscard}>
          Discard
        </Button>
        <Button
          type="button"
          className="flex-1"
          onClick={() => {
            setAttempted(true);
            if (Object.keys(errors).length > 0) return;
            onConfirm();
          }}
        >
          Confirm
        </Button>
      </div>
    </article>
  );
}
