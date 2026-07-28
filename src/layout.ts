// The chrome every page on the site shares: the document shell, the head, the
// stylesheet and the footer. Page modules supply only their own <head> values and
// their own body content.
//
// Extracted from home.ts as a pure move — the rendered homepage is byte-for-byte
// what it was before, and test/layout.test.ts pins that.

export type HeadOptions = {
  title: string;
  description: string;
  /** Absolute, already-escaped. Used for both <link rel=canonical> and og:url. */
  canonicalUrl: string;
  ogTitle: string;
  ogDescription: string;
  /** Serialised JSON-LD, already `<`-escaped for embedding in a <script>. */
  structuredData: string;
  ogType?: string;
};

export type PageOptions = {
  head: HeadOptions;
  /** Everything between the skip link and the footer. */
  content: string;
  /** Already-escaped HTTPS feed URL, for the footer's raw-feed link. */
  feedUrl: string;
  /** Optional page-specific <script> block. */
  scripts?: string;
};

function renderHead(head: HeadOptions): string {
  return `  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${head.title}</title>
  <meta name="description" content="${head.description}">
  <meta name="theme-color" content="#123c2b">
  <meta name="color-scheme" content="light">
  <link rel="canonical" href="${head.canonicalUrl}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <meta property="og:type" content="${head.ogType ?? "website"}">
  <meta property="og:title" content="${head.ogTitle}">
  <meta property="og:description" content="${head.ogDescription}">
  <meta property="og:url" content="${head.canonicalUrl}">
  <meta name="twitter:card" content="summary">
  <script type="application/ld+json">${head.structuredData}</script>`;
}

export function renderFooter(feedUrl: string): string {
  return `  <footer class="footer">
    <div class="footer__inner shell">
      <div>
        <a class="brand" href="/"><span class="brand__ball" aria-hidden="true"></span><span>Grand Slam Calendar</span></a>
        <p>A free public calendar for the four tennis majors. No login, no newsletter, no lurking in the baseline.</p>
        <p class="footer__credit">Built by <a href="https://danielworkman.dev">Daniel Workman</a></p>
        <div class="footer__support">
          <a class="bmc-button" href="https://buymeacoffee.com/dworkman" target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M5 8h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8Z"/>
              <path d="M16 9h1.75a2.25 2.25 0 0 1 0 4.5H16"/>
              <path d="M8.5 2.4c-.6.85-.6 1.75 0 2.6"/>
              <path d="M12.5 2.4c-.6.85-.6 1.75 0 2.6"/>
            </svg>
            <span>Buy me a coffee</span>
          </a>
        </div>
      </div>
      <nav class="footer__links" aria-label="Footer navigation"><a href="${feedUrl}">Raw .ics feed</a><a href="/health">Feed status</a><a href="#main">Back to top</a></nav>
    </div>
  </footer>`;
}

export function renderPage({ head, content, feedUrl, scripts }: PageOptions): string {
  // A page with no scripts collapses to a single blank line before </body> rather
  // than leaving two; the homepage has scripts, so its bytes are unaffected.
  const scriptBlock = scripts ? `\n${scripts}\n` : "";

  return `<!doctype html>
<html lang="en">
<head>
${renderHead(head)}
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
    .footer .footer__credit { margin-top: 0.9rem; }
    .footer__credit a { font-weight: 700; }
    .footer__credit a:hover { color: var(--ball); }
    .footer__support { margin-top: 1.15rem; }
    .bmc-button {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.55rem 1.05rem;
      color: #0d0c22;
      background: #ffdd00;
      border: 1px solid #0d0c22;
      border-radius: 999px;
      font-size: 0.78rem;
      font-weight: 800;
      text-decoration: none;
      transition: transform 180ms ease, box-shadow 180ms ease;
    }
    .bmc-button:hover { color: #0d0c22; transform: translateY(-2px); box-shadow: 0 12px 26px rgba(13, 12, 34, 0.35); }
    .bmc-button svg { width: 16px; height: 16px; }

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

${content}

${renderFooter(feedUrl)}
${scriptBlock}</body>
</html>`;
}
