import { SEED, type SlamEvent, type SlamKey } from "./seed.js";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Presentation-only metadata. The feed itself takes name/location from SLAM_META. */
export const SLAM_DETAILS: Record<
  SlamKey,
  { shortName: string; code: string; city: string; surface: string; number: string }
> = {
  ao: {
    shortName: "Australian Open",
    code: "AO",
    city: "Melbourne",
    surface: "Hard court",
    number: "01",
  },
  rg: {
    shortName: "Roland-Garros",
    code: "RG",
    city: "Paris",
    surface: "Clay court",
    number: "02",
  },
  wimbledon: {
    shortName: "Wimbledon",
    code: "W",
    city: "London",
    surface: "Grass court",
    number: "03",
  },
  usopen: {
    shortName: "US Open",
    code: "US",
    city: "New York",
    surface: "Hard court",
    number: "04",
  },
};

/**
 * The final day of the event, inclusive. `SlamEvent.endExclusive` is the day AFTER
 * the last day (ICS DTEND is exclusive), so anything rendering a human-readable
 * range must step back one day or it overstates every tournament by exactly one.
 */
export function inclusiveEnd(endExclusive: string): string {
  const end = new Date(`${endExclusive}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() - 1);
  return end.toISOString().slice(0, 10);
}

function shortDate(iso: string): string {
  const month = MONTHS[Number(iso.slice(5, 7)) - 1] ?? "";
  return `${Number(iso.slice(8, 10))} ${month}`;
}

export function dateRange(event: SlamEvent): string {
  return `${shortDate(event.start)} — ${shortDate(inclusiveEnd(event.endExclusive))}`;
}

function isDisplayableEvent(value: unknown): value is SlamEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<SlamEvent>;
  return (
    typeof event.key === "string" &&
    Object.hasOwn(SLAM_DETAILS, event.key) &&
    typeof event.name === "string" &&
    typeof event.location === "string" &&
    typeof event.start === "string" &&
    typeof event.endExclusive === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(event.start) &&
    /^\d{4}-\d{2}-\d{2}$/.test(event.endExclusive) &&
    !Number.isNaN(Date.parse(`${event.start}T00:00:00Z`)) &&
    !Number.isNaN(Date.parse(`${event.endExclusive}T00:00:00Z`))
  );
}

/**
 * The season the homepage should show: the earliest one with an event still to
 * come, not merely the earliest one on file. Keying off the first year present
 * would keep a finished season up until the calendar rolled over on 1 January.
 * A season stays "upcoming" until its last event ends.
 *
 * If every event is in the past — a stale feed — the most recent season is still
 * better than an empty page, and the completeness check below backstops the rest.
 */
/** One complete season out of `events`, or null if there isn't one. */
function pickSeason(events: SlamEvent[], now: Date): SlamEvent[] | null {
  const usable = (events as unknown[]).filter(isDisplayableEvent);
  const sorted = [...usable].sort((a, b) => a.start.localeCompare(b.start));

  const today = now.toISOString().slice(0, 10);
  const stillToCome = sorted.filter((event) => event.endExclusive > today);
  const targetYear = (stillToCome[0] ?? sorted[sorted.length - 1])?.start.slice(0, 4);

  const season = sorted.filter((event) => event.start.startsWith(`${targetYear}-`)).slice(0, 4);
  const hasEverySlam = new Set(season.map((event) => event.key)).size === 4;
  return season.length === 4 && hasEverySlam ? season : null;
}

export function seasonEvents(events: SlamEvent[], now: Date = new Date()): SlamEvent[] {
  // The seed has to go through the same single-season selection as live data. It
  // covers more than one year now, and returning it whole stacked every bundled
  // season onto a board captioned "the four majors" — on the cold-start path the
  // seed exists to serve.
  return pickSeason(events, now) ?? pickSeason(SEED, now) ?? SEED.slice(0, 4);
}
