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

type DateRange = { start: string; endExclusive: string };

/**
 * Main-draw dates per year. The outer key is organisational only — an event's
 * year is always derived from `start` via `yearOf`, so these never disagree.
 *
 * The seed must always cover the refresh window, which is `[thisYear, thisYear+1]`
 * (`refresh.ts`). A seed that has expired is not a harmless stale constant: with no
 * year-specific Wikipedia article yet published, no last-known-good in KV and no
 * seed, `mergeEvents` returns nothing for the year, the hard gate throws, and the
 * feed silently keeps serving the previous season's dates. That is the one failure
 * mode a set-and-forget calendar cannot have, so this table needs a year added well
 * before each January.
 */
const SEED_DATES: Record<number, Record<SlamKey, DateRange>> = {
  // Confirmed.
  2026: {
    ao: { start: "2026-01-18", endExclusive: "2026-02-02" },
    rg: { start: "2026-05-24", endExclusive: "2026-06-08" },
    wimbledon: { start: "2026-06-29", endExclusive: "2026-07-13" },
    usopen: { start: "2026-08-30", endExclusive: "2026-09-14" },
  },
  // UNVERIFIED — must be checked against each tournament's own published calendar
  // before this is relied on. Only Wimbledon (28 Jun – 11 Jul 2027) has a reported
  // source; the other three follow 2026's weekday pattern and are inference, not
  // announcement. Beware that published ranges often quote qualifying or opening
  // week alongside the main draw: `start` is the first MAIN-DRAW day.
  2027: {
    ao: { start: "2027-01-17", endExclusive: "2027-02-01" },
    rg: { start: "2027-05-23", endExclusive: "2027-06-07" },
    wimbledon: { start: "2027-06-28", endExclusive: "2027-07-12" },
    usopen: { start: "2027-08-29", endExclusive: "2027-09-13" },
  },
};

/**
 * Bundled main-draw dates, so the feed is never empty on a cold start (empty KV)
 * and every event always has a last-resort fallback value. `endExclusive` is the
 * day after the final day — see ICS rules. Name/location come from SLAM_META so the
 * seed can never drift from the refresh-rendered events (buildICS hashes them for
 * SEQUENCE bumps).
 */
export const SEED: SlamEvent[] = Object.values(SEED_DATES).flatMap((byKey) =>
  SLAM_KEYS.map((key) => ({
    key,
    name: SLAM_META[key].name,
    location: SLAM_META[key].location,
    ...byKey[key],
  })),
);
