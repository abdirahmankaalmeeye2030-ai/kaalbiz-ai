import { connection } from "next/server";
import { isAiConfigured, textModel, visionModel } from "@/lib/ai/provider";

export async function GET() {
  await connection();
  const aiConfigured = isAiConfigured();
  return Response.json({
    aiConfigured,
    provider: "openrouter",
    model: textModel(),
    visionModel: visionModel(),
    mode: aiConfigured ? "ai" : "demo",
  });
}
