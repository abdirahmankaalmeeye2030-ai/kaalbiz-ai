"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatUgx } from "@/lib/money";
import { TYPE_LABELS } from "@/lib/labels";
import { LOW_CONFIDENCE_THRESHOLD, TRANSACTION_TYPES, type DraftTransaction } from "@/lib/types";

const fieldClass =
  "h-11 w-full rounded-xl border border-input bg-card px-3 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function DraftCard({
  draft,
  onChange,
  onDiscard,
  onConfirm,
}: {
  draft: DraftTransaction;
  onChange: (next: DraftTransaction) => void;
  onDiscard: () => void;
  onConfirm: () => void;
}) {
  const low = draft.confidence < LOW_CONFIDENCE_THRESHOLD;
  const canSave = draft.amount > 0 && draft.description.trim().length > 0 && draft.date.length === 10;

  return (
    <article
      className={
        low
          ? "rounded-2xl border-2 border-[#e2b15c] bg-warning-bg/40 p-4"
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
              value={draft.counterparty ?? ""}
              placeholder="Optional"
              onChange={(event) =>
                onChange({ ...draft, counterparty: event.target.value.trim() ? event.target.value : null })
              }
            />
          </div>
        </div>
        {draft.notes ? <p className="text-sm leading-6 text-muted-foreground">{draft.notes}</p> : null}
      </div>

      <div className="mt-4 flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onDiscard}>
          Discard
        </Button>
        <Button type="button" className="flex-1" onClick={onConfirm} disabled={!canSave}>
          Confirm
        </Button>
      </div>
    </article>
  );
}
