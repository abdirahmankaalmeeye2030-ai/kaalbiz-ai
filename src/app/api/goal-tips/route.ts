import { guardAiRequest } from "@/lib/auth-guard";
import { goalTipsPrompt, goalTipsRequestSchema, parseGoalTips, ruleBasedGoalTips } from "@/lib/goal-tips";
import { AiNotConfiguredError, completeChat, isAiConfigured, safeErrorMessage, textModel } from "@/lib/ai/provider";
import { isIsoDate } from "@/lib/dates";

export const maxDuration = 60;

const DEMO_BADGE = "Demo mode: rule-based tips, not real AI";

export async function POST(request: Request) {
  const denied = await guardAiRequest();
  if (denied) return denied;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ message: "Send a JSON body." }, { status: 400 });
  }

  const parsed = goalTipsRequestSchema.safeParse(json);
  if (!parsed.success || !isIsoDate(parsed.data.periodStart) || !isIsoDate(parsed.data.periodEnd)) {
    return Response.json({ message: "Those goal numbers could not be read." }, { status: 400 });
  }
  if (![parsed.data.sales, parsed.data.spend, parsed.data.debt, parsed.data.suppliers].some(Boolean)) {
    return Response.json({ message: "Set at least one goal first." }, { status: 400 });
  }

  const fallback = ruleBasedGoalTips(parsed.data);
  if (!isAiConfigured()) {
    return Response.json({
      source: "template",
      badge: DEMO_BADGE,
      model: null,
      tips: fallback,
      message: "No AI key is set, so these tips were written from rules.",
    });
  }

  const model = textModel();
  try {
    const raw = await completeChat({
      model,
      messages: [
        {
          role: "system",
          content:
            "You help a small business owner in Kampala. Return only the JSON object requested. Do not invent numbers.",
        },
        { role: "user", content: goalTipsPrompt(parsed.data) },
      ],
      timeoutMs: 30_000,
    });
    const tips = parseGoalTips(raw);
    return Response.json({
      source: "ai",
      badge: `AI tips · ${model}`,
      model,
      tips,
    });
  } catch (error) {
    if (error instanceof AiNotConfiguredError) {
      return Response.json({
        source: "template",
        badge: DEMO_BADGE,
        model: null,
        tips: fallback,
        message: "No AI key is set, so these tips were written from rules.",
      });
    }
    return Response.json({
      source: "template",
      badge: DEMO_BADGE,
      model,
      tips: fallback,
      message: `The AI call failed, so these are rule-based tips. ${safeErrorMessage(error)}`,
    });
  }
}
