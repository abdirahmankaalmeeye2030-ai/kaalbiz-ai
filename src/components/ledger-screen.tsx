"use client";

import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataActions } from "@/components/data-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addDays, formatDisplayDate, kampalaToday } from "@/lib/dates";
import { filterTransactions, sortTransactions } from "@/lib/calculations";
import {
  LEDGER_HEADERS,
  ledgerFilename,
  ledgerPaymentStatus,
  ledgerSheetTotals,
  ledgerToCsv,
  ledgerToXlsx,
  ledgerTypeLabel,
} from "@/lib/ledger-sheet";
import { formatUgx } from "@/lib/money";
import { useLedger } from "@/lib/use-ledger";
import { TRANSACTION_TYPES, type LedgerEntry, type TransactionType } from "@/lib/types";
import { cn } from "@/lib/utils";

type DateFilter = "all" | "today" | "week" | "custom";

export function LedgerScreen() {
  const { entries, ready, remove } = useLedger();
  const [types, setTypes] = useState<TransactionType[]>([]);
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [customDate, setCustomDate] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const today = kampalaToday();

  const range = useMemo(() => {
    if (dateFilter === "today") return { from: today, to: today };
    if (dateFilter === "week") return { from: addDays(today, -6), to: today };
    if (dateFilter === "custom" && customDate) return { from: customDate, to: customDate };
    return {};
  }, [customDate, dateFilter, today]);

  const visible = sortTransactions(filterTransactions(entries, { types, ...range }));
  const totals = useMemo(() => ledgerSheetTotals(visible), [visible]);
  const deleting = entries.find((entry) => entry.id === pendingDelete);
  const downloadDisabled = !ready || visible.length === 0 || exporting;

  function saveFile(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadCsv() {
    setExportError(null);
    const csv = ledgerToCsv(visible);
    saveFile(new Blob([csv], { type: "text/csv;charset=utf-8" }), ledgerFilename(today, "csv", types));
  }

  async function downloadExcel() {
    setExporting(true);
    setExportError(null);
    try {
      const buffer = await ledgerToXlsx(visible);
      saveFile(
        new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        ledgerFilename(today, "xlsx", types),
      );
    } catch {
      setExportError("Could not make the Excel file. Try again.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-3xl tracking-tight">Ledger</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Confirmed records stay on this phone. Sample rows are marked.
        </p>
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold" id="ledger-type-label">
            Type
          </p>
          <p className="text-sm font-semibold tabular-nums" role="status">
            {visible.length} {visible.length === 1 ? "entry" : "entries"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby="ledger-type-label">
          <FilterChip selected={types.length === 0} onClick={() => setTypes([])}>
            All
          </FilterChip>
          {TRANSACTION_TYPES.map((item) => (
            <FilterChip
              key={item}
              selected={types.includes(item)}
              onClick={() =>
                setTypes((current) =>
                  current.includes(item) ? current.filter((value) => value !== item) : [...current, item],
                )
              }
            >
              {ledgerTypeLabel(item)}
            </FilterChip>
          ))}
        </div>
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

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" className="flex-1" disabled={downloadDisabled} onClick={() => void downloadExcel()}>
          {exporting ? "Preparing Excel…" : "Download Excel"}
        </Button>
        <Button type="button" variant="outline" className="flex-1" disabled={downloadDisabled} onClick={downloadCsv}>
          Download CSV
        </Button>
      </div>
      {ready && visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {entries.length === 0
            ? "Add a record before you download."
            : "Nothing in this view to download. Show all records, or pick another filter."}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">The file includes only the records in this view.</p>
      )}
      {exportError ? (
        <p className="text-sm text-destructive" role="alert">
          {exportError}
        </p>
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

      {visible.length > 0 ? <LedgerTable rows={visible} totals={totals} onDelete={setPendingDelete} /> : null}

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

function formatSheetAmount(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? "−" : "";
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(Math.abs(rounded));
  return `${sign}${formatted}`;
}

function LedgerTable({
  rows,
  totals,
  onDelete,
}: {
  rows: LedgerEntry[];
  totals: { moneyIn: number; moneyOut: number; net: number };
  onDelete: (id: string) => void;
}) {
  const totalLines = [
    ["Money in", totals.moneyIn],
    ["Money out", totals.moneyOut],
    ["Net", totals.net],
  ] as const;

  return (
    <div className="max-h-[70vh] overflow-auto rounded-xl border border-border bg-card">
      <table className="w-max min-w-full border-collapse text-sm" aria-label="Ledger">
        <thead>
          <tr>
            {LEDGER_HEADERS.map((label, index) => (
              <th
                key={label}
                scope="col"
                className={cn(
                  "sticky top-0 z-20 border border-border bg-secondary px-3 py-2 text-left font-semibold whitespace-nowrap",
                  index === 0 && "left-0 z-30 min-w-28",
                  index === 4 && "text-right",
                )}
              >
                {label}
              </th>
            ))}
            <th scope="col" className="sticky top-0 z-20 border border-border bg-secondary px-3 py-2 font-semibold">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((entry, index) => {
            const zebra = index % 2 === 1;
            const fill = zebra ? "bg-[#f3ecdf]" : "bg-card";
            return (
              <tr key={entry.id} className={fill}>
                <td className={cn("sticky left-0 z-10 border border-border px-3 py-2 whitespace-nowrap", fill)}>
                  {formatDisplayDate(entry.date)}
                </td>
                <td className="border border-border px-3 py-2 whitespace-nowrap">{ledgerTypeLabel(entry.type)}</td>
                <td className="border border-border px-3 py-2">
                  <span className="font-semibold">{entry.description}</span>
                  {entry.isSample ? (
                    <Badge variant="sample" className="ml-2 align-middle">
                      Sample
                    </Badge>
                  ) : null}
                </td>
                <td className="border border-border px-3 py-2 whitespace-nowrap">
                  {entry.counterparty?.trim() || "—"}
                </td>
                <td className="border border-border px-3 py-2 text-right font-semibold tabular-nums whitespace-nowrap">
                  {formatSheetAmount(entry.amount)}
                </td>
                <td className="border border-border px-3 py-2 whitespace-nowrap">
                  {ledgerPaymentStatus(entry.type) || "—"}
                </td>
                <td className="border border-border px-2 py-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-transparent hover:text-destructive"
                    onClick={() => onDelete(entry.id)}
                  >
                    Delete
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          {totalLines.map(([label, amount]) => (
            <tr key={label} className="font-semibold">
              <td className="sticky left-0 z-10 border border-border bg-secondary px-3 py-2">{label}</td>
              <td className="border border-border bg-secondary px-3 py-2" colSpan={3}>
                {label === "Net" ? "Money in minus money out" : ""}
              </td>
              <td className="border border-border bg-secondary px-3 py-2 text-right tabular-nums">
                {formatSheetAmount(amount)}
              </td>
              <td className="border border-border bg-secondary px-3 py-2" colSpan={2} />
            </tr>
          ))}
        </tfoot>
      </table>
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
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "min-h-11 shrink-0 rounded-full px-3 text-sm font-semibold",
        selected ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground",
      )}
    >
      {children}
    </button>
  );
}
