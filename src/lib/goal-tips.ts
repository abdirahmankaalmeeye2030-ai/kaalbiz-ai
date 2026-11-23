import { z } from "zod";
import { parseModelJson } from "./schema";
import { formatUgx } from "./money";

const tipText = z.string().trim().min(1).max(240);

export const goalTipsSchema = z.object({
  tips: z.array(tipText).min(2).max(3),
});

const amountSchema = z.number().finite().nonnegative();

export const goalTipsRequestSchema = z.object({
  periodStart: z.string(),
  periodEnd: z.string(),
  daysLeft: z.number().int().nonnegative(),
  sales: z.object({ progress: amountSchema, target: amountSchema }).nullable(),
  spend: z.object({ progress: amountSchema, target: amountSchema }).nullable(),
  debt: z
    .object({
      outstanding: amountSchema,
      target: amountSchema,
      collectedThisPeriod: amountSchema,
    })
    .nullable(),
  suppliers: z.object({ progress: amountSchema, target: amountSchema }).nullable(),
});

export type GoalTipsRequest = z.infer<typeof goalTipsRequestSchema>;

export function parseGoalTips(raw: string): string[] {
  const parsed = goalTipsSchema.parse(parseModelJson(raw));
  return parsed.tips;
}

export function ruleBasedGoalTips(input: GoalTipsRequest): string[] {
  const tips: string[] = [];
  if (input.sales && input.sales.progress < input.sales.target) {
    const left = input.sales.target - input.sales.progress;
    tips.push(`You still need ${formatUgx(left)} in sales. Write each sale down the same day.`);
  }
  if (input.spend && input.spend.progress > input.spend.target) {
    tips.push("Spending is past your limit. Pause extra costs such as airtime and transport until this period ends.");
  } else if (input.spend) {
    tips.push("Keep daily costs small. Rent and airtime add up faster than they look.");
  }
  if (input.debt && input.debt.outstanding > input.debt.target) {
    tips.push("Ask the customers who still owe you before you give more goods on credit.");
  }
  if (input.suppliers && input.suppliers.progress < input.suppliers.target) {
    tips.push("Pay a supplier a little at a time so one big bill does not land at the end of the month.");
  }
  if (tips.length < 2) {
    tips.push("Check your goals once a week and change the numbers if the month is not going as you hoped.");
  }
  if (tips.length < 2) {
    tips.push("A short written record each evening keeps the goals honest.");
  }
  return tips.slice(0, 3);
}

export function goalTipsPrompt(input: GoalTipsRequest): string {
  return [
    "Give 2 or 3 short practical tips for a small shop in Kampala.",
    "The numbers below are already calculated. Do not change them or invent records.",
    "Use plain words. Say amounts as UGX. No business jargon.",
    "Return only JSON: {\"tips\":[\"tip one\",\"tip two\"]}",
    JSON.stringify(input),
  ].join("\n");
}
