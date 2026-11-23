"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { postJson } from "@/lib/client";
import { formatDisplayDate } from "@/lib/dates";
import { formatUgx } from "@/lib/money";
import { evaluateGoals, type GoalProgress, type GoalSettings, type GoalStatus } from "@/lib/goals";
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
  const [tips, setTips] = useState<GoalTipsResponse | null>(null);
  const [tipsError, setTipsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Goals</h2>
          {goals ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {formatRange(goals.startDate, goals.endDate)}
            </p>
          ) : (
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Set a sales, spending, debt, or supplier goal for this month.
            </p>
          )}
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/goals">{goals && progress.length > 0 ? "Change" : "Set goals"}</Link>
        </Button>
      </div>

      {progress.length > 0 ? (
        <ul className="mt-4 space-y-4">
          {progress.map((item) => (
            <li key={item.kind}>
              <p className={cn("text-sm font-semibold leading-5", statusText(item.status))}>{item.line}</p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
                <div
                  className={cn("h-full rounded-full", statusBar(item.status))}
                  style={{ width: `${Math.min(100, Math.max(0, item.percent))}%` }}
                />
              </div>
              {item.collectedThisPeriod != null ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Collected this period: {formatUgx(item.collectedThisPeriod)}
                </p>
              ) : null}
              {item.hint ? <p className="mt-1 text-sm leading-5 text-muted-foreground">{item.hint}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {progress.length > 0 ? (
        <div className="mt-4 space-y-3">
          <Button type="button" className="w-full" onClick={() => void loadTips()} disabled={loading}>
            {loading ? "Getting tips…" : "Get tips"}
          </Button>
          {tipsError ? <p className="text-sm text-destructive">{tipsError}</p> : null}
          {tips ? (
            <div className="space-y-2">
              <Badge variant={tips.source === "ai" ? "default" : "warning"}>{tips.badge}</Badge>
              {tips.message ? <p className="text-sm text-muted-foreground">{tips.message}</p> : null}
              <ul className="list-disc space-y-2 pl-5 text-sm leading-6">
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

function formatRange(start: string, end: string): string {
  return `${formatDisplayDate(start)} to ${formatDisplayDate(end)}`;
}

function statusText(status: GoalStatus): string {
  if (status === "over") return "text-destructive";
  if (status === "behind") return "text-warning";
  return "text-foreground";
}

function statusBar(status: GoalStatus): string {
  if (status === "over") return "bg-destructive";
  if (status === "behind") return "bg-warning";
  return "bg-primary";
}
