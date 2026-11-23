import { parseGoalSettings, type GoalSettings } from "./goals";

export const GOALS_KEY = "kaalbiz.goals.v1";
export const GOALS_EVENT = "kaalbiz:goals";

export function parseStoredGoals(raw: string | null): GoalSettings | null {
  if (!raw) return null;
  try {
    return parseGoalSettings(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function saveGoals(goals: GoalSettings | null): void {
  if (!goals) window.localStorage.removeItem(GOALS_KEY);
  else window.localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
  window.dispatchEvent(new Event(GOALS_EVENT));
}
