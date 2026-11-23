"use client";

import { TrendingUp, Truck, Users, Wallet, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { postJson } from "@/lib/client";
import { formatUgx } from "@/lib/money";
import { GOALS_SAVED_FLAG } from "@/lib/goals-storage";
import { evaluateGoals, goalWindow, type GoalKind, type GoalProgress, type GoalSettings, type GoalStatus } from "@/lib/goals";
import type { GoalTipsRequest } from "@/lib/goal-tips";
import type { LedgerEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

interface GoalTipsResponse {
  source: "ai" | "template";
  badge: string;
  model: string | null;
  tips: string[];
  message?: string;
}

const GOAL_META: Record<GoalKind, { label: string; icon: LucideIcon }> = {
  sales: { label: "Sales", icon: TrendingUp },
  spend: { label: "Spending", icon: Wallet },
  debt: { label: "Customers owe", icon: Users },
  suppliers: { label: "Suppliers paid", icon: Truck },
};

export function GoalsCard({
  goals,
  entries,
  today,
}: {
  goals: GoalSettings | null;
  entries: LedgerEntry[];
  today: string;
}) {
  const progress = goals ? evaluateGoals(goals, entries, today) : [];
  const saved = useSyncExternalStore(subscribeSaved, readSaved, () => false);
  const [tips, setTips] = useState<GoalTipsResponse | null>(null);
  const [tipsError, setTipsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (window.location.hash !== "#goals") return;
    document.getElementById("goals")?.scrollIntoView({ block: "start" });
  }, []);

  async function loadTips() {
    if (!goals || progress.length === 0) return;
    setLoading(true);
    setTipsError(null);
    try {
      const response = await postJson<GoalTipsResponse>("/api/goal-tips", toTipsRequest(goals, progress));
      setTips(response);
    } catch (error) {
      setTips(null);
      setTipsError(error instanceof Error ? error.message : "Could not get tips.");
    } finally {
      setLoading(false);
    }
  }

  const period = goals ? periodLabel(goals, progress, today) : null;

  return (
    <Card id="goals" className="scroll-mt-20">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">Goals</h2>
            {saved ? <span className="text-sm font-semibold text-primary">Saved</span> : null}
          </div>
          {period ? (
            <p className="mt-1 text-xs text-muted-foreground">{period}</p>
          ) : (
            <p className="mt-1 text-sm leading-6 text-muted-foreground">Set a goal for this month.</p>
          )}
        </div>
        <Link href="/goals" className="shrink-0 text-sm font-semibold text-primary">
          {progress.length > 0 ? "Change" : "Set goals"}
        </Link>
      </div>

      {progress.length > 0 ? (
        <ul className="mt-4 grid grid-cols-2 gap-4">
          {progress.map((item) => (
            <GoalTile key={item.kind} item={item} />
          ))}
        </ul>
      ) : null}

      {progress.length > 0 ? (
        <div className="mt-4">
          <Button type="button" variant="outline" size="sm" onClick={() => void loadTips()} disabled={loading}>
            {loading ? "Getting tips…" : "Get tips"}
          </Button>
          {tipsError ? <p className="mt-2 text-sm text-destructive">{tipsError}</p> : null}
          {tips ? (
            <div className="mt-3 space-y-2">
              <Badge variant={tips.source === "ai" ? "default" : "warning"}>{tips.badge}</Badge>
              {tips.message ? <p className="text-xs leading-5 text-muted-foreground">{tips.message}</p> : null}
              <ul className="list-disc space-y-1 pl-5 text-sm leading-6">
                {tips.tips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

function GoalTile({ item }: { item: GoalProgress }) {
  const meta = GOAL_META[item.kind];
  const Icon = meta.icon;
  const full = `${formatUgx(item.progress)} of ${formatUgx(item.target)}`;
  return (
    <li className="min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="truncate text-sm font-semibold">{meta.label}</span>
        </span>
      </div>
      <span className={cn("mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold", statusPill(item.status))}>
        {statusName(item.status)}
      </span>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={item.target}
        aria-valuenow={Math.min(item.target, item.progress)}
        aria-label={`${meta.label}, ${statusName(item.status)}, ${full}`}
      >
        <div
          className={cn("h-full rounded-full", statusBar(item.status))}
          style={{ width: `${Math.min(100, Math.max(0, item.percent))}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs tabular-nums text-muted-foreground" aria-label={full}>
        <span aria-hidden="true">
          {compactAmount(item.progress)} of {compactAmount(item.target)}
        </span>
      </p>
      {item.hint ? <p className="mt-1 text-xs leading-4 text-muted-foreground">{item.hint}</p> : null}
      {item.collectedThisPeriod != null && item.collectedThisPeriod > 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">Collected {formatUgx(item.collectedThisPeriod)}</p>
      ) : null}
    </li>
  );
}

function periodLabel(goals: GoalSettings, progress: GoalProgress[], today: string): string {
  const dates = `${shortDate(goals.startDate)} – ${shortDate(goals.endDate)}`;
  const days = progress[0]?.daysLeftLabel ?? daysLeftText(goalWindow(goals.startDate, goals.endDate, today).daysLeft);
  return `${dates} · ${days}`;
}

function shortDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))));
}

function daysLeftText(daysLeft: number): string {
  if (daysLeft === 1) return "1 day left";
  if (daysLeft > 1) return `${daysLeft} days left`;
  return "last day";
}

function compactAmount(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? "−" : "";
  const abs = Math.abs(rounded);
  if (abs >= 1_000_000) return `${sign}${trimNumber(abs / 1_000_000)}M`;
  if (abs >= 10_000) return `${sign}${trimNumber(abs / 1_000)}K`;
  return `${sign}${new Intl.NumberFormat("en-US").format(abs)}`;
}

function trimNumber(value: number): string {
  return value >= 10 || Number.isInteger(value) ? String(Math.round(value)) : value.toFixed(1).replace(/\.0$/, "");
}

function statusName(status: GoalStatus): string {
  if (status === "over") return "Over limit";
  if (status === "behind") return "Behind";
  return "On track";
}

function statusPill(status: GoalStatus): string {
  if (status === "over") return "bg-destructive/10 text-destructive";
  if (status === "behind") return "bg-warning-bg text-warning";
  return "bg-primary/10 text-primary";
}

function statusBar(status: GoalStatus): string {
  if (status === "over") return "bg-destructive";
  if (status === "behind") return "bg-warning";
  return "bg-primary";
}

function readSaved() {
  return sessionStorage.getItem(GOALS_SAVED_FLAG) === "1";
}

function subscribeSaved(onChange: () => void) {
  const timer = window.setTimeout(() => {
    sessionStorage.removeItem(GOALS_SAVED_FLAG);
    onChange();
  }, 4000);
  return () => window.clearTimeout(timer);
}

function toTipsRequest(goals: GoalSettings, progress: GoalProgress[]): GoalTipsRequest {
  const find = (kind: GoalProgress["kind"]) => progress.find((item) => item.kind === kind) ?? null;
  const sales = find("sales");
  const spend = find("spend");
  const debt = find("debt");
  const suppliers = find("suppliers");
  return {
    periodStart: goals.startDate,
    periodEnd: goals.endDate,
    daysLeft: progress[0]?.daysLeft ?? 0,
    sales: sales ? { progress: sales.progress, target: sales.target } : null,
    spend: spend ? { progress: spend.progress, target: spend.target } : null,
    debt: debt
      ? {
          outstanding: debt.progress,
          target: debt.target,
          collectedThisPeriod: debt.collectedThisPeriod ?? 0,
        }
      : null,
    suppliers: suppliers ? { progress: suppliers.progress, target: suppliers.target } : null,
  };
}
