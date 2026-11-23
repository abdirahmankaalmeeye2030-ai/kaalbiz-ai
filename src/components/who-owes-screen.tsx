"use client";

import Link from "next/link";
import { customerDebts, supplierDebts, type DebtAccount } from "@/lib/people";
import { formatDisplayDate, kampalaToday } from "@/lib/dates";
import { formatUgx } from "@/lib/money";
import { useLedger } from "@/lib/use-ledger";
import { cn } from "@/lib/utils";

export function WhoOwesScreen() {
  const { entries } = useLedger();
  const today = kampalaToday();
  const customers = customerDebts(entries, today);
  const suppliers = supplierDebts(entries, today);

  return (
    <div className="space-y-5">
      <div>
        <Link href="/dashboard" className="text-sm font-semibold text-primary">
          Back to today
        </Link>
        <h1 className="mt-2 font-serif text-3xl tracking-tight">Who owes</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Sorted by the agreed pay date. Overdue is marked in red.
        </p>
      </div>
      <DebtSection title="Customers owe me" rows={customers} empty="No customer still owes you." />
      <DebtSection title="I owe suppliers" rows={suppliers} empty="You do not owe a supplier." />
    </div>
  );
}

function DebtSection({ title, rows, empty }: { title: string; rows: DebtAccount[]; empty: string }) {
  return (
    <section className="space-y-3">
      <h2 className="font-semibold">{title}</h2>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : null}
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.name} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{row.name}</p>
                <p className={cn("mt-1 text-sm font-semibold", urgencyClass(row.urgency))}>
                  {dueLabel(row)}
                </p>
              </div>
              <p className="font-semibold tabular-nums">{formatUgx(row.balance)}</p>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {row.location?.trim() || "Location not set"}
              {row.agreedAmount ? ` · Agreed ${formatUgx(row.agreedAmount)}` : ""}
            </p>
            {row.phone ? (
              <a
                href={`tel:${row.phone}`}
                className="mt-3 inline-flex h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
              >
                Call
              </a>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Phone not set</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function dueLabel(row: DebtAccount): string {
  if (!row.dueDate) return "Pay date not set";
  const date = formatDisplayDate(row.dueDate);
  if (row.urgency === "overdue") return `Overdue · ${date}`;
  if (row.urgency === "soon") return `Due soon · ${date}`;
  return `Due ${date}`;
}

function urgencyClass(urgency: DebtAccount["urgency"]): string {
  if (urgency === "overdue") return "text-destructive";
  if (urgency === "soon") return "text-warning";
  return "text-muted-foreground";
}
