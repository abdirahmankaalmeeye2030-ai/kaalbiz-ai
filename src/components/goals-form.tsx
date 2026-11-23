"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addMonths, isIsoDate, kampalaToday } from "@/lib/dates";
import { goalSettingsFromFields, suggestGoals, type GoalFieldErrors, type GoalSettings } from "@/lib/goals";
import { GOALS_SAVED_FLAG } from "@/lib/goals-storage";
import { useGoals } from "@/lib/use-goals";
import { useLedger } from "@/lib/use-ledger";

export function GoalsForm() {
  const router = useRouter();
  const { goals, save } = useGoals();
  const { entries } = useLedger();
  const [draft, setDraft] = useState<GoalSettings>(() => goals ?? defaultGoals());
  const [endEdited, setEndEdited] = useState(Boolean(goals));
  const [note, setNote] = useState<string | null>(null);
  const [errors, setErrors] = useState<GoalFieldErrors>({});
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
      setErrors({ form: "Choose a real start and end date first." });
      return;
    }
    const suggestion = suggestGoals(entries, draft.startDate, draft.endDate);
    setDraft((current) => ({ ...current, ...suggestion }));
    setErrors({});
    setNote("Suggested from the month before this one. It is not a promise. Nothing is saved until you tap Save.");
  }

  function saveDraft(event: FormEvent) {
    event.preventDefault();
    const result = goalSettingsFromFields({
      startDate: readField("goal-start", draft.startDate),
      endDate: readField("goal-end", draft.endDate),
      sellAtLeast: readField("goal-sales", ""),
      spendAtMost: readField("goal-spend", ""),
      oweLessThan: readField("goal-debt", ""),
      paySuppliers: readField("goal-suppliers", ""),
    });
    setErrors(result.errors);
    if (!result.settings) {
      setNote(null);
      return;
    }
    save(result.settings);
    sessionStorage.setItem(GOALS_SAVED_FLAG, "1");
    router.push("/dashboard#goals");
  }

  return (
    <form className="space-y-5" onSubmit={saveDraft} noValidate>
      <div>
        <Link href="/dashboard" className="text-sm font-semibold text-primary">
          Back to today
        </Link>
        <h1 className="mt-2 font-serif text-3xl tracking-tight">Set goals</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Goals are kept on this phone. Leave a box empty if you do not want that goal.
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
            aria-invalid={Boolean(errors.startDate)}
            onChange={(event) => updateStart(event.target.value)}
          />
          {errors.startDate ? <p className="mt-1 text-sm text-destructive">{errors.startDate}</p> : null}
        </div>
        <div>
          <Label htmlFor="goal-end">End date</Label>
          <Input
            id="goal-end"
            className="mt-1"
            type="date"
            value={draft.endDate}
            aria-invalid={Boolean(errors.endDate)}
            onChange={(event) => {
              setEndEdited(true);
              setDraft((current) => ({ ...current, endDate: event.target.value }));
            }}
          />
          {errors.endDate ? <p className="mt-1 text-sm text-destructive">{errors.endDate}</p> : null}
        </div>
      </div>

      <MoneyField
        id="goal-sales"
        label="Sell at least"
        hint="Cash sales in this period."
        value={draft.sellAtLeast}
        error={errors.sellAtLeast}
        onChange={(sellAtLeast) => setDraft((current) => ({ ...current, sellAtLeast }))}
      />
      <MoneyField
        id="goal-spend"
        label="Spend at most"
        hint="Costs such as rent, airtime, and transport. Stock and supplier payments are not included."
        value={draft.spendAtMost}
        error={errors.spendAtMost}
        onChange={(spendAtMost) => setDraft((current) => ({ ...current, spendAtMost }))}
      />
      <MoneyField
        id="goal-debt"
        label="Customers should owe me less than"
        hint="The open balance today, not only this period."
        value={draft.oweLessThan}
        error={errors.oweLessThan}
        onChange={(oweLessThan) => setDraft((current) => ({ ...current, oweLessThan }))}
      />
      <MoneyField
        id="goal-suppliers"
        label="Pay suppliers"
        hint="Money you pay suppliers in this period."
        value={draft.paySuppliers}
        error={errors.paySuppliers}
        onChange={(paySuppliers) => setDraft((current) => ({ ...current, paySuppliers }))}
      />

      {errors.form ? <p className="text-sm text-destructive">{errors.form}</p> : null}
      {note ? <p className="text-sm leading-6 text-muted-foreground">{note}</p> : null}

      <div className="flex flex-col gap-2">
        <Button type="submit">
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
          setErrors({});
        }}
      />
    </form>
  );
}

function readField(id: string, fallback: string) {
  const node = document.getElementById(id);
  return node instanceof HTMLInputElement ? node.value : fallback;
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
  error,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: number | null;
  error?: string;
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
          aria-invalid={Boolean(error)}
          value={value == null ? "" : new Intl.NumberFormat("en-US").format(value)}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, "").slice(0, 12);
            onChange(digits ? Number(digits) : null);
          }}
        />
      </div>
      {error ? <p className="mt-1 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
