"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { computeTotals } from "@/lib/calculations";
import { postJson } from "@/lib/client";
import { formatDisplayDate, kampalaToday } from "@/lib/dates";
import { evaluateGoals, goalSummaryLine } from "@/lib/goals";
import { salesByPerson } from "@/lib/people";
import { formatUgx } from "@/lib/money";
import { useGoals } from "@/lib/use-goals";
import { useLedger } from "@/lib/use-ledger";
import type { SummaryResponse } from "@/lib/types";

export function SummaryScreen() {
  const { entries, ready } = useLedger();
  const { goals } = useGoals();
  const goalLine = goals ? goalSummaryLine(evaluateGoals(goals, entries, kampalaToday())) : null;
  const [date, setDate] = useState(kampalaToday);
  const [summary, setSummary] = useState<{ signature: string; data: SummaryResponse } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const signature = `${date}:${entries.map((entry) => entry.id).join("|")}`;

  useEffect(() => {
    if (!ready || !date) return;
    let active = true;
    postJson<SummaryResponse>("/api/summary", { date, transactions: entries })
      .then((data) => {
        if (active) setSummary({ signature, data });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Could not write the summary.");
      });
    return () => {
      active = false;
    };
  }, [date, entries, ready, signature]);

  const written = summary?.signature === signature ? summary.data : null;

  const day = entries.filter((entry) => entry.date === date);
  const dayTotals = computeTotals(day);
  const outstanding = computeTotals(entries).outstanding;
  const byPerson = salesByPerson(entries);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-3xl tracking-tight">Daily note</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          The figures are calculated here. A short note can be written from those figures.
        </p>
      </div>

      <div>
        <Label htmlFor="summary-date">Date</Label>
        <Input
          id="summary-date"
          className="mt-1"
          type="date"
          value={date}
          onChange={(event) => {
            setDate(event.target.value);
            setError(null);
          }}
        />
      </div>

      {!ready || !date ? <p className="text-sm text-muted-foreground">Loading your records…</p> : null}

      {date ? (
        <div className="grid grid-cols-2 gap-3">
          <Figure label="Sales" value={formatUgx(dayTotals.sales)} />
          <Figure label="Money spent" value={formatUgx(dayTotals.expenses)} />
          <Figure label="Money in" value={formatUgx(dayTotals.cashIn)} />
          <Figure label="Money out" value={formatUgx(dayTotals.cashOut)} />
          <Figure label="Cash left" value={formatUgx(dayTotals.net)} />
          <Figure label="Records" value={String(dayTotals.count)} />
        </div>
      ) : null}

      <Card>
        <p className="text-sm font-semibold">Sales by person</p>
        {byPerson.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No sales yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {byPerson.map((row) => (
              <li key={row.name} className="flex items-center justify-between gap-3 text-sm">
                <span>{row.name}</span>
                <span className="font-semibold tabular-nums">{formatUgx(row.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <p className="text-sm font-semibold">Customers still owe you</p>
        <p className="mt-1 font-serif text-2xl">{formatUgx(outstanding)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          This is the open balance across all days, not only {date ? formatDisplayDate(date) : "this day"}.
        </p>
      </Card>

      {goalLine ? (
        <Card>
          <p className="text-sm font-semibold">Goal progress</p>
          <p className="mt-1 text-base leading-7">{goalLine}</p>
        </Card>
      ) : null}

      <Card>
        {ready && date && !written && !error ? (
          <p className="text-sm text-muted-foreground">Writing the note…</p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {written ? (
          <div className="space-y-3">
            <Badge variant={written.source === "ai" ? "default" : "warning"}>{written.badge}</Badge>
            {written.message ? <p className="text-sm text-muted-foreground">{written.message}</p> : null}
            <p className="text-base leading-7">{written.summary}</p>
            <div>
              <p className="text-sm font-semibold">What to do next</p>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6">
                {written.tips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-serif text-xl leading-tight">{value}</p>
    </Card>
  );
}
