import { describe, it, expect } from "vitest";
import { mergeEvents } from "../src/refresh.js";
import { SEED, type SlamEvent } from "../src/seed.js";

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

  it("omits a (key,year) with no candidate, known-good, or seed (e.g. 2027)", () => {
    const merged = mergeEvents([], [], [2027]);
    expect(merged).toEqual([]);
  });
});
