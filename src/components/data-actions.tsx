"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { isCloudConfigured } from "@/lib/cloud-config";
import { useLedger } from "@/lib/use-ledger";

export function DataActions({ compact = false }: { compact?: boolean }) {
  const { loadDemo, clear, entries } = useLedger();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          onClick={() => {
            const count = loadDemo();
            setNote(`${count} sample records loaded. They are marked Sample.`);
          }}
        >
          Load demo data
        </Button>
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={() => setOpen(true)}
          disabled={entries.length === 0}
        >
          Clear all data
        </Button>
      </div>
      {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
      <ConfirmDialog
        open={open}
        title="Clear all records?"
        body={
          isCloudConfigured()
            ? "This removes every sale, cost, and sample from this phone and from your cloud backup. It cannot be undone."
            : "This removes every sale, cost, and sample from this phone. It cannot be undone."
        }
        confirmLabel="Clear all"
        destructive
        onOpenChange={setOpen}
        onConfirm={() => {
          clear();
          setNote(
            isCloudConfigured()
              ? "All records were cleared. Cloud backup will remove them too."
              : "All records were cleared from this phone.",
          );
        }}
      />
    </div>
  );
}
