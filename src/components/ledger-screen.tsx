"use client";

import Link from "next/link";
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
import { isCloudConfigured } from "@/lib/cloud-config";
import { formatUgx } from "@/lib/money";
import { useStaff } from "@/lib/use-people";
import { useLedger } from "@/lib/use-ledger";
import { TRANSACTION_TYPES, type LedgerEntry, type TransactionType } from "@/lib/types";
import { cn } from "@/lib/utils";

type DateFilter = "all" | "today" | "week" | "custom";

export function LedgerScreen() {
  const { entries, ready, remove, update } = useLedger();
  const { staff } = useStaff();
  const [type, setType] = useState<TransactionType | "all">("all");
  const [person, setPerson] = useState("all");
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

  const people = useMemo(() => {
    const names = new Set(staff);
    for (const entry of entries) names.add(entry.recordedBy?.trim() || "Not set");
    return [...names];
  }, [entries, staff]);
  const visible = sortTransactions(filterTransactions(entries, { type, recordedBy: person, ...range }));
  const selectedTypes = type === "all" ? [] : [type];
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
    saveFile(new Blob([csv], { type: "text/csv;charset=utf-8" }), ledgerFilename(today, "csv", selectedTypes));
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
        ledgerFilename(today, "xlsx", selectedTypes),
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

      <div className="space-y-5 lg:flex lg:items-end lg:justify-between lg:gap-6 lg:space-y-0">
      <div className="min-w-0 flex-1 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
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
        <p className="text-sm font-semibold tabular-nums" role="status">
          {visible.length} {visible.length === 1 ? "entry" : "entries"}
        </p>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="block min-w-40 flex-1">
          <span className="mb-1 block text-xs font-semibold tracking-wide">By ▾</span>
          <select
            aria-label="By"
            value={person}
            onChange={(event) => setPerson(event.target.value)}
            className="h-11 w-full rounded-lg border border-border bg-card px-2 text-base font-semibold"
          >
            <option value="all">All</option>
            {people.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-4 pb-2 text-sm font-semibold">
          <Link href="/who-owes" className="text-primary">
            Who owes
          </Link>
          <Link href="/settings" className="text-primary">
            Staff
          </Link>
        </div>
      </div>
      {dateFilter === "custom" ? (
        <Input type="date" value={customDate} onChange={(event) => setCustomDate(event.target.value)} aria-label="Filter by date" />
      ) : null}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row lg:w-80 lg:shrink-0">
        <Button type="button" className="flex-1" disabled={downloadDisabled} onClick={() => void downloadExcel()}>
          {exporting ? "Preparing Excel…" : "Download Excel"}
        </Button>
        <Button type="button" variant="outline" className="flex-1" disabled={downloadDisabled} onClick={downloadCsv}>
          Download CSV
        </Button>
      </div>
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

      {ready && entries.length === 0 ? (
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

      {ready && entries.length > 0 ? (
        <LedgerTable
          rows={visible}
          totals={totals}
          type={type}
          onTypeChange={setType}
          staff={staff}
          onUpdate={update}
          onDelete={setPendingDelete}
        />
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
            ? `${deleting.description} (${formatUgx(deleting.amount)}) will be removed from this phone${isCloudConfigured() ? " and from your cloud backup" : ""}.`
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
  type,
  onTypeChange,
  staff,
  onUpdate,
  onDelete,
}: {
  rows: LedgerEntry[];
  totals: { moneyIn: number; moneyOut: number; net: number };
  type: TransactionType | "all";
  onTypeChange: (type: TransactionType | "all") => void;
  staff: string[];
  onUpdate: (id: string, patch: Partial<LedgerEntry>) => void;
  onDelete: (id: string) => void;
}) {
  const totalLines = [
    ["Money in", totals.moneyIn],
    ["Money out", totals.moneyOut],
    ["Net", totals.net],
  ] as const;

  return (
    <div className="max-h-[70vh] overflow-auto rounded-xl border border-border bg-card lg:max-h-none lg:overflow-visible">
      <table className="w-max min-w-full border-collapse text-sm lg:w-full" aria-label="Ledger">
        <thead>
          <tr>
            {LEDGER_HEADERS.map((label, index) => (
              <th
                key={label}
                scope="col"
                className={cn(
                  "sticky top-0 z-20 border border-border bg-secondary px-3 py-2 text-left font-semibold whitespace-nowrap",
                  index === 0 && "left-0 z-30 min-w-28",
                  index === 1 && "min-w-44",
                  index === 4 && "text-right",
                )}
              >
                {index === 1 ? (
                  <TypeFilter value={type} onChange={onTypeChange} />
                ) : (
                  label
                )}
              </th>
            ))}
            <th scope="col" className="sticky top-0 z-20 border border-border bg-secondary px-3 py-2 font-semibold">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="border border-border px-3 py-4 text-muted-foreground">
                No records for this type.
              </td>
            </tr>
          ) : null}
          {rows.map((entry, index) => {
            const zebra = index % 2 === 1;
            const fill = zebra ? "bg-zebra" : "bg-card";
            return (
              <tr key={entry.id} className={fill}>
                <td className={cn("sticky left-0 z-10 border border-border px-3 py-2 whitespace-nowrap", fill)}>
                  {formatDisplayDate(entry.date)}
                </td>
                <td className="border border-border px-3 py-2 whitespace-nowrap">{ledgerTypeLabel(entry.type)}</td>
                <td className="border border-border px-3 py-2">
                  <span className="font-semibold">{entry.description}</span>
                  {entry.unitPrice ? (
                    <span className="mt-1 block text-xs text-muted-foreground">Unit price {formatUgx(entry.unitPrice)}</span>
                  ) : null}
                  {entry.isSample ? (
                    <Badge variant="sample" className="ml-2 align-middle">
                      Sample
                    </Badge>
                  ) : null}
                </td>
                <td className="border border-border px-3 py-2 whitespace-nowrap">
                  {entry.counterparty?.trim() || "—"}
                </td>
                <td className="border border-border px-2 py-1 whitespace-nowrap">
                  <select
                    aria-label={`Recorded by for ${entry.description}`}
                    value={entry.recordedBy ?? ""}
                    onChange={(event) => onUpdate(entry.id, { recordedBy: event.target.value || null })}
                    className="h-9 max-w-36 rounded-lg border border-border bg-card px-2 text-sm"
                  >
                    <option value="">Not set</option>
                    {staff.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
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
              <td className="border border-border bg-secondary px-3 py-2" colSpan={4}>
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

function TypeFilter({
  value,
  onChange,
}: {
  value: TransactionType | "all";
  onChange: (type: TransactionType | "all") => void;
}) {
  return (
    <label className="block min-w-40">
      <span className="mb-1 block text-xs font-semibold tracking-wide">Type ▾</span>
      <select
        aria-label="Type"
        value={value}
        onChange={(event) => {
          const next = event.target.value;
          onChange(next === "all" ? "all" : (next as TransactionType));
        }}
        className="h-11 w-full rounded-lg border border-border bg-card px-2 text-base font-semibold text-foreground"
      >
        <option value="all">All</option>
        {TRANSACTION_TYPES.map((item) => (
          <option key={item} value={item}>
            {ledgerTypeLabel(item)}
          </option>
        ))}
      </select>
    </label>
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
