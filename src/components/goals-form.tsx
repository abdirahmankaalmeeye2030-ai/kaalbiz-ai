"use client";

import Link from "next/link";
import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addMonths, isIsoDate, kampalaToday } from "@/lib/dates";
import { suggestGoals, type GoalSettings } from "@/lib/goals";
import { useGoals } from "@/lib/use-goals";
import { useLedger } from "@/lib/use-ledger";

export function GoalsForm() {
  const { goals, save } = useGoals();
  const { entries } = useLedger();
  const [draft, setDraft] = useState<GoalSettings>(() => goals ?? defaultGoals());
  const [endEdited, setEndEdited] = useState(Boolean(goals));
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  function updateStart(startDate: string) {
    setDraft((current) => ({
      ...current,
      startDate,
      endDate: endEdited ? current.endDate : isIsoDate(startDate) ? addMonths(startDate, 1) : current.endDate,
    }));
  }

  function suggest() {
    if (!isIsoDate(draft.startDate) || !isIsoDate(draft.endDate)) {
      setError("Choose a real start and end date first.");
      return;
    }
    const suggestion = suggestGoals(entries, draft.startDate, draft.endDate);
    setDraft((current) => ({ ...current, ...suggestion }));
    setError(null);
    setNote("Suggested from the month before this one. It is not a promise. Nothing is saved until you tap Save.");
  }

  function saveDraft() {
    if (!isIsoDate(draft.startDate) || !isIsoDate(draft.endDate)) {
      setError("Choose a real start and end date.");
      return;
    }
    if (draft.endDate < draft.startDate) {
      setError("The end date has to be on or after the start date.");
      return;
    }
    save(draft);
    setError(null);
    setNote("Goals saved on this phone.");
  }

  return (
    <div className="space-y-5">
      <div>
        <Link href="/dashboard" className="text-sm font-semibold text-primary">
          Back to today
        </Link>
        <h1 className="mt-2 font-serif text-3xl tracking-tight">Set goals</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Leave a box empty if you do not want that goal. Amounts are in Uganda shillings.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="goal-start">Start date</Label>
          <Input
            id="goal-start"
            className="mt-1"
            type="date"
            value={draft.startDate}
            onChange={(event) => updateStart(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="goal-end">End date</Label>
          <Input
            id="goal-end"
            className="mt-1"
            type="date"
            value={draft.endDate}
            onChange={(event) => {
              setEndEdited(true);
              setDraft((current) => ({ ...current, endDate: event.target.value }));
            }}
          />
        </div>
      </div>

      <MoneyField
        id="goal-sales"
        label="Sell at least"
        hint="Cash sales in this period."
        value={draft.sellAtLeast}
        onChange={(sellAtLeast) => setDraft((current) => ({ ...current, sellAtLeast }))}
      />
      <MoneyField
        id="goal-spend"
        label="Spend at most"
        hint="Costs such as rent, airtime, and transport. Stock and supplier payments are not included."
        value={draft.spendAtMost}
        onChange={(spendAtMost) => setDraft((current) => ({ ...current, spendAtMost }))}
      />
      <MoneyField
        id="goal-debt"
        label="Customers should owe me less than"
        hint="The open balance today, not only this period."
        value={draft.oweLessThan}
        onChange={(oweLessThan) => setDraft((current) => ({ ...current, oweLessThan }))}
      />
      <MoneyField
        id="goal-suppliers"
        label="Pay suppliers"
        hint="Money you pay suppliers in this period."
        value={draft.paySuppliers}
        onChange={(paySuppliers) => setDraft((current) => ({ ...current, paySuppliers }))}
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {note ? <p className="text-sm leading-6 text-muted-foreground">{note}</p> : null}

      <div className="flex flex-col gap-2">
        <Button type="button" onClick={saveDraft}>
          Save
        </Button>
        <Button type="button" variant="outline" onClick={suggest}>
          Suggest from last period
        </Button>
        <Button type="button" variant="ghost" onClick={() => setConfirmClear(true)} disabled={!goals}>
          Clear
        </Button>
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="Clear your goals?"
        body="This removes the goals from this phone. Your sales records stay."
        confirmLabel="Clear goals"
        destructive
        onOpenChange={setConfirmClear}
        onConfirm={() => {
          save(null);
          setDraft(defaultGoals());
          setEndEdited(false);
          setNote("Goals cleared from this phone.");
          setError(null);
        }}
      />
    </div>
  );
}

function defaultGoals(): GoalSettings {
  const startDate = kampalaToday();
  return {
    startDate,
    endDate: addMonths(startDate, 1),
    sellAtLeast: null,
    spendAtMost: null,
    oweLessThan: null,
    paySuppliers: null,
  };
}

function MoneyField({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</p>
      <div className="relative mt-1">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          UGX
        </span>
        <Input
          id={id}
          className="pl-14"
          inputMode="numeric"
          autoComplete="off"
          value={value == null ? "" : new Intl.NumberFormat("en-US").format(value)}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, "").slice(0, 12);
            onChange(digits ? Number(digits) : null);
          }}
        />
      </div>
    </div>
  );
}
