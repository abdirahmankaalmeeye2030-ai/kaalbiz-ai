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
  const entries = useMemo(() => parseLedger(raw), [raw]);

  const add = useCallback((incoming: LedgerEntry[]) => {
    saveLedger([...parseLedger(getSnapshot()), ...incoming]);
  }, []);

  const remove = useCallback((id: string) => {
    saveLedger(parseLedger(getSnapshot()).filter((entry) => entry.id !== id));
  }, []);

  const update = useCallback((id: string, patch: Partial<LedgerEntry>) => {
    saveLedger(parseLedger(getSnapshot()).map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  }, []);

  const loadDemo = useCallback(() => {
    const next = withDemoData(parseLedger(getSnapshot()), kampalaToday());
    saveLedger(next);
    return next.filter((entry) => entry.isSample).length;
  }, []);

  const clear = useCallback(() => {
    saveLedger([]);
  }, []);

  return { entries, ready: true, add, remove, update, loadDemo, clear };
}
