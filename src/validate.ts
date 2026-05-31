import { SLAM_KEYS, SLAM_META, type SlamEvent, type SlamKey } from "./seed.js";

/** Whole days between two ISO dates (endExclusive - start). */
export function daysBetween(startISO: string, endISO: string): number {
  return Math.round((Date.parse(endISO) - Date.parse(startISO)) / 86_400_000);
}

function yearOf(iso: string): number {
  return new Date(iso).getUTCFullYear();
}

function monthOf(iso: string): number {
  return new Date(iso).getUTCMonth() + 1;
}

/**
 * Validate a single event in isolation. This is the per-event safety net used
 * both by the set validator and by the per-event merge in refresh(): a sane
 * Wikipedia parse is accepted, garbage is rejected so we keep last-known-good.
 */
export function isValidEvent(e: SlamEvent): boolean {
  if (!SLAM_KEYS.includes(e.key)) return false;
  if (Number.isNaN(Date.parse(e.start)) || Number.isNaN(Date.parse(e.endExclusive))) return false;
  if (Date.parse(e.endExclusive) <= Date.parse(e.start)) return false;

  const dur = daysBetween(e.start, e.endExclusive);
  if (dur < 11 || dur > 17) return false; // a slam main draw is ~14 days

  const month = monthOf(e.start);
  if (!SLAM_META[e.key].expectedStartMonths.includes(month)) return false;

  return true;
}

/**
 * Validate a full candidate set for the given target years. Accepted only if,
 * for every year, all four tournaments are present and each event is itself
 * valid. Used to gate the final merged set before it is written to KV.
 */
export function validate(events: SlamEvent[], years: number[]): boolean {
  for (const y of years) {
    const yearEvents = events.filter((e) => yearOf(e.start) === y);
    const keys = new Set<SlamKey>(yearEvents.map((e) => e.key));
    if (!SLAM_KEYS.every((k) => keys.has(k))) return false;
    for (const e of yearEvents) {
      if (!isValidEvent(e)) return false;
    }
  }
  return true;
}
