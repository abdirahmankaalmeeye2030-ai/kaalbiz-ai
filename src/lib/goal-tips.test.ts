import { describe, expect, it } from "vitest";
import { goalTipsSchema, parseGoalTips, ruleBasedGoalTips, type GoalTipsRequest } from "./goal-tips";

const request: GoalTipsRequest = {
  periodStart: "2026-11-01",
  periodEnd: "2026-11-30",
  daysLeft: 14,
  sales: { progress: 1_200_000, target: 3_000_000 },
  spend: { progress: 700_000, target: 600_000 },
  debt: { outstanding: 40_000, target: 20_000, collectedThisPeriod: 30_000 },
  suppliers: { progress: 150_000, target: 400_000 },
};

describe("goal tip schema", () => {
  it("accepts two or three short tips", () => {
    expect(goalTipsSchema.parse({ tips: ["Ask Grace today.", "Write sales tonight."] }).tips).toHaveLength(2);
    expect(parseGoalTips('```json\n{"tips":["One clear step.","Another clear step.","A third step."]}\n```')).toEqual([
      "One clear step.",
      "Another clear step.",
      "A third step.",
    ]);
  });

  it("rejects one tip, four tips, and blank tips", () => {
    expect(() => goalTipsSchema.parse({ tips: ["Only one."] })).toThrow();
    expect(() => goalTipsSchema.parse({ tips: ["A", "B", "C", "D"] })).toThrow();
    expect(() => parseGoalTips('{"tips":["ok","  "]}}')).toThrow();
  });

  it("builds labelled rule-based tips from the calculated numbers", () => {
    const tips = ruleBasedGoalTips(request);
    expect(tips.length).toBeGreaterThanOrEqual(2);
    expect(tips.length).toBeLessThanOrEqual(3);
    expect(tips.join(" ")).toContain("UGX 1,800,000");
    expect(tips.join(" ")).toContain("past your limit");
  });
});
