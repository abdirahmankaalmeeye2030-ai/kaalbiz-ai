"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { saveGoals, GOALS_EVENT, GOALS_KEY, parseStoredGoals } from "./goals-storage";
import type { GoalSettings } from "./goals";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(GOALS_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(GOALS_EVENT, onChange);
  };
}

function readGoals() {
  return window.localStorage.getItem(GOALS_KEY) ?? "";
}

export function useGoals() {
  const raw = useSyncExternalStore(subscribe, readGoals, () => "");
  const goals = useMemo(() => parseStoredGoals(raw), [raw]);
  const save = useCallback((next: GoalSettings | null) => {
    saveGoals(next);
  }, []);
  return { goals, save };
}
