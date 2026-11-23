import { describe, expect, it } from "vitest";
import { parseVoiceTranscript, transcriptionInstruction, TranscriptParseError } from "./voice-transcript";

describe("parseVoiceTranscript", () => {
  it("keeps an English transcript as both original and english", () => {
    expect(parseVoiceTranscript("en", "  Sold rice for 20000  ")).toEqual({
      language: "en",
      original: "Sold rice for 20000",
      english: "Sold rice for 20000",
    });
  });

  it("rejects a blank English transcript", () => {
    expect(() => parseVoiceTranscript("en", "   ")).toThrow(TranscriptParseError);
  });

  it("reads Luganda JSON and keeps amounts as digits in English", () => {
    const raw = JSON.stringify({
      original: "Natunda ssukaali emitwalo kkumi eri Mama Grace",
      english: "I sold sugar for 100000 to Mama Grace",
      note: "ignored",
    });
    expect(parseVoiceTranscript("lg", raw)).toEqual({
      language: "lg",
      original: "Natunda ssukaali emitwalo kkumi eri Mama Grace",
      english: "I sold sugar for 100000 to Mama Grace",
    });
  });

  it("reads a fenced Somali JSON object and trims both fields", () => {
    const raw = [
      "```json",
      JSON.stringify({
        original: "  Waxaan ku iibiyay bariis kun shilin Mama Amina  ",
        english: "  I sold rice for 1000 shillings to Mama Amina  ",
      }),
      "```",
    ].join("\n");
    expect(parseVoiceTranscript("so", raw)).toEqual({
      language: "so",
      original: "Waxaan ku iibiyay bariis kun shilin Mama Amina",
      english: "I sold rice for 1000 shillings to Mama Amina",
    });
  });

  it("turns a numeric english amount into text", () => {
    const raw = JSON.stringify({
      original: "emitwalo kkumi",
      english: 100000,
    });
    expect(parseVoiceTranscript("lg", raw).english).toBe("100000");
  });

  it("rejects bilingual JSON that is missing a field", () => {
    expect(() => parseVoiceTranscript("so", JSON.stringify({ original: "kun" }))).toThrow(TranscriptParseError);
    expect(() => parseVoiceTranscript("lg", JSON.stringify({ english: "100000" }))).toThrow(TranscriptParseError);
    expect(() => parseVoiceTranscript("lg", "not json")).toThrow(TranscriptParseError);
    expect(() => parseVoiceTranscript("so", JSON.stringify({ original: "  ", english: "1000" }))).toThrow(
      TranscriptParseError,
    );
  });
});

describe("transcriptionInstruction", () => {
  it("tells the Luganda and Somali prompts to write number words as digits", () => {
    expect(transcriptionInstruction("lg")).toContain("emitwalo kkumi");
    expect(transcriptionInstruction("lg")).toContain("100000");
    expect(transcriptionInstruction("lg")).toContain("UGX");
    expect(transcriptionInstruction("so")).toContain("kun");
    expect(transcriptionInstruction("so")).toContain("1000");
    expect(transcriptionInstruction("so")).toContain("UGX");
    expect(transcriptionInstruction("en")).not.toContain("JSON");
  });
});
