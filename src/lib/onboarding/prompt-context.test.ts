import { describe, expect, it } from "vitest";
import { bothEndings, decisionFraming } from "./prompt-context";
import type { OnboardingAnswers } from "@/lib/actions/projects";

const BLANK: OnboardingAnswers = {
  companyName: null,
  awake: null,
  decision: null,
  owner: null,
  stakes: null,
  o1: null,
  o2: null,
  o3: null,
  good: null,
  bad: null,
  turns: null,
  given: null,
  open: null,
  actors: null,
};

describe("decisionFraming", () => {
  it("returns null for a null input", () => {
    expect(decisionFraming(null)).toBeNull();
  });

  it("returns null when decision/owner/stakes are all empty", () => {
    expect(decisionFraming(BLANK)).toBeNull();
  });

  it("returns the subset when at least one field is set", () => {
    const o = { ...BLANK, stakes: "Two years of capital." };
    expect(decisionFraming(o)).toEqual({ decision: null, owner: null, stakes: "Two years of capital." });
  });
});

describe("bothEndings", () => {
  it("returns null for a null input", () => {
    expect(bothEndings(null)).toBeNull();
  });

  it("returns null when good/bad/turns are all empty", () => {
    expect(bothEndings(BLANK)).toBeNull();
  });

  it("returns the subset when at least one field is set", () => {
    const o = { ...BLANK, good: "We are the default partner.", turns: "The 2028 review." };
    expect(bothEndings(o)).toEqual({ good: "We are the default partner.", bad: null, turns: "The 2028 review." });
  });
});
