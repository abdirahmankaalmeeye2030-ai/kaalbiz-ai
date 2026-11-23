import { computeTotals } from "./calculations";
import { addDays, daysBetween, isIsoDate } from "./dates";
import { formatUgx } from "./money";
import type { LedgerEntry } from "./types";

export interface GoalSettings {
  startDate: string;
  endDate: string;
  sellAtLeast: number | null;
  spendAtMost: number | null;
  oweLessThan: number | null;
  paySuppliers: number | null;
}

export type GoalKind = "sales" | "spend" | "debt" | "suppliers";
export type GoalStatus = "on_track" | "behind" | "over";

export interface GoalProgress {
  kind: GoalKind;
  label: string;
  target: number;
  progress: number;
  percent: number;
  status: GoalStatus;
  daysLeft: number;
  daysLeftLabel: string;
  hint: string | null;
  collectedThisPeriod: number | null;
  line: string;
}

export interface GoalWindow {
  periodDays: number;
  elapsedDays: number;
  daysLeft: number;
}

function wholeAmount(value: number): number {
  return Math.max(0, Math.round(value));
}

export function goalWindow(startDate: string, endDate: string, today: string): GoalWindow {
  const periodDays = Math.max(1, daysBetween(startDate, endDate) + 1);
  let elapsedDays = 0;
  if (today >= startDate) {
    elapsedDays = Math.min(periodDays, daysBetween(startDate, today) + 1);
  }
  const daysLeft = today >= endDate ? 0 : Math.max(0, daysBetween(today, endDate));
  return { periodDays, elapsedDays, daysLeft };
}

export function expectedByPace(target: number, window: GoalWindow): number {
  return Math.round((target * window.elapsedDays) / window.periodDays);
}

export function roundDailyPace(amount: number): number {
  if (amount <= 0) return 0;
  if (amount < 1000) return Math.ceil(amount);
  return Math.ceil(amount / 1000) * 1000;
}

function daysLeftLabel(daysLeft: number, today: string, endDate: string): string {
  if (daysLeft === 1) return "1 day left";
  if (daysLeft > 1) return `${daysLeft} days left`;
  return today > endDate ? "period ended" : "last day";
}

function sumInPeriod(entries: LedgerEntry[], type: LedgerEntry["type"], startDate: string, endDate: string): number {
  return entries.reduce((sum, entry) => {
    if (entry.type !== type || entry.date < startDate || entry.date > endDate) return sum;
    return sum + wholeAmount(entry.amount);
  }, 0);
}

function reachStatus(progress: number, expected: number): GoalStatus {
  return progress >= expected ? "on_track" : "behind";
}

function limitStatus(progress: number, target: number, expected: number): GoalStatus {
  if (progress > target) return "over";
  if (progress > expected) return "behind";
  return "on_track";
}

export function evaluateGoals(settings: GoalSettings, entries: LedgerEntry[], today: string): GoalProgress[] {
  const window = goalWindow(settings.startDate, settings.endDate, today);
  const sales = sumInPeriod(entries, "sale", settings.startDate, settings.endDate);
  const spend = sumInPeriod(entries, "expense", settings.startDate, settings.endDate);
  const collected = sumInPeriod(entries, "debt_payment_received", settings.startDate, settings.endDate);
  const suppliers = sumInPeriod(entries, "supplier_payment", settings.startDate, settings.endDate);
  const owed = computeTotals(entries).outstanding;
  const results: GoalProgress[] = [];

  if (settings.sellAtLeast != null) {
    results.push(
      buildReachGoal("sales", "Sales", settings.sellAtLeast, sales, window, settings.endDate, today, "Sell"),
    );
  }
  if (settings.spendAtMost != null) {
    results.push(buildSpendGoal(settings.spendAtMost, spend, window, settings.endDate, today));
  }
  if (settings.oweLessThan != null) {
    results.push(buildDebtGoal(settings.oweLessThan, owed, collected, window, settings.endDate, today));
  }
  if (settings.paySuppliers != null) {
    results.push(
      buildReachGoal(
        "suppliers",
        "Suppliers",
        settings.paySuppliers,
        suppliers,
        window,
        settings.endDate,
        today,
        "Pay suppliers",
      ),
    );
  }
  return results;
}

function buildReachGoal(
  kind: "sales" | "suppliers",
  label: string,
  target: number,
  progress: number,
  window: GoalWindow,
  endDate: string,
  today: string,
  verb: string,
): GoalProgress {
  const expected = expectedByPace(target, window);
  const status = reachStatus(progress, expected);
  const remaining = Math.max(0, target - progress);
  const daily = window.daysLeft > 0 ? roundDailyPace(remaining / window.daysLeft) : 0;
  const left = daysLeftLabel(window.daysLeft, today, endDate);
  const hint =
    remaining <= 0
      ? "You have reached this goal."
      : daily > 0
        ? `${verb} about ${formatUgx(daily)} a day to reach your goal.`
        : "This period has ended and the goal was not reached.";
  return {
    kind,
    label,
    target,
    progress,
    percent: percentOf(progress, target),
    status,
    daysLeft: window.daysLeft,
    daysLeftLabel: left,
    hint,
    collectedThisPeriod: null,
    line: progressLine(label, progress, target, left),
  };
}

function buildSpendGoal(target: number, progress: number, window: GoalWindow, endDate: string, today: string): GoalProgress {
  const expected = expectedByPace(target, window);
  const status = limitStatus(progress, target, expected);
  const room = Math.max(0, target - progress);
  const daily = window.daysLeft > 0 ? roundDailyPace(room / window.daysLeft) : 0;
  const left = daysLeftLabel(window.daysLeft, today, endDate);
  const hint =
    status === "over"
      ? "You are past the spending limit."
      : daily > 0
        ? `Try to spend no more than about ${formatUgx(daily)} a day.`
        : "The spending period has ended.";
  return {
    kind: "spend",
    label: "Spending",
    target,
    progress,
    percent: percentOf(progress, target),
    status,
    daysLeft: window.daysLeft,
    daysLeftLabel: left,
    hint,
    collectedThisPeriod: null,
    line: progressLine("Spending", progress, target, left),
  };
}

function buildDebtGoal(
  target: number,
  owed: number,
  collected: number,
  window: GoalWindow,
  endDate: string,
  today: string,
): GoalProgress {
  const status: GoalStatus = owed > target ? "over" : "on_track";
  const gap = Math.max(0, owed - target);
  const left = daysLeftLabel(window.daysLeft, today, endDate);
  const hint =
    status === "over"
      ? `Customers owe you more than your limit. Collect about ${formatUgx(gap)} to get under it.`
      : "Customers owe you less than your limit.";
  return {
    kind: "debt",
    label: "Customers owe you",
    target,
    progress: owed,
    percent: percentOf(owed, target),
    status,
    daysLeft: window.daysLeft,
    daysLeftLabel: left,
    hint,
    collectedThisPeriod: collected,
    line: progressLine("Customers owe you", owed, target, left),
  };
}

function percentOf(progress: number, target: number): number {
  if (target <= 0) return 0;
  return Math.round((progress / target) * 100);
}

function progressLine(label: string, progress: number, target: number, daysLeftLabelText: string): string {
  return `${label}: ${formatUgx(progress)} of ${formatUgx(target)} (${percentOf(progress, target)}%) — ${daysLeftLabelText}`;
}

export function goalSummaryLine(items: GoalProgress[]): string | null {
  if (items.length === 0) return null;
  return `Goals: ${items.map((item) => `${item.label} ${formatUgx(item.progress)} of ${formatUgx(item.target)}`).join(". ")}.`;
}

export function previousGoalPeriod(startDate: string, endDate: string): { startDate: string; endDate: string } {
  const length = Math.max(1, daysBetween(startDate, endDate) + 1);
  const previousEnd = addDays(startDate, -1);
  return { startDate: addDays(previousEnd, -(length - 1)), endDate: previousEnd };
}

function roundSuggestion(amount: number): number | null {
  const rounded = Math.round(amount / 1000) * 1000;
  return rounded > 0 ? rounded : null;
}

export function suggestGoals(entries: LedgerEntry[], startDate: string, endDate: string): Pick<
  GoalSettings,
  "sellAtLeast" | "spendAtMost" | "oweLessThan" | "paySuppliers"
> {
  const previous = previousGoalPeriod(startDate, endDate);
  const sales = sumInPeriod(entries, "sale", previous.startDate, previous.endDate);
  const spend = sumInPeriod(entries, "expense", previous.startDate, previous.endDate);
  const suppliers = sumInPeriod(entries, "supplier_payment", previous.startDate, previous.endDate);
  const owed = computeTotals(entries).outstanding;
  return {
    sellAtLeast: roundSuggestion(sales * 1.1),
    spendAtMost: roundSuggestion(spend * 0.9),
    oweLessThan: roundSuggestion(owed * 0.9),
    paySuppliers: roundSuggestion(suppliers * 1.1),
  };
}

export function parseGoalSettings(value: unknown): GoalSettings | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<GoalSettings>;
  if (!isIsoDate(raw.startDate ?? "") || !isIsoDate(raw.endDate ?? "")) return null;
  if ((raw.endDate as string) < (raw.startDate as string)) return null;
  const amounts = {
    sellAtLeast: optionalAmount(raw.sellAtLeast),
    spendAtMost: optionalAmount(raw.spendAtMost),
    oweLessThan: optionalAmount(raw.oweLessThan),
    paySuppliers: optionalAmount(raw.paySuppliers),
  };
  if (Object.values(amounts).some((amount) => amount === undefined)) return null;
  return {
    startDate: raw.startDate as string,
    endDate: raw.endDate as string,
    sellAtLeast: amounts.sellAtLeast ?? null,
    spendAtMost: amounts.spendAtMost ?? null,
    oweLessThan: amounts.oweLessThan ?? null,
    paySuppliers: amounts.paySuppliers ?? null,
  };
}

function optionalAmount(value: unknown): number | null | undefined {
  if (value == null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;
  return Math.round(value);
}
