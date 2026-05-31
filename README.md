# Tennis Grand Slam ICS feed

A "set and forget" Cloudflare Worker that publishes a subscribable iCalendar feed of
the four tennis Grand Slams (Australian Open, Roland-Garros, Wimbledon, US Open).

**Subscribe:** `webcal://tennis-slams-ics.danielworkman.workers.dev/slams.ics`
**Status:** https://tennis-slams-ics.danielworkman.workers.dev/health

## How it works

Two decoupled paths:

- **Serve** (`fetch`): every subscriber poll is a cheap KV read of a pre-rendered ICS
  string. If KV is empty (cold start) it renders the bundled `SEED` (confirmed 2026
  dates), so the feed is never empty.
- **Refresh** (`scheduled`, weekly cron `0 6 * * 1`): fetch → parse → validate →
  fall back → alert. Output is cached in KV; parsing never happens on the serve path.

### Data source

The dates come from the **English Wikipedia infobox** `|date =` field via the MediaWiki
`action=parse` API (`src/source.ts`), one article per tournament/year
(e.g. `2026 Australian Open`).

> Wikidata was the original plan but turned out to be a dead end: the tournament *edition*
> items carry only P585 (the year) — no P580/P582 start/end dates, even for completed
> editions. The Wikipedia infobox is heavily watched, structured, and publishes dates well
> in advance.

Notes baked into the parser:
- The **US Open** article is `<year> US Open (tennis)`, uses the `{{TennisEventInfo}}`
  template, and its date line omits the year and carries an `{{efn|…}}` footnote
  (`August 24{{efn|…}} – September 7`). The year is supplied from the requested article.
- Future-year articles that don't exist yet redirect to the parent series page; these are
  detected (resolved title doesn't start with the year) and treated as "not yet published".

### Robustness harness

- **Validate** (`src/validate.ts`): each event must have a valid date range, a duration of
  11–17 days, and a start month in the expected window per tournament. The strongest guard
  against parsing the wrong field.
- **Per-event merge** (`src/refresh.ts`): for each tournament/year, prefer the fresh
  Wikipedia value, else last-known-good (KV), else the bundled seed. A bad/missing
  candidate never overwrites good data, and a not-yet-published article degrades gracefully
  instead of failing the whole refresh.
- **Alert** (optional): set the `ALERT_WEBHOOK` secret (Discord/Slack/ntfy) to get a ping
  on failure and recovery. Without it, monitor `/health` (`serving_stale`).

## Endpoints

| Route | Description |
|-------|-------------|
| `GET /slams.ics` | The feed. `text/calendar`, `max-age=3600`. |
| `GET /health` | `last_success`, `fail_count`, `last_error`, `serving_stale`. |
| `GET /` | Landing page with the subscribe link. |
| `GET /admin/refresh?key=<TOKEN>` | Manually run the refresh (same path as cron). Guarded by the `REFRESH_TOKEN` secret. |

## Development

```bash
pnpm install
pnpm test            # vitest unit tests (ics, validate, source parsing, merge)
pnpm typecheck
pnpm dev             # wrangler dev (local). Trigger cron:
                     #   curl "http://localhost:8787/__scheduled?cron=0+6+*+*+1"
pnpm deploy
```

### Secrets

```bash
npx wrangler secret put REFRESH_TOKEN   # required for /admin/refresh
npx wrangler secret put ALERT_WEBHOOK   # optional alerting
```

## Layout

```
src/
  index.ts    # Hono router + scheduled handler (thin)
  refresh.ts  # mergeEvents + refresh (cron logic) + alert
  source.ts   # Wikipedia fetch + date-range parser
  ics.ts      # buildICS, fold, esc, date helpers, SEQUENCE/hash
  validate.ts # isValidEvent + validate
  seed.ts     # SlamEvent type, SEED, SLAM_META
test/         # ics / validate / source / refresh unit tests
```
