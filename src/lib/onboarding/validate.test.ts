import { describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/ai/errors";
import { validateOnboardingAnswerPatch } from "./validate";

describe("validateOnboardingAnswerPatch", () => {
  it("rejects an unknown key", () => {
    expect(() => validateOnboardingAnswerPatch({ notARealQuestion: "hi" })).toThrow(ValidationError);
  });

  it("rejects a value over 4,000 characters", () => {
    expect(() => validateOnboardingAnswerPatch({ awake: "x".repeat(4001) })).toThrow(ValidationError);
  });

  it("accepts a value at exactly the 4,000 character limit", () => {
    const { clean } = validateOnboardingAnswerPatch({ awake: "x".repeat(4000) });
    expect(clean.awake).toHaveLength(4000);
  });

  it("trims values", () => {
    const { clean } = validateOnboardingAnswerPatch({ decision: "  enter APAC  " });
    expect(clean.decision).toBe("enter APAC");
  });

  it("maps an empty (or whitespace-only) string to null, clearing the answer", () => {
    const { clean } = validateOnboardingAnswerPatch({ owner: "", stakes: "   " });
    expect(clean.owner).toBeNull();
    expect(clean.stakes).toBeNull();
  });

  it("accepts every real question id", () => {
    const patch = Object.fromEntries(
      ["awake", "decision", "owner", "stakes", "o1", "o2", "o3", "good", "bad", "turns", "given", "open", "actors"].map((id) => [id, "answer"])
    );
    const { clean } = validateOnboardingAnswerPatch(patch);
    expect(Object.keys(clean)).toHaveLength(13);
  });
});
