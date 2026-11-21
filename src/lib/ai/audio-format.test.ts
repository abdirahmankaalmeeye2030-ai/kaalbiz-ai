import { describe, expect, it } from "vitest";
import { audioFormatForMime } from "./audio-format";

describe("audioFormatForMime", () => {
  it("maps browser recorder types onto OpenRouter audio formats", () => {
    expect(audioFormatForMime("audio/webm;codecs=opus")).toBe("webm");
    expect(audioFormatForMime("audio/webm")).toBe("webm");
    expect(audioFormatForMime("audio/mp4")).toBe("mp4");
    expect(audioFormatForMime("audio/mp4;codecs=mp4a.40.2")).toBe("mp4");
    expect(audioFormatForMime("audio/m4a")).toBe("mp4");
    expect(audioFormatForMime("audio/ogg")).toBe("ogg");
    expect(audioFormatForMime("audio/ogg;codecs=opus")).toBe("ogg");
    expect(audioFormatForMime("audio/wav")).toBe("wav");
    expect(audioFormatForMime("audio/x-wav")).toBe("wav");
    expect(audioFormatForMime("audio/mpeg")).toBe("mp3");
    expect(audioFormatForMime("audio/mp3")).toBe("mp3");
  });

  it("rejects types the transcriber does not accept", () => {
    expect(audioFormatForMime("video/webm")).toBeNull();
    expect(audioFormatForMime("audio/flac")).toBeNull();
    expect(audioFormatForMime("")).toBeNull();
  });
});
