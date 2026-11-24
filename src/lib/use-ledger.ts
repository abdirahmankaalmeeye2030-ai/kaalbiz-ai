"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { kampalaToday } from "./dates";
import {
  LEDGER_EVENT,
  LEDGER_KEY,
  parseLedger,
  saveLedger,
  withDemoData,
} from "./storage";
import { activeRecords } from "./sync";
import type { LedgerEntry } from "./types";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(LEDGER_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(LEDGER_EVENT, onStoreChange);
  };
}

function getSnapshot() {
  return window.localStorage.getItem(LEDGER_KEY) ?? "";
}

function getServerSnapshot() {
  return "";
}

export function useLedger() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const entries = useMemo(() => activeRecords(parseLedger(raw).map(asSyncRow)), [raw]);

  const add = useCallback((incoming: LedgerEntry[]) => {
    const now = new Date().toISOString();
    const stamped = incoming.map((entry) => ({
      ...entry,
      updatedAt: entry.updatedAt || now,
      deletedAt: entry.deletedAt ?? null,
    }));
    saveLedger([...parseLedger(getSnapshot()), ...stamped]);
  }, []);

  const remove = useCallback((id: string) => {
    const now = new Date().toISOString();
    saveLedger(
      parseLedger(getSnapshot()).map((entry) =>
        entry.id === id ? { ...entry, updatedAt: now, deletedAt: now } : entry,
      ),
    );
  }, []);

  const update = useCallback((id: string, patch: Partial<LedgerEntry>) => {
    const now = new Date().toISOString();
    saveLedger(
      parseLedger(getSnapshot()).map((entry) =>
        entry.id === id ? { ...entry, ...patch, updatedAt: patch.updatedAt ?? now } : entry,
      ),
    );
  }, []);

  const loadDemo = useCallback(() => {
    const next = withDemoData(parseLedger(getSnapshot()), kampalaToday());
    saveLedger(next);
    return next.filter((entry) => entry.isSample).length;
  }, []);

  const clear = useCallback(() => {
    const now = new Date().toISOString();
    saveLedger(
      parseLedger(getSnapshot()).map((entry) => (entry.deletedAt ? entry : { ...entry, updatedAt: now, deletedAt: now })),
    );
    window.localStorage.setItem(CLEAR_SYNC_KEY, now);
  }, []);

  return { entries, ready: true, add, remove, update, loadDemo, clear };
}

export const CLEAR_SYNC_KEY = "kaalbiz.sync.clear";

function asSyncRow(entry: LedgerEntry) {
  return { ...entry, updatedAt: entry.updatedAt || entry.createdAt, deletedAt: entry.deletedAt ?? null };
}
