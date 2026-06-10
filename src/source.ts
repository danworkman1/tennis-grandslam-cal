import { pad, SLAM_KEYS, SLAM_META, type SlamEvent } from "./seed.js";

const API = "https://en.wikipedia.org/w/api.php";
// Wikimedia asks API clients to identify themselves with a contact (repo URL or email).
const USER_AGENT = "tennis-slams-ics/1.0 (+https://github.com/danworkman1/tennis-grandslam-cal)";

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9,
  oct: 10, nov: 11, dec: 12,
};

const isoUTC = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * Strip wiki/HTML markup from an infobox field value so only the human text of
 * the date remains: footnotes ({{efn|...}}), refs, any template, wikilinks,
 * tags, and entities. {{snd}}/{{ndash}} become a dash so the range still splits.
 */
export function cleanInfoboxValue(raw: string): string {
  return raw
    .replace(/<ref[^>]*\/>/gi, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "")
    .replace(/\{\{\s*(?:snd|ndash|spaced ndash|--)\s*\}\}/gi, " – ")
    .replace(/\{\{[^{}]*\}\}/g, "") // drop remaining simple templates ({{efn|…}}, {{nowrap|…}} inner already gone)
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, "$1") // [[a|b]] -> b
    .replace(/\[\[([^\]]*)\]\]/g, "$1") // [[a]] -> a
    .replace(/<[^>]+>/g, " ") // any HTML tag -> space
    .replace(/&nbsp;/gi, " ")
    .replace(/&ndash;/gi, "–")
    .replace(/&mdash;/gi, "—")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSide(side: string): { day: number | null; month: number | null } {
  let day: number | null = null;
  let month: number | null = null;
  for (const tok of side.toLowerCase().split(/[\s.,]+/).filter(Boolean)) {
    if (/^\d{1,2}$/.test(tok)) {
      if (day === null) day = parseInt(tok, 10); // first 1-2 digit number is the day (4-digit year ignored)
    } else if (tok in MONTHS) {
      month = MONTHS[tok]!;
    }
  }
  return { day, month };
}

/**
 * Parse an infobox date range ("18 January – 1 February 2026", "August 24 –
 * September 7", "25 May – 8 June 2025") into a SlamEvent date pair, using the
 * supplied year (the date line may omit it). Returns null if it can't parse a
 * sane start+end. endExclusive is the day AFTER the final day.
 */
export function parseDateRange(
  raw: string,
  year: number,
): { start: string; endExclusive: string } | null {
  const cleaned = cleanInfoboxValue(raw);
  const parts = cleaned.split(/\s*[–—]\s*|\s+-\s+/); // en/em dash, or spaced hyphen
  if (parts.length < 2) return null;
  const startSide = parseSide(parts[0]!);
  const endSide = parseSide(parts[parts.length - 1]!);

  const startMonth = startSide.month ?? endSide.month;
  const endMonth = endSide.month ?? startSide.month;
  const startDay = startSide.day;
  const endDay = endSide.day;
  if (!startMonth || !endMonth || !startDay || !endDay) return null;

  const startY = year;
  const endY = endMonth < startMonth ? year + 1 : year; // ranges that cross New Year (no slam does, but be safe)

  const start = `${startY}-${pad(startMonth)}-${pad(startDay)}`;
  const lastDayMs = Date.UTC(endY, endMonth - 1, endDay);
  if (Number.isNaN(Date.parse(start)) || Number.isNaN(lastDayMs)) return null;
  const endExclusive = isoUTC(lastDayMs + 86_400_000);
  return { start, endExclusive };
}

type FetchFn = typeof fetch;

type WikiResult = { title: string; wikitext: string };

async function fetchArticle(article: string, fetchImpl: FetchFn): Promise<WikiResult | null> {
  const url =
    `${API}?action=parse&prop=wikitext&redirects=1&format=json&formatversion=2&` +
    `page=${encodeURIComponent(article)}`;
  const res = await fetchImpl(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Wikipedia HTTP ${res.status} for "${article}"`);
  const data = (await res.json()) as {
    parse?: { title: string; wikitext: string };
    error?: { info?: string };
  };
  if (!data.parse) return null; // article doesn't exist (not yet published)
  return { title: data.parse.title, wikitext: data.parse.wikitext };
}

function extractDateField(wikitext: string): string | null {
  // Matches "|date = ..." / "| date = ..." in {{Infobox tennis event}} and
  // {{TennisEventInfo}}; value runs to end of line.
  const m = wikitext.match(/^\s*\|\s*date\s*=\s*(.+?)\s*$/im);
  return m ? m[1]! : null;
}

/**
 * Fetch and parse the four slams for the given years from Wikipedia infoboxes.
 *
 * Per-article missing/redirect/parse misses are NOT errors — they just produce
 * no event (the caller backfills from last-known-good/seed). A hard transport
 * failure for *every* request throws, so a real source outage surfaces an alert.
 */
export async function fetchFromSource(
  years: number[],
  fetchImpl: FetchFn = fetch,
): Promise<SlamEvent[]> {
  const jobs: { key: (typeof SLAM_KEYS)[number]; year: number }[] = [];
  for (const year of years) for (const key of SLAM_KEYS) jobs.push({ key, year });

  let transportFailures = 0;
  const events: SlamEvent[] = [];

  const results = await Promise.all(
    jobs.map(async ({ key, year }) => {
      const article = `${year} ${SLAM_META[key].wikiArticle}`;
      try {
        const r = await fetchArticle(article, fetchImpl);
        return { key, year, r, err: null as unknown };
      } catch (err) {
        return { key, year, r: null, err };
      }
    }),
  );

  for (const { key, year, r, err } of results) {
    if (err) {
      transportFailures++;
      continue;
    }
    if (!r) continue; // article not yet published
    // Redirect to the parent series page (e.g. future "2026 US Open" -> "US Open (tennis)")
    // means the year-specific article doesn't exist yet.
    if (!r.title.startsWith(`${year} `)) continue;
    const field = extractDateField(r.wikitext);
    if (!field) continue;
    const dates = parseDateRange(field, year);
    if (!dates) continue;
    events.push({
      key,
      name: SLAM_META[key].name,
      location: SLAM_META[key].location,
      start: dates.start,
      endExclusive: dates.endExclusive,
    });
  }

  if (transportFailures === jobs.length) {
    throw new Error(`source unreachable: all ${jobs.length} Wikipedia requests failed`);
  }
  return events;
}
