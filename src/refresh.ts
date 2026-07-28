import { buildICS } from "./ics.js";
import { fetchFromSource } from "./source.js";
import { eventId, idOf, SEED, SLAM_KEYS, type SlamEvent } from "./seed.js";
import { isValidEvent, validate } from "./validate.js";

export type Env = {
  SLAMS: KVNamespace;
  ALERT_WEBHOOK?: string;
  REFRESH_TOKEN?: string;
  PUBLIC_ORIGIN?: string;
};

function indexById(events: SlamEvent[]): Map<string, SlamEvent> {
  const m = new Map<string, SlamEvent>();
  for (const e of events) m.set(idOf(e), e);
  return m;
}

/**
 * Per-event merge: for each (tournament, year) prefer the fresh Wikipedia
 * candidate, then the bundled seed, then last-known-good. A bad candidate is
 * never allowed to overwrite a good prior value. This is what makes a
 * not-yet-published article (e.g. next year's US Open) degrade gracefully
 * instead of failing the whole refresh.
 *
 * The seed outranks last-known-good, which is worth being explicit about because
 * the obvious order is the other way round. Last-known-good is whatever the
 * parser last read; the seed is hand-verified against each tournament's own
 * calendar. Once a year-specific article is redirected away — which is what
 * happens to every slam article eventually — that (key, year) never produces a
 * candidate again, so a wrong known-good becomes permanent and no amount of
 * successful refreshing can dislodge it. Exactly that happened to the 2026 US
 * Open, which sat in KV starting 31 August against a true main-draw start of
 * Sunday 30 August.
 *
 * The cost is narrow and deliberate: for a year the seed covers, a genuine date
 * change that Wikipedia published and has since stopped serving would revert to
 * the seed. That is the correct bias — the seed is the value a human checked.
 * Known-good still wins wherever the seed has nothing to say, which is its real
 * job: carrying years beyond the seed's range.
 */
export function mergeEvents(
  candidates: SlamEvent[],
  knownGood: SlamEvent[],
  years: number[],
): SlamEvent[] {
  const cand = indexById(candidates);
  const good = indexById(knownGood);
  const seed = indexById(SEED);

  const out: SlamEvent[] = [];
  for (const year of years) {
    for (const key of SLAM_KEYS) {
      const id = eventId(key, year);
      const pick = [cand.get(id), seed.get(id), good.get(id)].find((e) => e && isValidEvent(e));
      if (pick) out.push(pick);
    }
  }
  return out;
}

async function readKnownGood(env: Env): Promise<SlamEvent[]> {
  const raw = await env.SLAMS.get("feed:events");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as SlamEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function alert(env: Env, text: string): Promise<void> {
  if (!env.ALERT_WEBHOOK) return;
  try {
    await fetch(env.ALERT_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text }), // Discord/Slack/ntfy-compatible-ish
    });
  } catch {
    /* alerting must never throw */
  }
}

/**
 * Weekly cron entry point. Fetches from Wikipedia, merges with last-known-good +
 * seed, validates the current year hard, and only then overwrites KV. On any
 * failure it leaves the served feed untouched and records/announces the failure.
 */
export async function refresh(env: Env, now: Date = new Date()): Promise<void> {
  const thisYear = now.getUTCFullYear();
  const years = [thisYear, thisYear + 1];

  try {
    const candidates = await fetchFromSource(years);
    const knownGood = await readKnownGood(env);
    const merged = mergeEvents(candidates, knownGood, years);

    // Hard gate: the current year must be complete and sane before we publish.
    if (!validate(merged, [thisYear])) {
      throw new Error(`merged set failed validation for ${thisYear}`);
    }

    const ics = await buildICS(merged, env.SLAMS, now);
    await env.SLAMS.put("feed:events", JSON.stringify(merged));
    await env.SLAMS.put("feed:ics", ics);
    await env.SLAMS.put("meta:last_success", now.toISOString());

    const failed = parseInt((await env.SLAMS.get("meta:fail_count")) ?? "0", 10);
    await env.SLAMS.put("meta:fail_count", "0");
    if (failed > 0) await alert(env, `✅ Slam feed recovered after ${failed} failure(s).`);
  } catch (err) {
    const count = parseInt((await env.SLAMS.get("meta:fail_count")) ?? "0", 10) + 1;
    await env.SLAMS.put("meta:fail_count", String(count));
    await env.SLAMS.put(
      "meta:last_error",
      JSON.stringify({ ts: now.toISOString(), message: String(err) }),
    );
    await alert(
      env,
      `⚠️ Slam feed refresh failed (#${count}): ${String(err)}. Serving last-known-good.`,
    );
    // feed:ics / feed:events deliberately left untouched.
  }
}
