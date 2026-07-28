# Tennis Grand Slam ICS feed

A "set and forget" Cloudflare Worker that publishes a subscribable iCalendar feed of
the four tennis Grand Slams (Australian Open, Roland-Garros, Wimbledon, US Open).

**Subscribe:** `webcal://grandslamcalendar.com/slams.ics`
**Status:** https://grandslamcalendar.com/health

> The legacy `webcal://tennis-slams-ics.danielworkman.workers.dev/slams.ics` origin
> stays live for existing subscribers; new metadata and links use the branded host.

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
| `GET /blog` | Guide index. Posts live in `src/blog.ts`. |
| `GET /blog/:slug` | A guide. Unknown slugs fall through to the shared 404. |
| `GET /robots.txt` | Allows crawling, disallows `/admin/`, points at the sitemap. Replaces Cloudflare's default managed robots.txt. |
| `GET /sitemap.xml` | Single-URL sitemap for the homepage. URLs use `PUBLIC_ORIGIN`. |
| `GET /favicon.svg` | Site icon (inline SVG, no static assets needed). |
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

## Adding a custom domain

If this is intended to be a durable public utility, use a dedicated subdomain of
a domain already managed in Cloudflare (for example, `slams.example.com`). It
makes the feed easier to trust and remember, and gives you an address that can be
moved away from Cloudflare later. A custom domain is not an SEO shortcut, so it
is not worth buying one solely for search ranking.

It can be attached to this same Worker without migrating KV data or resubscribing
existing users. Keep the `workers.dev` origin enabled and add the new hostname as
a [Worker Custom Domain](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/):

```jsonc
{
  "workers_dev": true,
  "vars": { "PUBLIC_ORIGIN": "https://slams.example.com" },
  "routes": [
    { "pattern": "slams.example.com", "custom_domain": true }
  ]
}
```

`workers_dev` must remain explicitly `true`: existing calendar apps continue to
poll the URL they originally saved, and there is no subscriber registry that can
rewrite it. Keep the legacy `/slams.ics` route returning the feed directly rather
than relying on calendar clients to migrate through a redirect.

The legacy domain embedded in event `UID` values in `src/ics.ts` is also
deliberately permanent. It identifies events; it is not a link. Changing it when
branding the public URL could make clients add duplicate events.

`PUBLIC_ORIGIN` makes metadata and new subscription links use the branded host
even when somebody visits the legacy homepage. It does not redirect or disable
the legacy feed.

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
  layout.ts   # shared page shell: head, stylesheet, nav, footer, 404
  home.ts     # homepage content
  blog.ts     # post registry + blog index/post rendering
  slams.ts    # presentation metadata and date formatting
  html.ts     # escapeHtml
test/         # ics / validate / source / refresh / page-rendering unit tests
```

### Adding a post

Posts are plain TS objects in the `POSTS` array in `src/blog.ts` — no markdown
pipeline, no CMS, no build step. Add one and it is automatically routed at
`/blog/<slug>`, listed on `/blog`, and included in `sitemap.xml` with a `lastmod`
taken from its `updated ?? published` date.

`body` is a function receiving the resolved feed URLs, so a post can drop the
subscribe CTA (`renderSubscribeCta`) inline at the point the reader should act.
Multiple CTAs per page are supported; each is its own `[data-copy-scope]`.

At around five posts this should graduate to markdown pre-rendered at build time.
`BlogPost` is the seam — change how `body` is produced and nothing else moves.
