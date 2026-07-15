import { SEED, type SlamEvent, type SlamKey } from "./seed.js";

export type HomeStatus = {
  lastSuccess: string | null;
  failCount: number;
  servingStale: boolean;
};

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

const SLAM_DETAILS: Record<
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

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function inclusiveEnd(endExclusive: string): string {
  const end = new Date(`${endExclusive}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() - 1);
  return end.toISOString().slice(0, 10);
}

function shortDate(iso: string): string {
  const month = MONTHS[Number(iso.slice(5, 7)) - 1] ?? "";
  return `${Number(iso.slice(8, 10))} ${month}`;
}

function dateRange(event: SlamEvent): string {
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

function seasonEvents(events: SlamEvent[]): SlamEvent[] {
  const usable = (events as unknown[]).filter(isDisplayableEvent);
  const sorted = [...usable].sort((a, b) => a.start.localeCompare(b.start));
  const firstYear = sorted[0]?.start.slice(0, 4);
  const season = sorted.filter((event) => event.start.startsWith(`${firstYear}-`)).slice(0, 4);
  const hasEverySlam = new Set(season.map((event) => event.key)).size === 4;
  return season.length === 4 && hasEverySlam ? season : SEED;
}

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
): string {
  const baseUrl = origin.replace(/\/+$/, "");
  const httpsFeedUrl = `${baseUrl}/slams.ics`;
  const webcalFeedUrl = httpsFeedUrl.replace(/^https?:\/\//i, "webcal://");
  const homepageUrl = `${baseUrl}/`;
  const safeHttpsFeedUrl = escapeHtml(httpsFeedUrl);
  const safeWebcalFeedUrl = escapeHtml(webcalFeedUrl);
  const safeHomepageUrl = escapeHtml(homepageUrl);
  const currentSeason = seasonEvents(events);
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

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Grand Slam Calendar — all four tennis majors, one subscription</title>
  <meta name="description" content="Add the Australian Open, Roland-Garros, Wimbledon and US Open to your calendar with one free, automatically updated subscription.">
  <meta name="theme-color" content="#123c2b">
  <meta name="color-scheme" content="light">
  <link rel="canonical" href="${safeHomepageUrl}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <meta property="og:type" content="website">
  <meta property="og:title" content="Every Grand Slam. One living calendar.">
  <meta property="og:description" content="One free subscription for all four tennis majors, kept current as dates change.">
  <meta property="og:url" content="${safeHomepageUrl}">
  <meta name="twitter:card" content="summary">
  <script type="application/ld+json">${structuredData}</script>
  <style>
    :root {
      --paper: #f4f0e4;
      --paper-deep: #e8e1d0;
      --ink: #14251c;
      --muted: #607066;
      --green: #123c2b;
      --green-deep: #08271c;
      --green-soft: #d9e6d8;
      --ball: #dfff55;
      --white: #fffdf6;
      --clay: #d77952;
      --blue: #5079c8;
      --violet: #75609b;
      --line: rgba(20, 37, 28, 0.16);
      --shadow: 0 24px 70px rgba(16, 42, 29, 0.14);
      --sans: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --serif: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
    }

    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      color: var(--ink);
      background: var(--paper);
      font-family: var(--sans);
      font-size: 16px;
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }
    a { color: inherit; }
    button, input { font: inherit; }
    ::selection { color: var(--green-deep); background: var(--ball); }

    .skip-link {
      position: fixed;
      z-index: 100;
      top: 0.75rem;
      left: 0.75rem;
      padding: 0.7rem 1rem;
      color: var(--green-deep);
      background: var(--ball);
      border-radius: 999px;
      font-weight: 800;
      transform: translateY(-180%);
      transition: transform 160ms ease;
    }
    .skip-link:focus { transform: translateY(0); }

    .shell { width: min(1180px, calc(100% - 2.5rem)); margin-inline: auto; }
    .eyebrow {
      margin: 0 0 1rem;
      font-size: 0.74rem;
      font-weight: 800;
      letter-spacing: 0.16em;
      line-height: 1.3;
      text-transform: uppercase;
    }

    .hero {
      position: relative;
      min-height: 760px;
      overflow: hidden;
      color: var(--white);
      background:
        radial-gradient(circle at 88% 18%, rgba(223, 255, 85, 0.12) 0 2px, transparent 3px),
        linear-gradient(135deg, var(--green) 0%, var(--green-deep) 100%);
    }
    .hero::before {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      opacity: 0.12;
      background-image: radial-gradient(rgba(255, 253, 246, 0.9) 0.65px, transparent 0.65px);
      background-size: 7px 7px;
      mask-image: linear-gradient(to bottom, black, transparent 82%);
    }
    .hero::after {
      content: "";
      position: absolute;
      width: 540px;
      height: 540px;
      right: -270px;
      top: 7rem;
      border: 1px solid rgba(255, 253, 246, 0.2);
      border-radius: 50%;
      box-shadow: 0 0 0 90px rgba(255, 253, 246, 0.03), 0 0 0 180px rgba(255, 253, 246, 0.025);
    }

    .nav {
      position: relative;
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 84px;
      border-bottom: 1px solid rgba(255, 253, 246, 0.18);
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 0.75rem;
      color: var(--white);
      font-size: 0.88rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-decoration: none;
      text-transform: uppercase;
    }
    .brand__ball {
      position: relative;
      width: 30px;
      height: 30px;
      overflow: hidden;
      flex: none;
      background: var(--ball);
      border-radius: 50%;
      box-shadow: 0 0 0 5px rgba(223, 255, 85, 0.12);
    }
    .brand__ball::before,
    .brand__ball::after {
      content: "";
      position: absolute;
      width: 25px;
      height: 38px;
      top: -5px;
      border: 1.5px solid var(--green-deep);
      border-radius: 50%;
    }
    .brand__ball::before { left: -18px; }
    .brand__ball::after { right: -18px; }
    .nav__status {
      display: inline-flex;
      align-items: center;
      gap: 0.6rem;
      color: rgba(255, 253, 246, 0.78);
      font-size: 0.78rem;
      text-decoration: none;
    }
    .nav__status::before {
      content: "";
      width: 8px;
      height: 8px;
      flex: none;
      background: var(--ball);
      border-radius: 50%;
      box-shadow: 0 0 0 4px rgba(223, 255, 85, 0.12);
    }
    .nav__status.status--watching::before { background: #ffc36e; box-shadow: 0 0 0 4px rgba(255, 195, 110, 0.12); }
    .nav__status:hover { color: var(--white); }
    .nav__status-short { display: none; }

    .hero__grid {
      position: relative;
      z-index: 1;
      display: grid;
      grid-template-columns: minmax(0, 1.05fr) minmax(420px, 0.82fr);
      gap: clamp(3rem, 8vw, 7rem);
      align-items: center;
      padding-block: clamp(5rem, 10vw, 8.5rem) 7rem;
    }
    .hero__copy { max-width: 660px; }
    .hero__copy .eyebrow { color: var(--ball); }
    h1 {
      max-width: 10ch;
      margin: 0;
      font-family: var(--serif);
      font-size: clamp(4rem, 8vw, 7.5rem);
      font-weight: 500;
      letter-spacing: -0.065em;
      line-height: 0.88;
    }
    h1 em { color: var(--ball); font-weight: 500; }
    .hero__lede {
      max-width: 600px;
      margin: 2rem 0 0;
      color: rgba(255, 253, 246, 0.76);
      font-size: clamp(1rem, 2vw, 1.15rem);
      line-height: 1.7;
    }
    .hero__actions { display: flex; flex-wrap: wrap; gap: 0.8rem; margin-top: 2rem; }
    .button {
      min-height: 50px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.65rem;
      padding: 0.85rem 1.2rem;
      border: 1px solid transparent;
      border-radius: 999px;
      font-size: 0.88rem;
      font-weight: 800;
      line-height: 1;
      text-decoration: none;
      transition: transform 180ms ease, box-shadow 180ms ease, background-color 180ms ease;
    }
    .button svg { width: 18px; height: 18px; }
    .button--primary { color: var(--green-deep); background: var(--ball); box-shadow: 0 12px 30px rgba(0, 0, 0, 0.16); }
    .button--secondary { color: var(--white); border-color: rgba(255, 253, 246, 0.28); background: rgba(255, 253, 246, 0.06); }
    .button:hover { transform: translateY(-2px); }
    .button--primary:hover { box-shadow: 0 15px 36px rgba(0, 0, 0, 0.22); }
    .button--secondary:hover { background: rgba(255, 253, 246, 0.12); }
    .button:focus-visible, .copy-button:focus-visible, a:focus-visible { outline: 3px solid var(--ball); outline-offset: 4px; }

    .proof-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.65rem 1.25rem;
      margin: 2.2rem 0 0;
      padding: 0;
      color: rgba(255, 253, 246, 0.7);
      font-size: 0.76rem;
      font-weight: 700;
      list-style: none;
    }
    .proof-list li { display: inline-flex; align-items: center; gap: 0.45rem; }
    .proof-list li::before { content: "✓"; color: var(--ball); font-weight: 900; }

    .season-board-wrap { position: relative; }
    .season-board-wrap::before {
      content: "";
      position: absolute;
      z-index: -1;
      width: 140px;
      height: 140px;
      right: -55px;
      top: -48px;
      background: var(--ball);
      border-radius: 50%;
      opacity: 0.92;
    }
    .season-board {
      overflow: hidden;
      color: var(--ink);
      background: var(--white);
      border: 1px solid rgba(255, 255, 255, 0.45);
      border-radius: 6px;
      box-shadow: 0 30px 80px rgba(0, 0, 0, 0.28);
      transform: rotate(1.5deg);
    }
    .season-board__header {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 1rem;
      padding: 1.5rem 1.55rem 1.25rem;
      color: var(--white);
      background: #183f30;
    }
    .season-board__header p { margin: 0 0 0.2rem; color: var(--ball); font-size: 0.66rem; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; }
    .season-board__header h2 { margin: 0; font-family: var(--serif); font-size: 1.65rem; font-weight: 500; line-height: 1; }
    .season-board__year { color: rgba(255,255,255,0.35); font-family: var(--serif); font-size: 2.4rem; line-height: 0.8; }
    .season-list { margin: 0; padding: 0; list-style: none; }
    .season-row {
      position: relative;
      display: grid;
      grid-template-columns: 44px 1fr auto;
      gap: 0.85rem;
      align-items: center;
      min-height: 82px;
      padding: 1rem 1.45rem;
      border-bottom: 1px solid var(--line);
    }
    .season-row:last-child { border-bottom: 0; }
    .season-row::before { content: ""; position: absolute; inset: 0 auto 0 0; width: 5px; background: var(--blue); }
    .season-row--rg::before { background: var(--clay); }
    .season-row--wimbledon::before { background: var(--green); }
    .season-row--usopen::before { background: var(--violet); }
    .season-row__code {
      width: 38px;
      height: 38px;
      display: grid;
      place-items: center;
      color: var(--green-deep);
      background: var(--paper);
      border-radius: 50%;
      font-size: 0.67rem;
      font-weight: 900;
    }
    .season-row__event { display: flex; min-width: 0; flex-direction: column; }
    .season-row__event strong { font-family: var(--serif); font-size: 1.02rem; font-weight: 600; line-height: 1.2; }
    .season-row__event span { overflow: hidden; color: var(--muted); font-size: 0.68rem; text-overflow: ellipsis; white-space: nowrap; }
    .season-row time { color: var(--ink); font-size: 0.7rem; font-weight: 800; }
    .season-board__footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.9rem 1.45rem;
      color: var(--muted);
      background: #efebdf;
      font-size: 0.66rem;
      font-weight: 700;
    }
    .season-board__footer span:first-child { color: var(--green); }

    .section { padding-block: clamp(5rem, 10vw, 8.5rem); }
    .section-heading { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(280px, 0.65fr); gap: 3rem; align-items: end; margin-bottom: 3rem; }
    .section-heading .eyebrow { color: var(--muted); }
    .section-heading h2, .trust__copy h2, .subscribe-panel h2 {
      max-width: 13ch;
      margin: 0;
      font-family: var(--serif);
      font-size: clamp(2.8rem, 5vw, 5rem);
      font-weight: 500;
      letter-spacing: -0.05em;
      line-height: 0.98;
    }
    .section-heading > p { max-width: 500px; margin: 0; color: var(--muted); }
    .slam-grid { display: grid; grid-template-columns: repeat(4, 1fr); border-top: 1px solid var(--line); border-left: 1px solid var(--line); }
    .slam-card {
      position: relative;
      min-height: 390px;
      display: flex;
      overflow: hidden;
      flex-direction: column;
      justify-content: space-between;
      padding: 1.25rem;
      background: #e6e9de;
      border-right: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
      isolation: isolate;
    }
    .slam-card::after {
      content: "";
      position: absolute;
      z-index: -1;
      width: 240px;
      height: 240px;
      right: -120px;
      top: 65px;
      border: 1px solid rgba(20, 37, 28, 0.18);
      border-radius: 50%;
    }
    .slam-card--rg { background: #e6c0a3; }
    .slam-card--wimbledon { background: #cddcbf; }
    .slam-card--usopen { color: var(--white); background: #2e4d78; }
    .slam-card--usopen::after { border-color: rgba(255,255,255,0.2); }
    .slam-card__topline { display: flex; justify-content: space-between; font-size: 0.65rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
    .slam-card__mark {
      color: rgba(20, 37, 28, 0.08);
      font-family: var(--serif);
      font-size: clamp(5rem, 9vw, 8rem);
      font-weight: 700;
      letter-spacing: -0.08em;
      line-height: 0.7;
    }
    .slam-card--usopen .slam-card__mark { color: rgba(255,255,255,0.1); }
    .slam-card__body p { margin: 0 0 0.35rem; font-size: 0.7rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
    .slam-card__body h3 { min-height: 2.3em; margin: 0 0 1rem; font-family: var(--serif); font-size: clamp(1.65rem, 3vw, 2.3rem); font-weight: 500; letter-spacing: -0.04em; line-height: 1.02; }
    .slam-card__body time { display: inline-block; padding-top: 0.65rem; border-top: 1px solid currentColor; font-size: 0.74rem; font-weight: 800; }

    .how { color: var(--white); background: var(--green-deep); }
    .how .section-heading .eyebrow { color: var(--ball); }
    .how .section-heading > p { color: rgba(255,253,246,0.65); }
    .steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: rgba(255,255,255,0.14); border: 1px solid rgba(255,255,255,0.14); }
    .step { min-height: 310px; padding: clamp(1.5rem, 4vw, 2.7rem); background: var(--green-deep); }
    .step__number { display: block; margin-bottom: 4rem; color: var(--ball); font-family: var(--serif); font-size: 1.2rem; }
    .step h3 { margin: 0 0 0.8rem; font-family: var(--serif); font-size: 2rem; font-weight: 500; letter-spacing: -0.03em; }
    .step p { margin: 0; color: rgba(255,253,246,0.62); font-size: 0.88rem; }

    .subscribe-panel {
      position: relative;
      display: grid;
      grid-template-columns: minmax(0, 0.85fr) minmax(390px, 1.15fr);
      gap: clamp(3rem, 8vw, 7rem);
      align-items: center;
      overflow: hidden;
      padding: clamp(2rem, 7vw, 5rem);
      color: var(--green-deep);
      background: var(--ball);
      border-radius: 8px;
      box-shadow: var(--shadow);
    }
    .subscribe-panel::after {
      content: "";
      position: absolute;
      width: 340px;
      height: 340px;
      left: -230px;
      bottom: -180px;
      border: 2px solid rgba(8,39,28,0.18);
      border-radius: 50%;
      box-shadow: 0 0 0 55px rgba(8,39,28,0.04), 0 0 0 110px rgba(8,39,28,0.03);
    }
    .subscribe-panel__copy, .subscribe-panel__tools { position: relative; z-index: 1; }
    .subscribe-panel .eyebrow { color: rgba(8,39,28,0.62); }
    .subscribe-panel h2 { max-width: 10ch; }
    .subscribe-panel__copy > p:last-child { max-width: 430px; margin: 1.2rem 0 0; color: rgba(8,39,28,0.7); }
    .feed-field { display: flex; align-items: stretch; gap: 0.6rem; padding: 0.55rem; background: var(--white); border: 1px solid rgba(8,39,28,0.15); border-radius: 8px; }
    .feed-url { min-width: 0; display: block; flex: 1; padding: 0.7rem; overflow: hidden; color: var(--muted); background: transparent; border: 0; outline: 0; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.74rem; text-overflow: ellipsis; white-space: nowrap; }
    .feed-url:focus { box-shadow: inset 0 -2px 0 var(--green); }
    .copy-button {
      min-width: 108px;
      min-height: 48px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.7rem 1rem;
      color: var(--white);
      background: var(--green-deep);
      border: 0;
      border-radius: 5px;
      cursor: pointer;
      font-size: 0.78rem;
      font-weight: 800;
    }
    .copy-button svg { width: 16px; height: 16px; }
    .app-notes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem; margin-top: 0.7rem; }
    .app-note { padding: 1rem; background: rgba(255,253,246,0.55); border: 1px solid rgba(8,39,28,0.12); border-radius: 6px; }
    .app-note strong { display: block; margin-bottom: 0.25rem; font-size: 0.76rem; }
    .app-note span { display: block; color: rgba(8,39,28,0.68); font-size: 0.67rem; line-height: 1.45; }
    .copy-status { min-height: 1.4em; margin: 0.55rem 0 0; color: rgba(8,39,28,0.72); font-size: 0.68rem; }

    .trust { display: grid; grid-template-columns: minmax(0, 0.75fr) minmax(440px, 1.25fr); gap: clamp(3rem, 8vw, 8rem); align-items: start; }
    .trust__copy .eyebrow { color: var(--muted); }
    .trust__copy h2 { max-width: 9ch; }
    .trust__copy > p:last-child { max-width: 470px; margin: 1.4rem 0 0; color: var(--muted); }
    .trust-list { margin: 0; padding: 0; border-top: 1px solid var(--line); list-style: none; }
    .trust-list li { display: grid; grid-template-columns: 52px 1fr; gap: 1.25rem; padding: 1.6rem 0; border-bottom: 1px solid var(--line); }
    .trust-list__icon { width: 44px; height: 44px; display: grid; place-items: center; color: var(--green-deep); background: var(--green-soft); border-radius: 50%; font-size: 0.72rem; font-weight: 900; }
    .trust-list h3 { margin: 0 0 0.35rem; font-family: var(--serif); font-size: 1.4rem; font-weight: 600; }
    .trust-list p { margin: 0; color: var(--muted); font-size: 0.84rem; }

    .faq { padding-top: 0; }
    .faq-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0 4rem; border-top: 1px solid var(--line); }
    details { border-bottom: 1px solid var(--line); }
    summary { position: relative; padding: 1.4rem 2rem 1.4rem 0; cursor: pointer; font-family: var(--serif); font-size: 1.15rem; font-weight: 600; list-style: none; }
    summary::-webkit-details-marker { display: none; }
    summary::after { content: "+"; position: absolute; right: 0; top: 1.3rem; color: var(--green); font-family: var(--sans); font-size: 1.3rem; font-weight: 400; }
    details[open] summary::after { content: "−"; }
    details p { max-width: 570px; margin: -0.4rem 0 1.5rem; color: var(--muted); font-size: 0.84rem; }

    .footer { color: rgba(255,253,246,0.65); background: var(--green-deep); }
    .footer__inner { display: grid; grid-template-columns: 1fr auto; gap: 3rem; align-items: end; padding-block: 3.5rem; }
    .footer .brand { margin-bottom: 1.2rem; }
    .footer p { max-width: 430px; margin: 0; font-size: 0.76rem; }
    .footer__links { display: flex; flex-wrap: wrap; gap: 1.25rem; justify-content: flex-end; font-size: 0.74rem; font-weight: 700; }
    .footer__links a:hover { color: var(--ball); }

    @media (max-width: 960px) {
      .hero__grid { grid-template-columns: 1fr; }
      .hero__copy { max-width: 760px; }
      h1 { max-width: 9ch; }
      .season-board-wrap { width: min(100%, 600px); }
      .slam-grid { grid-template-columns: repeat(2, 1fr); }
      .subscribe-panel, .trust { grid-template-columns: 1fr; }
      .subscribe-panel h2, .trust__copy h2 { max-width: 13ch; }
    }

    @media (max-width: 700px) {
      .shell { width: min(100% - 1.5rem, 1180px); }
      .nav { min-height: 72px; }
      .nav__status { max-width: 12rem; justify-content: flex-end; text-align: right; line-height: 1.25; }
      .hero__grid { gap: 4.5rem; padding-block: 4rem 5rem; }
      h1 { font-size: clamp(3.55rem, 17vw, 5rem); }
      .hero__actions { align-items: stretch; flex-direction: column; }
      .button { width: 100%; }
      .season-board { transform: none; }
      .season-board-wrap::before { width: 90px; height: 90px; right: -18px; top: -28px; }
      .season-row { grid-template-columns: 38px 1fr; padding-inline: 1rem; }
      .season-row time { grid-column: 2; }
      .section-heading { grid-template-columns: 1fr; gap: 1.2rem; }
      .slam-grid, .steps, .faq-grid { grid-template-columns: 1fr; }
      .slam-card { min-height: 320px; }
      .step { min-height: auto; }
      .step__number { margin-bottom: 2.5rem; }
      .subscribe-panel { padding: 2rem 1rem; }
      .feed-field { flex-direction: column; }
      .feed-url { min-height: 45px; padding-inline: 0.4rem; }
      .copy-button { width: 100%; }
      .app-notes { grid-template-columns: 1fr; }
      .trust-list li { grid-template-columns: 44px 1fr; gap: 0.9rem; }
      .footer__inner { grid-template-columns: 1fr; }
      .footer__links { justify-content: flex-start; }
    }

    @media (max-width: 430px) {
      .brand { font-size: 0.72rem; letter-spacing: 0.06em; }
      .nav__status-long { display: none; }
      .nav__status-short { display: inline; }
    }

    @media (prefers-reduced-motion: reduce) {
      html { scroll-behavior: auto; }
      *, *::before, *::after { scroll-behavior: auto !important; transition-duration: 0.01ms !important; }
    }
  </style>
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>

  <header class="hero">
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
        <h1>Every Grand Slam. <em>One calendar.</em></h1>
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
        <div class="subscribe-panel__tools">
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
  </main>

  <footer class="footer">
    <div class="footer__inner shell">
      <div>
        <a class="brand" href="/"><span class="brand__ball" aria-hidden="true"></span><span>Grand Slam Calendar</span></a>
        <p>A free public calendar for the four tennis majors. No login, no newsletter, no lurking in the baseline.</p>
      </div>
      <nav class="footer__links" aria-label="Footer navigation"><a href="${safeHttpsFeedUrl}">Raw .ics feed</a><a href="/health">Feed status</a><a href="#main">Back to top</a></nav>
    </div>
  </footer>

  <script>
    (() => {
      const button = document.querySelector(".copy-button");
      const status = document.querySelector(".copy-status");
      const field = document.querySelector(".feed-url");
      if (!(button instanceof HTMLButtonElement) || !(status instanceof HTMLElement) || !(field instanceof HTMLInputElement)) return;

      field.addEventListener("focus", () => field.select());
      field.addEventListener("click", () => field.select());

      button.addEventListener("click", async () => {
        const url = button.dataset.copyUrl;
        if (!url) return;
        try {
          await navigator.clipboard.writeText(url);
          button.querySelector("span").textContent = "Copied";
          status.textContent = "Calendar URL copied. Paste it into your calendar app.";
          window.setTimeout(() => { button.querySelector("span").textContent = "Copy URL"; }, 2200);
        } catch {
          status.textContent = "Copy was blocked. Select the URL above and copy it manually.";
          field.focus();
          field.select();
        }
      });
    })();
  </script>
</body>
</html>`;
}
