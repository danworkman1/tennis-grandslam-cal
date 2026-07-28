import { describe, it, expect } from "vitest";
import { mergeEvents } from "../src/refresh.js";
import { SEED, type SlamEvent } from "../src/seed.js";
import { validate } from "../src/validate.js";

const wikiAO: SlamEvent = {
  key: "ao",
  name: "Australian Open",
  location: "Melbourne Park, Melbourne, Australia",
  start: "2026-01-19", // a (hypothetical) fresh value differing from seed
  endExclusive: "2026-02-03",
};

describe("mergeEvents", () => {
  it("prefers a valid Wikipedia candidate over seed", () => {
    const merged = mergeEvents([wikiAO], [], [2026]);
    expect(merged.find((e) => e.key === "ao")).toEqual(wikiAO);
  });

  it("backfills missing events from the bundled seed", () => {
    // Only AO came from Wikipedia; rg/wimbledon/usopen fall back to seed.
    const merged = mergeEvents([wikiAO], [], [2026]);
    expect(merged.map((e) => e.key).sort()).toEqual(["ao", "rg", "usopen", "wimbledon"]);
  });

  it("prefers last-known-good over seed when no candidate", () => {
    const known: SlamEvent[] = [
      { ...SEED.find((e) => e.key === "usopen")!, start: "2026-08-25", endExclusive: "2026-09-08" },
    ];
    const merged = mergeEvents([], known, [2026]);
    expect(merged.find((e) => e.key === "usopen")!.start).toBe("2026-08-25");
  });

  it("never lets an invalid candidate overwrite good data", () => {
    const garbage: SlamEvent = { ...wikiAO, start: "2026-03-01", endExclusive: "2026-03-15" }; // wrong month
    const merged = mergeEvents([garbage], [], [2026]);
    // falls through to seed value, not the garbage
    expect(merged.find((e) => e.key === "ao")!.start).toBe("2026-01-18");
  });

  it("omits a (key,year) with no candidate, known-good, or seed (e.g. 2028)", () => {
    // 2027 used to be the unseeded year here. Now that it is seeded, the case still
    // needs a year the seed does not cover — otherwise this stops testing anything.
    const merged = mergeEvents([], [], [2028]);
    expect(merged).toEqual([]);
  });
});

/**
 * The January 2027 regression. On the first cron of 2027 the refresh window moves
 * to [2027, 2028]. If Wikipedia has not published year-specific 2027 articles yet,
 * fetchFromSource discards the parent-page redirect by design and last-known-good
 * holds no 2027 either — so the seed is the only thing standing between the feed
 * and a hard-gate failure that silently keeps serving 2026 dates.
 */
describe("the seed covers the refresh window without any live source", () => {
  it("produces a complete, valid 2027 set on a cold start with empty KV", () => {
    const merged = mergeEvents([], [], [2027]);

    expect(merged.map((e) => e.key).sort()).toEqual(["ao", "rg", "usopen", "wimbledon"]);
    expect(validate(merged, [2027])).toBe(true);
  });

  it("passes the hard gate for both years of the first-cron-of-2027 window", () => {
    const merged = mergeEvents([], [], [2027, 2028]);

    // The gate only requires the CURRENT year to be complete; 2028 is allowed to be
    // missing. This is the assertion that would have failed before 2027 was seeded.
    expect(validate(merged, [2027])).toBe(true);
  });

  it("still holds 2026 alongside, so a 2026 cold start is unaffected", () => {
    expect(validate(mergeEvents([], [], [2026]), [2026])).toBe(true);
  });
});
