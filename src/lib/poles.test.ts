import { describe, expect, it } from "vitest";
import { arePolesWeak, isPoleOk } from "./poles";

describe("isPoleOk", () => {
  it("rejects empty poles", () => {
    expect(isPoleOk("US dependence on Chinese power electronics", "")).toBe(false);
    expect(isPoleOk("US dependence on Chinese power electronics", "   ")).toBe(false);
  });

  it("rejects the generic 'Doesn't happen' pole", () => {
    expect(isPoleOk("US dependence on Chinese power electronics", "Doesn't happen")).toBe(false);
    expect(isPoleOk("US dependence on Chinese power electronics", "doesn't happen")).toBe(false);
    expect(isPoleOk("US dependence on Chinese power electronics", "Does not happen")).toBe(false);
  });

  it("rejects generic Low/High poles", () => {
    expect(isPoleOk("Pace of enterprise AI adoption", "Low")).toBe(false);
    expect(isPoleOk("Pace of enterprise AI adoption", "High")).toBe(false);
  });

  it("rejects a pole that equals the force title", () => {
    const title = "US dependent on Chinese power-electronics components";
    expect(isPoleOk(title, title)).toBe(false);
    expect(isPoleOk(title, title.toUpperCase())).toBe(false);
  });

  it("accepts a real, specific pole", () => {
    expect(isPoleOk("Tariff trajectory", "Tariffs soften")).toBe(true);
    expect(isPoleOk("Tariff trajectory", "Tariffs bite harder")).toBe(true);
    expect(isPoleOk("US-China power electronics dependence", "US supply diversifies")).toBe(true);
    expect(isPoleOk("US-China power electronics dependence", "Dependence on China deepens")).toBe(true);
  });
});

describe("arePolesWeak", () => {
  it("is true for the 'Doesn't happen' / title pattern the 0038 migration backfilled", () => {
    const title = "US dependent on Chinese power-electronics components";
    expect(arePolesWeak(title, ["Doesn't happen", title])).toBe(true);
  });

  it("is true for identical poles", () => {
    expect(arePolesWeak("Tariff trajectory", ["Tariffs soften", "Tariffs soften"])).toBe(true);
    expect(arePolesWeak("Tariff trajectory", ["tariffs soften", "Tariffs Soften"])).toBe(true);
  });

  it("is false for two real, distinct poles", () => {
    expect(arePolesWeak("Tariff trajectory", ["Tariffs soften", "Tariffs bite harder"])).toBe(false);
    expect(
      arePolesWeak("US-China power electronics dependence", ["US supply diversifies", "Dependence on China deepens"])
    ).toBe(false);
  });
});
