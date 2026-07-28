# Spike 007 — Blog posts for SEO organic acquisition

Investigates [#7](https://github.com/danworkman1/tennis-grandslam-cal/issues/7). Timeboxed
investigation, July 2026. No production code changed by this spike.

Everything below was either measured by running it against this repo or is labelled with the
confidence it actually has. The prototypes lived in a scratch copy; `git status` stayed clean
throughout.

---

## TL;DR

**Do not build a blog yet, and do not build one page per tournament per year.** The issue's
premise for generated pages — "they self-update via the weekly cron, so they can never go
stale" — is false as stated. The refresh loop covers exactly two years and overwrites the
stored event set wholesale, so year-scoped pages do not go stale, they go **dateless**.

The recommended sequence is: **fix a dated correctness problem, get measurement in place,
make the homepage answer the query it already deserves to win, then write exactly one page
and let Search Console decide whether there is a second.**

Answers to the three decisions #7 asked for:

| Decision | Answer |
|---|---|
| **Blog vs generated pages** | Neither, yet. Homepage first, then one hand-written page. Year-scoped generated pages are ruled out on data grounds; perennial per-tournament hubs are ruled out on thin-content grounds. |
| **Content storage** | Plain TS modules exporting `{slug, title, description, published, body}`, with a documented promotion path to pre-rendered markdown at around post five. Both were built and proven; TS modules win at the volume this project will realistically reach. |
| **Routing** | Same-origin `/blog` + `/blog/:slug` in Hono, one app-level `app.notFound()`, explicit `/blog/` → `/blog` redirect. **No static-assets binding** — it silently shadows `/slams.ics`, reproduced below. |

And one finding that is not about SEO at all but outranks everything in this issue: see
[§1.2](#12-the-january-2027-problem).

---

## 1. The finding that changes the question

### 1.1 The pipeline holds two years, and forgets the rest

`refresh()` computes its window as `[thisYear, thisYear + 1]` (`src/refresh.ts:76-77`), and
`mergeEvents` only emits ids for the years it is passed (`src/refresh.ts:36-42`). The result is
written over `feed:events` wholesale (`src/refresh.ts:90`). There is no archive key — the only
things KV ever holds are `feed:ics`, `feed:events`, `meta:*` and the per-event `hash:`/`seq:`
pairs used for `SEQUENCE` bumps (`src/ics.ts:92-93`).

So the maximum page surface backed by live data is **4 slams × 2 years = 8 URLs**, and each
year-scoped URL loses its data source on 1 January. Verified by running the real function:

```
mergeEvents([], SEED /* 2026 events */, [2027, 2028])  ->  0 events
```

A `/wimbledon-2026` page published today would render nothing at all in January 2027. An
indexed URL that later renders an empty page is worse for a domain than never publishing it.

### 1.2 The January 2027 problem

Tracing the data model surfaced a dated correctness problem that has nothing to do with SEO
and is more urgent than any of it.

`SEED_DATES` (`src/seed.ts:62-67`) contains 2026 dates only. On the first Monday-06:00 cron of
January 2027 the window becomes `[2027, 2028]`. If English Wikipedia still has no year-specific
2027 articles, `fetchFromSource` discards the parent-page redirect by design
(`src/source.ts:144`), last-known-good has no 2027 for the same reason, and the seed has
expired. `mergeEvents` returns nothing, the hard gate at `src/refresh.ts:85-87` throws, and the
feed **silently keeps serving stale 2026 dates** — the one failure mode a set-and-forget
calendar cannot have.

Reproduced against the real `mergeEvents` and `validate`:

| Scenario | Window | Merged | Gate | Outcome |
|---|---|---|---|---|
| Today, KV holds 2026 | `[2026, 2027]` | 4 | pass | publishes |
| First cron of 2027, KV holds 2026 only | `[2027, 2028]` | **0** | **fail** | **throws — serves stale** |
| First cron of 2027, KV also holds 2027 | `[2027, 2028]` | 4 | pass | publishes |
| Cold start in 2027, empty KV | `[2027, 2028]` | **0** | **fail** | **throws — serves stale** |

This is conditional, not certain: it is averted if Wikipedia publishes the four 2027 articles
before January and the parse succeeds. But the *last-resort fallback has expired*, so the feed's
guarantee now rests entirely on an external site publishing on time. That is precisely the
dependency the three-tier fallback exists to remove.

The fix is small and is worth doing regardless of what happens to this issue: add 2027 main-draw
dates to `SEED_DATES`, plus a test that a cold start in 2027 validates. All four tournaments have
announced 2027 calendars (Wimbledon 2027 is reported as 28 June to 11 July, for example), so the
dates should be taken from each tournament's own published calendar rather than from this
document — and note the main-draw/qualifying distinction below.

One trap when sourcing them: published date ranges often quote qualifying or opening week
alongside the main draw, so the same tournament legitimately appears with two different start
dates. `SlamEvent.start` is defined as the **first main-draw day** (`src/seed.ts:7`). The repo
already defends this — `src/validate.ts:22-23` rejects anything outside an 11–17 day duration,
which was checked against all six candidate 2027 ranges and correctly rejected every
festival-wide one — but a seed value bypasses nothing and should be right at the source.

**Caveat worth stating plainly:** a search for `2027 Wimbledon Championships` on English
Wikipedia returns the parent `Wimbledon Championships` article and `2027 in sports`, not a
year article — the same redirect signature this repo's own fixtures encode
(`test/source.test.ts:73-79`). That strongly suggests the pipeline holds **4 events, not 8,
right now**. It could not be confirmed directly: `en.wikipedia.org` and `grandslamcalendar.com`
are both blocked by this environment's egress policy (`CONNECT tunnel failed, response 403`).
One read of `/health` or `feed:events` settles it in seconds from a normal machine, and it
should be the first thing done — see [§7](#7-what-could-not-be-verified-here).

### 1.3 What this does to the issue's premise

> "These pages should be generated from our own event data … they then self-update via the
> weekly cron, which is the same set-and-forget promise the product makes, and they can never
> go stale."

The intuition is good and the data genuinely is trustworthy — validated per event against
`expectedStartMonths` and an 11–17 day duration (`src/validate.ts:17-29`), with a three-tier
fallback. But the loop these pages were supposed to ride covers two years and keeps no history.
Riding it is not an option that exists today.

---

## 2. Blog vs generated pages — the recommendation

### 2.1 Year-scoped generated pages (`/wimbledon-2027`): no

Killed by [§1.1](#11-the-pipeline-holds-two-years-and-forgets-the-rest). Past-year pages go
dateless, next-year pages are dateless until Wikipedia publishes, and each page's unique content
is exactly **two ISO date strings** — `start` and `endExclusive`. Every other fact is static in
`SLAM_META` (`src/seed.ts:32-60`) and `SLAM_DETAILS` (`src/home.ts:24-56`), and already appears
on the homepage.

Making them work is not a page-template job; it needs an archival store and a retention policy
that do not exist. Price that before choosing a URL scheme, not after.

### 2.2 Perennial per-tournament hubs (`/wimbledon`): no, but for a different reason

This variant was not in the issue and deserves naming, because it survives the argument above:
four stable URLs, each rendering whatever the current window holds for that slam. It rides the
loop cleanly and never breaks on 1 January.

It fails on thin content instead. Each hub would differ from its siblings only by static
metadata that is already on the homepage, which makes four near-identical pages whose function
is to funnel to a subscribe button. That is close enough to Google's doorway-abuse description
to be a real risk — though an honest one: the policy's gating test is whether a page is an
*intermediate* step less useful than the destination, and a dates-plus-subscribe page arguably
is the destination. Treat it as a live risk with genuine uncertainty, not a settled violation.

If per-tournament pages are ever revisited, this is the shape to revisit, not `/slam-year`.

### 2.3 A blog: not yet

The steelman is real. Hand-written how-to content converts better, needs no data, and does not
have to outrank Wikipedia or the official tournament sites.

Two things argue against starting now:

1. **It contradicts the product's own thesis.** "Set and forget" is both the promise to the user
   and the operating model of the codebase: a weekly cron, no build step, one runtime dependency.
   A blog reintroduces exactly the human-in-the-loop dependency the architecture was built to
   remove, and a stale blog signals neglect more loudly than no blog.
2. **There is no way to tell if it worked.** There is no Search Console verification and no
   analytics anywhere in `src/` (grepped for `google-site-verification`, `analytics`, `gtag`,
   `plausible`, `umami`, `beacon` — no matches). `observability: { enabled: true }` in
   `wrangler.jsonc` is Workers runtime logging, not search or page data. Content shipped today
   is unfalsifiable.

Note also that post copy is meant to be drafted with the
[`daniel-voice`](https://github.com/danworkman1/daniel-voice-skill) skill, whose register
cheat-sheet has a *Blog / article* row prescribing first-person developer-blog voice signing off
with "practical tip + Happy coding!". That is the wrong register for a reader searching "add
Wimbledon to Google Calendar". A landing-page register needs adding to the skill before any post
is drafted — a small task, but a real prerequisite nobody had noticed.

### 2.4 The third option: make the one page you have rank

The homepage is the only indexable URL, already holds whatever authority the domain has, and is
currently pitched at the brand rather than the query:

- `<title>` (`src/home.ts:195`), meta description (`:196`) and `<h1>` (`:736`) contain **no year
  and neither the word "dates" nor "schedule"**.
- `seasonEvents` (`src/home.ts:99-106`) keys off the **earliest** year present and slices to 4.
  Verified by execution: feed it 8 events spanning 2026+2027 and the rendered HTML contains no
  "2027" at all. There is a second-order bug hiding in this: once 2027 data does arrive, the
  homepage will keep showing the *finished* 2026 season until the window rolls over on 1 January.
  The correct behaviour is "render the upcoming season, and the next when known" — not
  "render year+1".
- Structured data is a single `WebApplication` node (`src/home.ts:179-188`) — the only `@type`
  anywhere in `src/`.

This is tens of lines of work against the URL most likely to convert, and item two is a plain
product improvement independent of SEO.

### 2.5 Ranked answer

0. **Settle the facts** — read `/health` and `feed:events`; confirm the site is deployed and
   indexed. Two minutes, and it gates everything below.
1. **Seed 2027 dates** (`src/seed.ts:62-67`). Defuses [§1.2](#12-the-january-2027-problem) *and*
   supplies the data step 3 needs. Ship regardless of this issue's outcome.
2. **Search Console + analytics decision.** Nothing downstream is measurable without it.
3. **Homepage: render the upcoming season**, and make title/description/H1 intent-led.
4. **Then, and only with impression data, write one page.** Measure for 90 days before writing
   a second.

**Do not** add `Event`/`SportsEvent` markup anywhere in the first pass (see
[§5.3](#53-event-structured-data-no)). **Do not** add `FAQPage` schema despite the FAQ section at
`src/home.ts:829-844` — FAQ rich results were retired on 7 May 2026.

---

## 3. Content storage

All four options in the issue were built or tested against a scratch copy of this repo.

| Option | Verdict |
|---|---|
| **(a) TS modules** `{slug, title, description, published, body}` | **Recommended.** Zero new deps, zero config, no generated artifacts, native to how `src/home.ts` already works. Authoring HTML-in-a-string is unpleasant, which is exactly why it self-limits at low post counts. |
| **(b) Markdown, pre-rendered at build time** | **The promotion path.** A 36-line `scripts/build-content.mjs` emitting a gitignored `src/content.generated.ts`, wired into the existing `pre*` hooks, got `pnpm typecheck` clean, 55/55 tests, and a 118.05 KiB dry-run. Adopt at around post five. Because the `Post` type is identical, promotion changes only the import site. |
| **(b′) Markdown via Wrangler `rules: [{type: "Text"}]`** | **Trap — do not use.** It builds, and `wrangler types` even auto-generates the `declare module "*.md"` shim. But it hands the Worker a raw markdown *string*, so a renderer still has to ship at runtime; and it **breaks vitest outright** (Vite tries to parse the `.md` as JavaScript), requiring a brand-new `vitest.config.ts` the repo does not have. |
| **(c) KV** | Rejected. Two sources of truth, no review, no diff. |
| **(d) Separate site / subdomain** | Rejected. Same-origin is right, but for operational reasons — see below. |

Why (a) over (b) today: a *missing* generated file hard-fails the build, but a *stale* one
silently ships wrong content. That is a strictly worse failure mode than the
`worker-configuration.d.ts` precedent it resembles, and it is not worth buying for two or three
posts.

**Size is a non-issue.** Current bundle is 116.42 KiB raw / 30.41 KiB gzip. Bundled posts scale
linearly at ~14.1 KiB raw / ~3.07 KiB gzip per ~1,400-word post, against a 3 MB-after-compression
free-plan limit — roughly **940 posts** of headroom. A 100-post bundle showed no startup penalty
in local `workerd` (sub-5 ms responses).

### 3.1 The static-assets binding is genuinely dangerous here

PR #3 avoided the `assets` binding citing "routing-precedence risk on a live site with real
calendar subscribers". **That concern is correct and was reproduced**: with a default `assets`
config, a file at `public/slams.ics` silently shadows the live feed route — the asset body is
served instead of the Worker's, with `Cache-Control` flipped from `max-age=3600` to `max-age=0`.

`run_worker_first: ["/*", "!/blog/*"]` was proposed as an escape hatch and **does not work as
written**: the negative rule does not match the bare path `/blog`, which is exactly what a human
types, what a nav link points at, and what a sitemap lists. Do not record it as safe.

None of this matters if the recommendation is followed, because Worker-rendered HTML needs no
assets binding at all. It matters if someone reaches for one later.

### 3.2 On "same-origin `/blog/*` is the better SEO answer"

Directionally right, **but the usual reason is folklore**. Google documents no ranking preference
for subdirectories over subdomains. The real arguments are operational: one deploy, one
codebase, one Search Console property, shared chrome, no second origin to keep alive. Keep the
conclusion, drop the justification.

---

## 4. Routing, rendering, and the shared-layout sizing

### 4.1 The extraction is much smaller than the issue assumes

> "Extract the shared chrome … out of `home.ts` — this is likely the biggest chunk of actual work"

It is not. The extraction was performed for real, twice, and measured:

| | Before | After |
|---|---|---|
| `src/home.ts` | 897 | **233** |
| `src/layout.ts` | — | 620 |
| `src/html.ts` | — | 40 |
| `src/slams.ts` | — | 61 |
| **Total** | 897 | 954 (**net +57**) |

**885 of 897 lines move verbatim; 69 are newly written. Zero of the existing tests broke and
zero needed changing** (the count is 55 across 7 files, not 50 — the issue's number is stale).
Most importantly the rendered homepage is **byte-identical: 35,446 bytes before and after**, so
it reviews as a pure move with no visual-regression risk.

A per-page `extraCss` variant was also built and is green, saving ~14 KB raw / ~2.7 KB gzip per
blog page — but it breaks byte-identity, leaves `home.ts` at 554 lines, and the CSS split turned
out to be per-line surgery rather than block moves (`.hero__actions` at `:389` sits directly
above `.button` at `:390` with no blank line; a first attempt duplicated a rule). Not worth it at
this traffic level. If CSS weight ever becomes real, split then — but note the byte-diff harness
**cannot** validate that split, because under the split variant the homepage still receives both
halves concatenated, so a misfiled rule stays invisible.

### 4.2 The work the extraction does not give you — now measured

This was the real gap in the sizing. The nav lives inside `<header class="hero">`
(`src/home.ts:722-731`) and `.hero` is homepage-only (`min-height: 760px`, full-bleed gradient).
Worse, bare `h1` is `clamp(4rem, 8vw, 7.5rem)` with `max-width: 10ch` (`src/home.ts:372-380`),
so an article title inherits a hero headline clipped to ten characters — visibly broken rather
than merely plain. There is no bare `h2` rule anywhere; every `h2` rule is ancestor-gated.

A rendered blog prototype came back with `.page-head`, `.page-head__inner` and `.prose` entirely
unstyled. Writing that missing chrome and re-rendering:

- **94 lines of new CSS** (3,822 bytes raw / 1,191 gzip) covering a `.page-head` container, a
  `.prose` typography block (paragraphs, headings, lists, links, blockquote, code, `pre`, `hr`,
  images), a post CTA block, a post-list block for the index, and one mobile breakpoint.
- After that, the rendered post has **zero unstyled classes** apart from `status--healthy`, which
  is a pre-existing dead class on the homepage today (`statusCopy` emits three class names and
  only `status--watching` has a rule).
- The footer comes free: `buymeacoffee.com/dworkman` and the `danielworkman.dev` backlink both
  appear on the blog page with no per-page work, once `renderFooter()` is shared.

**Total sizing for a working second page type: ~200 net lines** — 57 for the extraction, 94 for
the chrome, ~46 for the page module, plus routing. Small. The genuinely expensive parts of this
issue are the URL-scheme decision and writing the posts, neither of which is code.

### 4.3 Routing

- `app.get("/blog")` for the index and `app.get("/blog/:slug")` returning `c.notFound()` on a miss.
- **One** `app.notFound()` at the bottom of `src/index.ts` covers both unknown slugs and unknown
  paths — verified that `c.notFound()` delegates to the app-level handler, so no per-route 404 is
  needed.
- Today unknown paths return Hono's built-in `text/plain` "404 Not Found" (13 bytes, no
  `Cache-Control`). Functional, but a dead end for a site trying to acquire organic traffic.
- `/blog/` with a trailing slash matches neither route and 404s — add an explicit redirect.

### 4.4 Cache headers

Worth knowing before picking numbers: **Cloudflare does not cache HTML at the edge by default**
(it decides by file extension, not MIME type). So the existing `max-age=300`
(`src/index.ts:127`) governs *browser* caching only, the Worker still runs per request, and a
first-time organic visitor arrives with an empty cache regardless. Edge offload needs an explicit
Cache Rule, which is a dashboard change outside this repo.

Given that, this is low-stakes. Suggested: posts `public, max-age=3600`, blog index
`public, max-age=900`, 404 `public, max-age=300` (short enough that a URL which later becomes a
real post is not cached as missing). Leaving posts at the homepage's `max-age=300` and revisiting
if traffic appears is also entirely defensible.

---

## 5. Crawler surface

### 5.1 Sitemap

`buildSitemap()` hardcodes one `<url>` with the comment "A single-page site"
(`src/seo.ts:25-37`). Change the signature to
`buildSitemap(origin, entries: SitemapEntry[] = [{ path: "/" }])`. With `entries` optional, **all
five existing assertions in `test/seo.test.ts` still pass** — verified by running a prototype
against the unmodified test file — so it lands as a pure addition. Note `test/seo.test.ts:31`
pins exactly one `<url>`; that assertion is the intended tripwire and should be re-scoped
deliberately.

Delete `<changefreq>` while there: Google documents that it ignores it.

**Do not wire `lastmod` to `meta:last_success`.** It is written unconditionally on every
successful cron (`src/refresh.ts:92`) with no content comparison, so it would bump ~52 times a
year on a page that never changed, and Google only uses `lastmod` when it is consistently
accurate. A build-time constant is no better — it bumps on deploys that touch only
`src/refresh.ts` or `src/source.ts` and change no rendered byte. **Omit `lastmod` on the homepage;
use hand-edited literal dates on posts only.**

### 5.2 Per-page head

The non-CSS head is only 14 lines (`src/home.ts:193-206`) against 511 lines of stylesheet, so
extracting `renderHead({title, description, canonicalPath, ogType, jsonLd})` is small once the
layout extraction has landed. Reusing the homepage head verbatim on a post would emit the
homepage canonical and `@type: WebApplication` on every post — actively harmful, so this is not
optional.

Canonical must go through `resolvePublicOrigin` (`src/index.ts:25-39`) so the legacy origin's
copy points at the branded host.

Two real gaps: **no `og:image`/`twitter:image`** anywhere, and no `<img>` in `src/home.ts` at
all, so shares render as text-only cards. Fixing it needs either a raster asset (requiring the
assets binding proven dangerous in [§3.1](#31-the-static-assets-binding-is-genuinely-dangerous-here))
or a Worker-rendered image — its own piece of work, not a line item under "add head tags". The
absence of `<meta name="robots">` is **not** a gap; `index, follow` is the default.

Also worth noting: `test/home.test.ts` has 10 tests and **not one touches `canonical`, `og:`,
`ld+json` or `<title>`**. A per-page canonical regression would ship silently.

### 5.3 `Event` structured data: no

The issue flags this as the interesting one, and the reasoning is appealing — this project holds
authoritative, auto-refreshed dates. It still comes out no:

- Google's Event experience **supports only leaf pages focused on a single event** and explicitly
  recommends against schedule or multi-event pages. The homepage is a four-event schedule page
  and is ineligible by construction, so shipping it there would force exactly the per-tournament
  URL scheme [§2.1](#21-year-scoped-generated-pages-wimbledon-2027-no) rules out.
- Eligibility also requires events **bookable by the general public**. A page carrying no ticket,
  offer or booking path does not obviously clear that bar. The "third parties may publish Event
  markup" passage sometimes cited in support addresses *organisers* about ticketing platforms
  they post to, not unaffiliated aggregators.
- There is an **off-by-one trap** if it is ever revisited: `endExclusive` is the day *after* the
  final day (`src/seed.ts:8`) while schema.org `endDate` is inclusive. Naive markup overstates
  all four majors by exactly one day and would contradict the dates rendered on the same page.
  `inclusiveEnd` (`src/home.ts:67-71`) is unexported and belongs next to the `SlamEvent` type
  before any second consumer uses it.

### 5.4 Search Console

Not set up, as far as the repo can tell: no verification meta tag, no `google*.html` file, no
verification-shaped string anywhere. Create a **Domain property verified by DNS TXT in
Cloudflare** — it covers all subdomains, needs no code, and avoids a verification tag that the
legacy `workers.dev` host would also serve. Then submit the sitemap.

For on-site analytics, note the constraint from #6: Cloudflare Web Analytics requires the
`static.cloudflareinsights.com` beacon, which violates "no third-party scripts". The script-free
alternative is a Workers Analytics Engine binding written server-side.

### 5.5 The legacy origin

`workers_dev` stays `true` — `README.md:97-99` is explicit that existing calendar apps poll the
URL they saved and there is no subscriber registry that can rewrite it. Setting it false would
break real subscribers, so any recommendation to do so is withdrawn.

Since `resolvePublicOrigin` forces `PUBLIC_ORIGIN`, the legacy host serves byte-identical HTML
with a canonical pointing at the branded host. That is correct, but canonical is a hint. The
targeted fix nobody had proposed: **host-conditional `X-Robots-Tag: noindex` on HTML routes only**
when the request host does not match `PUBLIC_ORIGIN`'s host, leaving `/slams.ics`, `/health` and
the canonical untouched. Roughly five lines.

---

## 6. Launch shortlist — and why it is not decision-grade

This is the weakest deliverable in the spike and it should be read as **hypotheses to validate,
not a roadmap**. Two reasons, both structural:

1. **No search-volume data exists anywhere in this spike.** No number was invented, which is the
   right call, but it means the shortlist can only be ranked by observed SERP weakness × intent
   match.
2. **The SERP observations did not reproduce.** Every one came from a US-only search tool that is
   not Google, and four of four re-runs returned materially different result sets. The two
   strongest launch candidates both collapsed on re-check:
   - *"add wimbledon to google calendar"* was read as an open gap because a football club ranks
     #1. On re-run, **Sync2Cal holds positions 2–4** with tennis-Wimbledon-calendar pages. The
     lone football result is name ambiguity, not weak supply.
   - *"tennis calendar for iPhone"* was read as unowned. On re-run, **caltrics.com ranks #1 with
     a page literally titled "Tennis Grand Slams calendar"** — this project's exact scope — behind
     eight more dedicated tennis-calendar competitors.

What survives as genuinely useful:

- **The head term to own is "tennis calendar subscription"**, not any date query. Incumbents
  (Sync2Cal, Caltrics, CalendarLabs) all carry friction this product does not — OAuth sign-in,
  signup, freemium limits — and all push *match-level* events, the opposite of this feed's
  one-all-day-event-per-major design. That differentiator is conversion copy for the homepage,
  not a separate indexable page.
- **Date-intent queries are the weakest bet, not the strongest.** "When is Wimbledon 2027" is
  held by Wikipedia year-articles plus travel and ticket resellers, and it is precisely the query
  the data ceiling ([§1.1](#11-the-pipeline-holds-two-years-and-forgets-the-rest)) cannot serve.
- **"webcal vs ics" is pure vanity** — winnable, wrong audience. A reader searching it is a
  developer debugging something, not someone who wants tennis dates. Skip it.

So the honest launch set is **one page**, hand-written, aimed at subscribe intent, chosen from
Search Console impression data once the property exists — plus the homepage work in
[§2.4](#24-the-third-option-make-the-one-page-you-have-rank). Publishing five templated pages at
once on a domain with no authority is the shape to avoid.

### 6.1 CTA rules, whatever gets written

- **Always render the `https://` URL as visible text on every page.** `webcal://` is derived by
  string replacement (`src/home.ts:171`) and is not a crawlable link, so a webcal-only CTA makes
  the page's primary action invisible to crawlers and can silently no-op on desktop browsers with
  no registered handler. The homepage's crawlable hedge is the footer anchor at
  `src/home.ts:865`.
- **On how-to pages the CTA is the worked example** — the copyable field must render inline at
  the paste step, not only above the fold.
- **Implementation trap:** the copy script binds via `document.querySelector(".copy-button")`
  (singular, `src/home.ts:871-873`). Any page with both a top and bottom CTA gets a dead second
  button until that becomes `querySelectorAll`.

---

## 7. What could not be verified here

Stated plainly, because several conclusions above are gated on it.

- **`en.wikipedia.org`, `grandslamcalendar.com`, `developers.google.com`, `schema.org` and
  `developers.cloudflare.com` are all blocked by this environment's egress policy** (403 on
  CONNECT). Every Google and Cloudflare claim in this document is therefore **search-snippet
  derived, not read from the primary doc**. They are well-known behaviours, but re-check before
  anything ships on them.
- **Whether the site is deployed and indexed at all is unknown.** "Ranks poorly" and "was never
  indexed" are indistinguishable from here, and they imply completely different work.
- **How many events KV actually holds is unknown** (4 vs 8). This single number decides whether
  the homepage "show next season" work ships anything or is a no-op.
- No browser was run. Byte-identity closes that gap for the extraction commit; it does not close
  it for the new blog CSS.

All three unknowns are minutes of work from an unrestricted machine, and all three come before
any implementation.

---

## 8. Follow-up issues

Raised on GitHub, in dependency order.

| # | Issue | Sections |
|---|---|---|
| [#8](https://github.com/danworkman1/tennis-grandslam-cal/issues/8) | Confirm what the pipeline holds and whether the site is indexed | [§1.2](#12-the-january-2027-problem), [§7](#7-what-could-not-be-verified-here) |
| [#9](https://github.com/danworkman1/tennis-grandslam-cal/issues/9) | Seed 2027 Grand Slam dates before the January 2027 cron | [§1.2](#12-the-january-2027-problem) |
| [#10](https://github.com/danworkman1/tennis-grandslam-cal/issues/10) | Set up Search Console, and decide analytics under the no-third-party-scripts rule | [§5.4](#54-search-console) |
| [#11](https://github.com/danworkman1/tennis-grandslam-cal/issues/11) | Homepage: render the upcoming season, and make the metadata intent-led | [§2.4](#24-the-third-option-make-the-one-page-you-have-rank) |
| [#12](https://github.com/danworkman1/tennis-grandslam-cal/issues/12) | Stop the legacy `workers.dev` host being indexed, without disabling it | [§5.5](#55-the-legacy-origin) |
| [#13](https://github.com/danworkman1/tennis-grandslam-cal/issues/13) | Extract shared layout from `home.ts` as a byte-identical pure move | [§4.1](#41-the-extraction-is-much-smaller-than-the-issue-assumes) |
| [#14](https://github.com/danworkman1/tennis-grandslam-cal/issues/14) | Add `/blog` routing, TS-module content storage, page chrome and a proper 404 | [§3](#3-content-storage), [§4.2](#42-the-work-the-extraction-does-not-give-you--now-measured), [§4.3](#43-routing) |
| [#15](https://github.com/danworkman1/tennis-grandslam-cal/issues/15) | Sitemap: enumerate pages, drop `changefreq`, and add per-page head tags | [§5.1](#51-sitemap), [§5.2](#52-per-page-head) |
| [#16](https://github.com/danworkman1/tennis-grandslam-cal/issues/16) | Add a landing-page register to `daniel-voice-skill`, then draft one launch post | [§2.3](#23-a-blog-not-yet), [§6](#6-launch-shortlist--and-why-it-is-not-decision-grade) |

**#9 ships regardless of what happens to #7** — it is a correctness fix with a deadline, not an SEO
item. **#13 through #16 are all conditional on #8, #10 and #11 coming back favourably.** That
conditionality is the point of the spike.
