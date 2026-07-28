import { escapeHtml } from "./html.js";
import { COPY_SCRIPT, renderPage } from "./layout.js";
import { SEED, type SlamEvent } from "./seed.js";
import { dateRange, seasonEvents, SLAM_DETAILS } from "./slams.js";

export type HomeStatus = {
  lastSuccess: string | null;
  failCount: number;
  servingStale: boolean;
};

function renderSeasonRows(events: SlamEvent[]): string {
  return events
    .map((event) => {
      const detail = SLAM_DETAILS[event.key];
      return `<li class="season-row season-row--${event.key}">
        <span class="season-row__code" aria-hidden="true">${detail.code}</span>
        <span class="season-row__event">
          <strong>${escapeHtml(detail.shortName)}</strong>
          <span>${escapeHtml(detail.city)} · ${escapeHtml(detail.surface)}</span>
        </span>
        <time datetime="${escapeHtml(event.start)}">${escapeHtml(dateRange(event))}</time>
      </li>`;
    })
    .join("");
}

function renderSlamCards(events: SlamEvent[]): string {
  return events
    .map((event) => {
      const detail = SLAM_DETAILS[event.key];
      return `<article class="slam-card slam-card--${event.key}">
        <div class="slam-card__topline">
          <span>${detail.number} / 04</span>
          <span>${escapeHtml(detail.surface)}</span>
        </div>
        <div class="slam-card__mark" aria-hidden="true">${detail.code}</div>
        <div class="slam-card__body">
          <p>${escapeHtml(detail.city)}</p>
          <h3>${escapeHtml(detail.shortName)}</h3>
          <time datetime="${escapeHtml(event.start)}">${escapeHtml(dateRange(event))}</time>
        </div>
      </article>`;
    })
    .join("");
}

function statusCopy(status: HomeStatus): { label: string; className: string } {
  if (!status.lastSuccess) {
    return { label: "Protected season dates active", className: "status--neutral" };
  }
  if (status.failCount > 0 || status.servingStale) {
    return { label: "Last-known-good dates active", className: "status--watching" };
  }
  const parsed = new Date(status.lastSuccess);
  if (!Number.isNaN(parsed.getTime())) {
    const updated = new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(parsed);
    return { label: `Feed healthy · checked ${updated}`, className: "status--healthy" };
  }
  return { label: "Protected season dates active", className: "status--neutral" };
}


export function renderHomePage(
  origin: string,
  events: SlamEvent[] = SEED,
  status: HomeStatus = { lastSuccess: null, failCount: 0, servingStale: true },
  now: Date = new Date(),
): string {
  const baseUrl = origin.replace(/\/+$/, "");
  const httpsFeedUrl = `${baseUrl}/slams.ics`;
  const webcalFeedUrl = httpsFeedUrl.replace(/^https?:\/\//i, "webcal://");
  const homepageUrl = `${baseUrl}/`;
  const safeHttpsFeedUrl = escapeHtml(httpsFeedUrl);
  const safeWebcalFeedUrl = escapeHtml(webcalFeedUrl);
  const safeHomepageUrl = escapeHtml(homepageUrl);
  const currentSeason = seasonEvents(events, now);
  const seasonYear = currentSeason[0]?.start.slice(0, 4) ?? "2026";
  const feedStatus = statusCopy(status);
  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Grand Slam Calendar",
    url: homepageUrl,
    description:
      "A free, subscribable calendar of the Australian Open, Roland-Garros, Wimbledon and US Open.",
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Any",
  }).replace(/</g, "\\u003c");

  return renderPage({
    head: {
      title: `${escapeHtml(seasonYear)} Grand Slam dates — all four tennis majors in one calendar`,
      description: `The ${escapeHtml(seasonYear)} Australian Open, Roland-Garros, Wimbledon and US Open dates, as one free calendar subscription that keeps itself up to date. No account needed.`,
      canonicalUrl: safeHomepageUrl,
      ogTitle: `${escapeHtml(seasonYear)} Grand Slam dates. One living calendar.`,
      ogDescription:
        "One free subscription for all four tennis majors, kept current as dates change.",
      structuredData,
    },
    feedUrl: safeHttpsFeedUrl,
    scripts: COPY_SCRIPT,
    content: `  <header class="hero">
    <nav class="nav shell" aria-label="Primary navigation">
      <a class="brand" href="/" aria-label="Grand Slam Calendar home">
        <span class="brand__ball" aria-hidden="true"></span>
        <span>Grand Slam Calendar</span>
      </a>
      <a class="nav__status ${feedStatus.className}" href="/health" aria-label="${escapeHtml(feedStatus.label)}">
        <span class="nav__status-long">${escapeHtml(feedStatus.label)}</span><span class="nav__status-short">Status</span>
      </a>
    </nav>

    <div class="hero__grid shell">
      <div class="hero__copy">
        <p class="eyebrow">The majors, without the admin</p>
        <h1>${escapeHtml(seasonYear)} Grand Slam dates. <em>One calendar.</em></h1>
        <p class="hero__lede">Subscribe once to the Australian Open, Roland-Garros, Wimbledon and the US Open. The dates live in your calendar—and keep up when the season moves.</p>
        <div class="hero__actions">
          <a class="button button--primary" href="${safeWebcalFeedUrl}">
            Add all four slams
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </a>
          <a class="button button--secondary" href="#subscribe">Copy the calendar URL</a>
        </div>
        <ul class="proof-list" aria-label="Calendar features">
          <li>Updated weekly</li>
          <li>All-day events</li>
          <li>No account needed</li>
        </ul>
      </div>

      <div class="season-board-wrap" aria-label="${escapeHtml(seasonYear)} Grand Slam season">
        <div class="season-board">
          <div class="season-board__header">
            <div><p>Season programme</p><h2>The four majors</h2></div>
            <span class="season-board__year" aria-hidden="true">${escapeHtml(seasonYear)}</span>
          </div>
          <ol class="season-list">${renderSeasonRows(currentSeason)}</ol>
          <div class="season-board__footer"><span>4 tournaments · 1 subscription</span><span>All-day date ranges</span></div>
        </div>
      </div>
    </div>
  </header>

  <main id="main">
    <section class="section shell" aria-labelledby="season-title">
      <div class="section-heading">
        <div><p class="eyebrow">The ${escapeHtml(seasonYear)} season</p><h2 id="season-title">One trip around the tennis world.</h2></div>
        <p>From Melbourne hard courts to New York nights, each major lands as one clean all-day event covering the full main draw.</p>
      </div>
      <div class="slam-grid">${renderSlamCards(currentSeason)}</div>
    </section>

    <section class="section how" id="how-it-works" aria-labelledby="how-title">
      <div class="shell">
        <div class="section-heading">
          <div><p class="eyebrow">How it works</p><h2 id="how-title">Set it once. Let the season come to you.</h2></div>
          <p>This is a calendar subscription, not a one-off download. Your calendar keeps the feed URL and checks it for changes on its own schedule.</p>
        </div>
        <div class="steps">
          <article class="step"><span class="step__number">01</span><h3>Subscribe</h3><p>Use the one-click button, or paste the HTTPS feed URL into your calendar app.</p></article>
          <article class="step"><span class="step__number">02</span><h3>See the season</h3><p>All four majors appear as all-day date ranges, so travel and tournament weeks are easy to scan.</p></article>
          <article class="step"><span class="step__number">03</span><h3>Stay current</h3><p>The feed checks source dates weekly. Your app chooses when to poll and applies any published changes.</p></article>
        </div>
      </div>
    </section>

    <section class="section shell" id="subscribe" aria-labelledby="subscribe-title">
      <div class="subscribe-panel">
        <div class="subscribe-panel__copy">
          <p class="eyebrow">Manual setup</p>
          <h2 id="subscribe-title">Your season, one URL.</h2>
          <p>Copy this address when your calendar asks for a subscription or “calendar from URL.” It stays the same as dates update.</p>
        </div>
        <div class="subscribe-panel__tools" data-copy-scope>
          <div class="feed-field">
            <input class="feed-url" type="url" value="${safeHttpsFeedUrl}" aria-label="Calendar subscription URL" readonly>
            <button class="copy-button" type="button" data-copy-url="${safeHttpsFeedUrl}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" stroke-width="2"/></svg>
              <span>Copy URL</span>
            </button>
          </div>
          <p class="copy-status" role="status" aria-live="polite">Use the HTTPS address for manual setup.</p>
          <div class="app-notes" aria-label="Calendar app instructions">
            <div class="app-note"><strong>Apple Calendar</strong><span>Use “Add all four slams” or add a new calendar subscription.</span></div>
            <div class="app-note"><strong>Google Calendar</strong><span>On the web, add another calendar using “From URL.”</span></div>
            <div class="app-note"><strong>Outlook</strong><span>Choose “Subscribe from web” and paste the URL above.</span></div>
          </div>
        </div>
      </div>
    </section>

    <section class="section shell" aria-labelledby="trust-title">
      <div class="trust">
        <div class="trust__copy">
          <p class="eyebrow">Quietly dependable</p>
          <h2 id="trust-title">Built for the dates that move.</h2>
          <p>Tournament schedules can shift. The feed is deliberately small, checked and resilient so a bad source update never wipes out a good calendar.</p>
        </div>
        <ul class="trust-list">
          <li><span class="trust-list__icon" aria-hidden="true">7D</span><div><h3>Checked every week</h3><p>Published tournament date ranges are refreshed on a weekly schedule, with daily refresh hints sent to calendar apps.</p></div></li>
          <li><span class="trust-list__icon" aria-hidden="true">✓</span><div><h3>Dates are sanity-checked</h3><p>Each update must fit the expected season window and tournament length before it can replace known-good data.</p></div></li>
          <li><span class="trust-list__icon" aria-hidden="true">LKG</span><div><h3>Safe when sources wobble</h3><p>If a refresh fails, the feed keeps serving its last-known-good dates instead of publishing gaps or nonsense.</p></div></li>
          <li><span class="trust-list__icon" aria-hidden="true">0</span><div><h3>No account, no tracking</h3><p>There is no signup and no personal calendar access. Your app simply reads the same public feed as everyone else.</p></div></li>
        </ul>
      </div>
    </section>

    <section class="section faq shell" aria-labelledby="faq-title">
      <div class="section-heading">
        <div><p class="eyebrow">Good to know</p><h2 id="faq-title">Before first serve.</h2></div>
        <p>The simple version: one event per tournament, built for season planning rather than match-by-match alerts.</p>
      </div>
      <div class="faq-grid">
        <div>
          <details><summary>Does this include individual matches?</summary><p>No. Each major is one all-day event spanning the main draw. Match times and draws change too often for this feed’s season-planning purpose.</p></details>
          <details><summary>How quickly will a date change appear?</summary><p>The source is checked weekly. Calendar apps then refresh subscriptions on their own schedules, so changes may not appear instantly.</p></details>
        </div>
        <div>
          <details><summary>Will time zones move the dates?</summary><p>No. Events use date-only calendar values, so they remain all-day events wherever you are.</p></details>
          <details><summary>How do I remove the calendar?</summary><p>Delete or unsubscribe from “Tennis Grand Slams” in your calendar app. It will not affect any of your other calendars.</p></details>
        </div>
      </div>
    </section>
  </main>`,
  });
}
