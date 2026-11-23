"use client";

import Link from "next/link";
import { DataActions } from "@/components/data-actions";
import { GoalsCard } from "@/components/goals-card";
import { WeekChart } from "@/components/week-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { computeTotals, last7Days, recentTransactions } from "@/lib/calculations";
import { formatDisplayDate, kampalaToday } from "@/lib/dates";
import { TYPE_LABELS } from "@/lib/labels";
import { formatUgx } from "@/lib/money";
import { useGoals } from "@/lib/use-goals";
import { useLedger } from "@/lib/use-ledger";

export function DashboardScreen() {
  const { entries, ready } = useLedger();
  const { goals } = useGoals();
  const today = kampalaToday();
  const totals = computeTotals(entries);
  const recent = recentTransactions(entries, 5);
  const days = today ? last7Days(entries, today) : [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-3xl tracking-tight">Today</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          These numbers are added up in the app. The assistant never does the math.
        </p>
      </div>

      {!ready ? <p className="text-sm text-muted-foreground">Loading your records…</p> : null}

      {ready ? <GoalsCard goals={goals} entries={entries} today={today} /> : null}

      {ready && entries.length === 0 ? (
        <Card>
          <h2 className="font-serif text-2xl">No records yet</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Tell KaalBiz about a sale, or load sample Kampala records to see the picture.
          </p>
          <Button asChild className="mt-4 w-full">
            <Link href="/">Record something</Link>
          </Button>
          <div className="mt-4">
            <DataActions />
          </div>
        </Card>
      ) : null}

      {ready && entries.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Sales" value={formatUgx(totals.sales)} hint="Cash from sales" />
            <Stat
              label="Money spent"
              value={formatUgx(totals.expenses)}
              hint="Costs, stock, and supplier payments"
            />
            <Stat label="Money in" value={formatUgx(totals.cashIn)} hint="Sales plus debt payments" />
            <Stat label="Money out" value={formatUgx(totals.cashOut)} hint="Same as money spent" />
          </div>
          <Card className="bg-primary text-primary-foreground">
            <p className="text-sm font-semibold text-primary-foreground/80">Cash left</p>
            <p className="mt-1 font-serif text-3xl">{formatUgx(totals.net)}</p>
            <p className="mt-1 text-sm text-primary-foreground/80">Money in minus money out</p>
          </Card>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Customers owe you" value={formatUgx(totals.outstanding)} hint="Open balances" />
            <Stat label="Records" value={String(totals.count)} hint="Confirmed on this phone" />
          </div>

          <Card>
            <h2 className="font-semibold">Last 7 days</h2>
            <div className="mt-3">
              <WeekChart days={days} />
            </div>
          </Card>

          <section>
            <h2 className="font-semibold">Recent records</h2>
            <ul className="mt-3 space-y-2">
              {recent.map((entry) => (
                <li key={entry.id} className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-card px-3 py-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="neutral">{TYPE_LABELS[entry.type]}</Badge>
                      {entry.isSample ? <Badge variant="sample">Sample</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm font-semibold leading-5">{entry.description}</p>
                    <p className="text-xs text-muted-foreground">{formatDisplayDate(entry.date)}</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold">{formatUgx(entry.amount)}</p>
                </li>
              ))}
            </ul>
          </section>

          <DataActions compact />
        </>
      ) : null}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-serif text-xl leading-tight">{value}</p>
      <p className="mt-1 text-xs leading-4 text-muted-foreground">{hint}</p>
    </Card>
  );
}
