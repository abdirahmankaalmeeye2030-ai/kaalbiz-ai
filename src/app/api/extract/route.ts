import { z } from "zod";
import { extractText } from "@/lib/ai/extract";
import { isIsoDate } from "@/lib/dates";

const bodySchema = z.object({
  text: z.string().trim().min(1).max(4000),
  clientDate: z.string().refine(isIsoDate, "Use a real date."),
});

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ message: "Send a JSON body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { message: "Type what happened in the business, then try again." },
      { status: 400 },
    );
  }

  const result = await extractText(parsed.data.text, parsed.data.clientDate);
  return Response.json(result);
}
