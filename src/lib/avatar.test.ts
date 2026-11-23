import { describe, expect, it } from "vitest";
import { avatarColor, avatarInitial, syncDot } from "./avatar";

describe("profile avatar", () => {
  it("uses the first letter and a stable color", () => {
    expect(avatarInitial("amina@shop.test")).toBe("A");
    expect(avatarInitial("  mina@shop.test")).toBe("M");
    expect(avatarInitial("")).toBe("?");
    expect(avatarColor("Amina@shop.test")).toBe(avatarColor("amina@shop.test"));
    expect(avatarColor("amina@shop.test")).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("maps backup state to a dot", () => {
    expect(syncDot("backed-up")).toBe("green");
    expect(syncDot("syncing")).toBe("amber");
    expect(syncDot("offline")).toBe("amber");
    expect(syncDot("failed")).toBe("red");
    expect(syncDot("off")).toBe("none");
  });
});