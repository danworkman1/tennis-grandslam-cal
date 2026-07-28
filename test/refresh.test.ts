import { describe, it, expect } from "vitest";
import { mergeEvents } from "../src/refresh.js";
import { SEED, SLAM_KEYS, type SlamEvent, type SlamKey } from "../src/seed.js";
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

  it("lets the seed correct a stale last-known-good for a year it covers", () => {
    // This asserted the opposite until the live feed proved why it could not stay
    // that way: KV held a 2026 US Open starting 31 August against a true main-draw
    // start of Sunday 30 August, and because the year-specific article had been
    // redirected away that (key, year) could never produce a candidate again. The
    // wrong value was unreachable by any successful refresh.
    const known: SlamEvent[] = [
      { ...SEED.find((e) => e.key === "usopen")!, start: "2026-08-31", endExclusive: "2026-09-14" },
    ];
    const merged = mergeEvents([], known, [2026]);
    expect(merged.find((e) => e.key === "usopen")!.start).toBe("2026-08-30");
  });

  it("still prefers last-known-good where the seed has nothing to say", () => {
    // The other half of the rule, and the reason known-good exists at all: it
    // carries years beyond the seed's range.
    const ranges2028: Record<SlamKey, [string, string]> = {
      ao: ["2028-01-16", "2028-01-31"],
      rg: ["2028-05-21", "2028-06-05"],
      wimbledon: ["2028-06-26", "2028-07-10"],
      usopen: ["2028-08-27", "2028-09-11"],
    };
    const known: SlamEvent[] = SLAM_KEYS.map((key) => ({
      ...SEED.find((e) => e.key === key)!,
      start: ranges2028[key][0],
      endExclusive: ranges2028[key][1],
    }));
    const merged = mergeEvents([], known, [2028]);
    expect(merged).toHaveLength(4);
    expect(merged.find((e) => e.key === "usopen")!.start).toBe("2028-08-27");
  });

  it("still lets a fresh candidate outrank the seed", () => {
    // The seed gaining precedence over known-good must not make it outrank live
    // data — a genuine date change still has to win.
    const moved: SlamEvent = {
      ...SEED.find((e) => e.key === "usopen")!,
      start: "2026-08-24",
      endExclusive: "2026-09-07",
    };
    const merged = mergeEvents([moved], [], [2026]);
    expect(merged.find((e) => e.key === "usopen")!.start).toBe("2026-08-24");
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
