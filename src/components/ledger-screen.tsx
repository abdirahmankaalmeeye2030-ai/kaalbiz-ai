"use client";

import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataActions } from "@/components/data-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addDays, formatDisplayDate, kampalaToday } from "@/lib/dates";
import { TYPE_LABELS } from "@/lib/labels";
import { formatUgx } from "@/lib/money";
import { filterTransactions, sortTransactions } from "@/lib/calculations";
import { useLedger } from "@/lib/use-ledger";
import { TRANSACTION_TYPES, type TransactionType } from "@/lib/types";
import { cn } from "@/lib/utils";

type DateFilter = "all" | "today" | "week" | "custom";

export function LedgerScreen() {
  const { entries, ready, remove } = useLedger();
  const [type, setType] = useState<TransactionType | "all">("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [customDate, setCustomDate] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const today = kampalaToday();

  const range = useMemo(() => {
    if (dateFilter === "today") return { from: today, to: today };
    if (dateFilter === "week") return { from: addDays(today, -6), to: today };
    if (dateFilter === "custom" && customDate) return { from: customDate, to: customDate };
    return {};
  }, [customDate, dateFilter, today]);

  const visible = sortTransactions(filterTransactions(entries, { type, ...range }));
  const deleting = entries.find((entry) => entry.id === pendingDelete);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-3xl tracking-tight">Ledger</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Confirmed records stay on this phone. Sample rows are marked.
        </p>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <FilterChip selected={type === "all"} onClick={() => setType("all")}>
          All
        </FilterChip>
        {TRANSACTION_TYPES.map((item) => (
          <FilterChip key={item} selected={type === item} onClick={() => setType(item)}>
            {TYPE_LABELS[item]}
          </FilterChip>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "All dates"],
            ["today", "Today"],
            ["week", "Last 7 days"],
            ["custom", "Pick a date"],
          ] as const
        ).map(([value, label]) => (
          <FilterChip key={value} selected={dateFilter === value} onClick={() => setDateFilter(value)}>
            {label}
          </FilterChip>
        ))}
      </div>
      {dateFilter === "custom" ? (
        <Input type="date" value={customDate} onChange={(event) => setCustomDate(event.target.value)} aria-label="Filter by date" />
      ) : null}

      {!ready ? <p className="text-sm text-muted-foreground">Loading your records…</p> : null}

      {ready && visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-4 py-6">
          <p className="font-semibold">No records in this view.</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Record a sale, or load sample data to walk through the app.
          </p>
          <div className="mt-4">
            <DataActions />
          </div>
        </div>
      ) : null}

      {visible.length > 0 ? (
        <ul className="space-y-3">
          {visible.map((entry) => (
            <li key={entry.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="neutral">{TYPE_LABELS[entry.type]}</Badge>
                    {entry.isSample ? <Badge variant="sample">Sample</Badge> : null}
                  </div>
                  <p className="mt-2 font-semibold leading-6">{entry.description}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {[entry.counterparty, entry.category, formatDisplayDate(entry.date)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <p className="shrink-0 font-semibold">{formatUgx(entry.amount)}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 px-0 text-destructive hover:bg-transparent hover:text-destructive"
                onClick={() => setPendingDelete(entry.id)}
              >
                Delete
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {ready && entries.length > 0 ? (
        <div className="border-t border-border pt-4">
          <DataActions compact />
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Remove this record?"
        body={
          deleting
            ? `${deleting.description} (${formatUgx(deleting.amount)}) will be deleted from this phone.`
            : "This deletes it from this phone."
        }
        confirmLabel="Remove"
        destructive
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        onConfirm={() => {
          if (pendingDelete) remove(pendingDelete);
        }}
      />
    </div>
  );
}

function FilterChip({
  selected,
  children,
  onClick,
}: {
  selected: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 shrink-0 rounded-full px-3 text-sm font-semibold",
        selected ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground",
      )}
    >
      {children}
    </button>
  );
}
