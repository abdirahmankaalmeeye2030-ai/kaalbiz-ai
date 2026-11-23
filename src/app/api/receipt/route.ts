import { z } from "zod";
import { guardAiRequest } from "@/lib/auth-guard";
import { extractReceipt } from "@/lib/ai/extract";
import { isIsoDate } from "@/lib/dates";

const bodySchema = z.object({
  imageBase64: z
    .string()
    .min(32)
    .max(2_000_000)
    .refine((value) => /^[A-Za-z0-9+/=\s]+$/.test(value), "Image data was not valid."),
  mimeType: z.enum(["image/jpeg", "image/jpg", "image/png", "image/webp"]),
  clientDate: z.string().refine(isIsoDate, "Use a real date."),
});

export async function POST(request: Request) {
  const denied = await guardAiRequest();
  if (denied) return denied;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ message: "Send a JSON body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { message: "That photo could not be sent. Try a smaller JPEG or PNG." },
      { status: 400 },
    );
  }

  const mimeType = parsed.data.mimeType === "image/jpg" ? "image/jpeg" : parsed.data.mimeType;
  const result = await extractReceipt(
    parsed.data.imageBase64.replace(/\s/g, ""),
    mimeType,
    parsed.data.clientDate,
  );
  return Response.json(result);
}
