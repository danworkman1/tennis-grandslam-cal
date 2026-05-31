import { describe, it, expect } from "vitest";
import { validate, isValidEvent } from "../src/validate.js";
import { SEED, type SlamEvent } from "../src/seed.js";

const GOOD: SlamEvent[] = SEED; // all four, 2026

describe("validate (set)", () => {
  it("accepts a complete, sane year", () => {
    expect(validate(GOOD, [2026])).toBe(true);
  });

  it("rejects a missing tournament", () => {
    expect(validate(GOOD.filter((e) => e.key !== "usopen"), [2026])).toBe(false);
  });

  it("rejects when a required future year is absent", () => {
    expect(validate(GOOD, [2026, 2027])).toBe(false); // no 2027 events present
  });
});

describe("isValidEvent (per-event failure modes)", () => {
  const ao = SEED.find((e) => e.key === "ao")!;

  it("accepts a good event", () => {
    expect(isValidEvent(ao)).toBe(true);
  });

  it("rejects end <= start", () => {
    expect(isValidEvent({ ...ao, endExclusive: ao.start })).toBe(false);
  });

  it("rejects a too-short duration (<11 days)", () => {
    expect(isValidEvent({ ...ao, start: "2026-01-18", endExclusive: "2026-01-25" })).toBe(false);
  });

  it("rejects a too-long duration (>17 days)", () => {
    expect(isValidEvent({ ...ao, start: "2026-01-01", endExclusive: "2026-01-25" })).toBe(false);
  });

  it("rejects the wrong start month for the tournament", () => {
    // AO in March instead of January
    expect(isValidEvent({ ...ao, start: "2026-03-18", endExclusive: "2026-04-02" })).toBe(false);
  });

  it("rejects an unparseable date", () => {
    expect(isValidEvent({ ...ao, start: "not-a-date" })).toBe(false);
  });

  it("accepts Wimbledon starting in either June or July", () => {
    const w = SEED.find((e) => e.key === "wimbledon")!;
    expect(isValidEvent({ ...w, start: "2026-07-01", endExclusive: "2026-07-15" })).toBe(true);
    expect(isValidEvent({ ...w, start: "2026-06-29", endExclusive: "2026-07-13" })).toBe(true);
  });
});
