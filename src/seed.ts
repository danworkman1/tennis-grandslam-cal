export type SlamKey = "ao" | "rg" | "wimbledon" | "usopen";

export type SlamEvent = {
  key: SlamKey;
  name: string;
  location: string;
  start: string; // "YYYY-MM-DD", first main-draw day
  endExclusive: string; // "YYYY-MM-DD", day AFTER the final day (ICS DTEND is exclusive)
};

export const pad = (n: number) => String(n).padStart(2, "0");

export const yearOf = (e: SlamEvent) => new Date(e.start).getUTCFullYear();

/** The event-identity rule: one (tournament, year) = one calendar event. */
export const eventId = (key: SlamKey, year: number) => `${key}-${year}`;

export const idOf = (e: SlamEvent) => eventId(e.key, yearOf(e));

export const SLAM_KEYS: SlamKey[] = ["ao", "rg", "wimbledon", "usopen"];

/**
 * Canonical, stable metadata per slam. Only the *dates* are read from the live
 * source; name/location are fixed here so the feed never inherits Wikipedia's
 * messy infobox location markup, and `expectedStartMonths` is the strongest
 * guard against parsing the wrong field entirely.
 *
 * `wikiArticle` is the English Wikipedia article title, prefixed with the year
 * at fetch time (e.g. "2026 Australian Open"). The US Open needs the "(tennis)"
 * disambiguator.
 */
export const SLAM_META: Record<
  SlamKey,
  { name: string; location: string; wikiArticle: string; expectedStartMonths: number[] }
> = {
  ao: {
    name: "Australian Open",
    location: "Melbourne Park, Melbourne, Australia",
    wikiArticle: "Australian Open",
    expectedStartMonths: [1],
  },
  rg: {
    name: "French Open (Roland-Garros)",
    location: "Stade Roland-Garros, Paris, France",
    wikiArticle: "French Open",
    expectedStartMonths: [5],
  },
  wimbledon: {
    name: "Wimbledon",
    location: "All England Lawn Tennis and Croquet Club, London, UK",
    wikiArticle: "Wimbledon Championships",
    expectedStartMonths: [6, 7],
  },
  usopen: {
    name: "US Open",
    location: "Billie Jean King National Tennis Center, New York, USA",
    wikiArticle: "US Open (tennis)",
    expectedStartMonths: [8],
  },
};

const SEED_DATES: Record<SlamKey, { start: string; endExclusive: string }> = {
  ao: { start: "2026-01-18", endExclusive: "2026-02-02" },
  rg: { start: "2026-05-24", endExclusive: "2026-06-08" },
  wimbledon: { start: "2026-06-29", endExclusive: "2026-07-13" },
  usopen: { start: "2026-08-30", endExclusive: "2026-09-14" },
};

/**
 * Confirmed 2026 main-draw dates. Bundled so the feed is never empty on a cold
 * start (empty KV) and so every event always has a last-resort fallback value.
 * `endExclusive` is the day after the final day — see ICS rules. Name/location
 * come from SLAM_META so the seed can never drift from the refresh-rendered
 * events (buildICS hashes them for SEQUENCE bumps).
 */
export const SEED: SlamEvent[] = SLAM_KEYS.map((key) => ({
  key,
  name: SLAM_META[key].name,
  location: SLAM_META[key].location,
  ...SEED_DATES[key],
}));
