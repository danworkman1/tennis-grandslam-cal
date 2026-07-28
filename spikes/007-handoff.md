# Handoff — finish spike 007 from a session with internet access

> ## ✅ Completed — kept as a record, do not re-run
>
> Executed on 28 July 2026 from a session with network access. Outcomes:
>
> - **Task 1 — done.** All four 2027 dates confirmed against the official 2027 ATP
>   Tour calendar, the AO also against ausopen.com. **No value changed.** The US
>   Open was the one genuinely at risk: 29 Aug is right, and the wrong 30 Aug that
>   several aggregators publish would have passed validation silently.
> - **Task 2 — done, issue #8 closed.** Four VEVENTs, not eight, as predicted.
>   `serving_stale: false`, `fail_count: 0`. It also turned up a live defect the
>   spike had not predicted — see the US Open note in #8.
> - **Task 3 — issue #10.** Search Console and analytics are dashboard work that
>   needs the account owner; the repo-side conclusions are recorded on the issue.
> - **Task 4 — done, issue #16 closed.** The launch post went through the
>   `daniel-voice` skill.
> - **Merge order — followed.** All six PRs merged. One correction to the note
>   below: #23 did **not** auto-retarget when #21 merged. Deleting #21's branch
>   *closed* #23 outright, and it had to be reopened and repointed at `main` by
>   hand. The warning was right, the mechanism was not.
>
> The rest of this file is the original brief, unchanged.

---

Paste this whole file (or point at it in the repo) into a session that has outbound
network access. Everything here was blocked in the authoring session because egress
to `en.wikipedia.org`, the tournament sites and `grandslamcalendar.com` returned
`CONNECT tunnel failed, response 403`.

Repo: `danworkman1/tennis-grandslam-cal`. Background: [`spikes/007-blog-posts-seo.md`](007-blog-posts-seo.md), issue #7.

There are six open PRs (#18–#23). **Task 1 is the only thing blocking a merge.**

---

## Task 1 — Verify the 2027 Grand Slam dates (blocking PR #18)

**Branch:** `claude/blog-posts-seo-lfimgw-seed-2027` · **File:** `src/seed.ts`, `SEED_DATES[2027]`

### Why this matters

`refresh()` targets `[thisYear, thisYear+1]`. On the first cron of January 2027 the
window becomes `[2027, 2028]`. If Wikipedia has no year-specific 2027 articles yet,
the parser discards the parent-page redirect by design, KV holds no 2027 last-known-good,
and — before this PR — the seed had expired. `mergeEvents` returns nothing, the hard gate
throws, and **the feed silently keeps serving 2026 dates**.

The seed is the last-resort fallback. If its values are wrong, nothing downstream catches
it, so these four ranges have to be right at the source.

### What is currently in the PR, and its provenance

| Tournament | `start` (first main-draw day) | `endExclusive` (day AFTER final day) | Final day | Provenance |
|---|---|---|---|---|
| Australian Open | `2027-01-17` | `2027-02-01` | 31 Jan 2027 | **Inferred** from 2026's weekday pattern |
| Roland-Garros | `2027-05-23` | `2027-06-07` | 6 Jun 2027 | **Inferred** |
| Wimbledon | `2027-06-28` | `2027-07-12` | 11 Jul 2027 | Reported as 28 Jun – 11 Jul; still confirm |
| US Open | `2027-08-29` | `2027-09-13` | 12 Sep 2027 | **Inferred** |

The inference: each 2027 start falls on the same weekday as the confirmed 2026 start
(AO/RG/US Open Sunday, Wimbledon Monday). That was verified as internally consistent —
**but a matching weekday is not an announcement.** Do not treat the table as a source.

### What to do

1. Check each tournament's **own published calendar** (ausopen.com, rolandgarros.com,
   wimbledon.com, usopen.org). Wikipedia's `2027 <tournament>` articles are an
   acceptable cross-check — and worth looking at anyway, see Task 2.
2. Correct any value that is wrong. **Do not** rewrite the surrounding structure.
3. Run `pnpm test && pnpm typecheck`. The added tests assert a cold start in 2027
   produces a complete, valid set and clears the hard gate.
4. Update PR #18: replace the "⚠️ Blocked on date verification" section with what you
   confirmed and the source URL for each tournament.

### Two traps

- **Main draw vs qualifying.** Published ranges very often quote qualifying or "opening
  week" alongside the main draw, so the same tournament legitimately appears with two
  different start dates. `SlamEvent.start` is the **first main-draw day**.
- **`endExclusive` is exclusive.** It is the day *after* the final, because ICS `DTEND`
  is exclusive. A 14-day event starting `2027-06-28` ends `2027-07-12`, not `2027-07-11`.

`isValidEvent` (`src/validate.ts`) rejects anything outside an 11–17 day duration or
outside the expected start month (AO Jan, RG May, Wimbledon Jun/Jul, US Open Aug). That
catches festival-wide ranges but will happily accept a plausible-looking wrong week.

---

## Task 2 — Confirm what the pipeline actually holds (issue #8)

Two minutes, and it settles a question the spike could not.

```bash
curl -s https://grandslamcalendar.com/health
curl -s https://grandslamcalendar.com/slams.ics | grep -c BEGIN:VEVENT
```

- **How many VEVENTs?** The spike predicts **4, not 8** — a search for
  `2027 Wimbledon Championships` returns the parent article rather than a year article,
  the same redirect signature `test/source.test.ts` encodes. Confirm which.
- **Is `serving_stale` false and `fail_count` 0?** If not, that outranks all the SEO work.
- Also confirm the site is actually deployed and reachable on the branded domain.

Record the answer on issue #8 and close it.

---

## Task 3 — Search Console and analytics (issue #10)

Mostly dashboard work, but worth advising on:

- Create a **Domain property verified by DNS TXT in Cloudflare**. It covers all
  subdomains, needs no code, and avoids a verification tag that the legacy
  `workers.dev` host would also serve. Then submit `/sitemap.xml`.
- Confirm no verification artefact is needed in the repo (there is none today: no
  meta tag, no `google*.html`).
- **Analytics constraint:** Cloudflare Web Analytics requires the
  `static.cloudflareinsights.com` beacon, which violates this project's
  no-third-party-scripts rule (issue #6). The script-free alternative is a Workers
  Analytics Engine binding written server-side.

Nothing downstream is measurable until this exists.

---

## Task 4 — Voice pass on the launch post (issue #16)

PR #23 adds `/blog/add-tennis-grand-slams-to-your-calendar`. The prose was written
**without** `danworkman1/daniel-voice-skill` — that repo is private and was outside the
authoring session's scope. It follows the voice already on the homepage (dry, concrete,
short sentences, no hype), but that is inference from existing copy, not the skill.

If the remote session can read that repo:

1. Add the landing-page register to the skill (the outstanding half of #16).
2. Run the post's body in `src/blog.ts` through it.
3. Structure, routing and CTA placement are settled — **wording only**.

---

## Merge order

Two PRs touch `home.ts`, and one is stacked, so order matters:

```
#19, #20  (independent, any time)
   → #21  (layout extraction — must precede #22 and #23)
      → #22  (homepage; rebases mechanically after #21)
      → #23  (blog; base auto-retargets to main once #21 merges)
#18  whenever the dates above are confirmed
```

**#23 must not be merged into `claude/blog-posts-seo-lfimgw-layout` directly** — GitHub
only auto-closes issues on merge into the default branch, so #14 and #15 would stay open
and need closing by hand.

Issue #16 has no closing keyword anywhere on purpose; it stays open until Task 4 is done.

---

## Reviewer decision still outstanding

PR #22 changes the homepage `h1` from "Every Grand Slam. *One calendar.*" to
"2026 Grand Slam dates. *One calendar.*" — better for search, but it replaces the brand
line. That is Daniel's call, not something to resolve from the repo. One line to revert.
