import { escapeHtml } from "./html.js";
import { COPY_SCRIPT, renderPage, renderSiteNav, renderSubscribeCta } from "./layout.js";

/**
 * Posts live as plain TS modules in the POSTS array below.
 *
 * This is deliberately the least machinery that works. There is no markdown
 * pipeline and no KV-backed content, because both cost more than they return at
 * the volume this site will realistically reach. `body` is a function rather than
 * a string so a post can inline the subscribe CTA at the point in the copy where
 * the reader is meant to act, with the URLs already resolved for the host serving
 * the request.
 *
 * Promotion path: at around five posts, the ergonomics flip and this should become
 * markdown pre-rendered to HTML at build time. The BlogPost shape is the seam —
 * swap how `body` is produced and nothing else here has to change.
 */
export type PostContext = {
  httpsFeedUrl: string;
  webcalFeedUrl: string;
};

export type BlogPost = {
  slug: string;
  title: string;
  /** Meta description. Written for the SERP, not as a summary of the page. */
  description: string;
  /** Shown under the H1. */
  lede: string;
  /** "YYYY-MM-DD". Hand-edited; also feeds the sitemap's lastmod. */
  published: string;
  updated?: string;
  body: (ctx: PostContext) => string;
};

const SUBSCRIBE_POST: BlogPost = {
  slug: "add-tennis-grand-slams-to-your-calendar",
  title: "How to add the tennis Grand Slams to your calendar",
  description:
    "Subscribe to the Australian Open, Roland-Garros, Wimbledon and US Open in Apple Calendar, Google Calendar or Outlook. One URL, no account, updates itself.",
  lede: "One subscription URL, three apps, about a minute. The dates then keep themselves current, including when a tournament moves.",
  published: "2026-07-28",
  body: ({ httpsFeedUrl, webcalFeedUrl }) => `        <p>Most people add tennis dates to their calendar by typing them in once. That works right up until a tournament shifts and nobody tells you. A calendar <em>subscription</em> avoids that: your app stores a URL, checks it on its own schedule and applies changes when they happen.</p>

        <p>Here's how to set that up for the four majors. Everything below uses the one address.</p>

        <h2>The address you need</h2>

        <p>Copy this. It's the same URL for every app and every device and it doesn't change as dates update.</p>

${renderSubscribeCta({
  httpsFeedUrl,
  webcalFeedUrl,
  heading: "The subscription URL",
  blurb: "Paste this wherever your calendar asks for a URL. Nothing to sign up for.",
})}

        <h2>Apple Calendar (iPhone, iPad, Mac)</h2>

        <p>On iPhone or iPad, open <strong>Settings</strong> → <strong>Apps</strong> → <strong>Calendar</strong> → <strong>Calendar Accounts</strong> → <strong>Add Account</strong> → <strong>Other</strong>, then choose <strong>Add Subscribed Calendar</strong> and paste the URL.</p>

        <p>On a Mac, open Calendar and choose <strong>File</strong> → <strong>New Calendar Subscription</strong>, then paste the URL. Set <em>Auto-refresh</em> to daily or weekly. Anything more frequent is wasted, since the source only gets checked once a week.</p>

        <p>If you're reading this on the device you want the calendar on, <a href="${webcalFeedUrl}">this link opens Apple Calendar directly</a> and skips the menus.</p>

        <h2>Google Calendar</h2>

        <p>Google Calendar can only add a subscription on the web. The mobile apps can't do it. That's the single most common reason people give up on this.</p>

        <p>Go to <a href="https://calendar.google.com" rel="noopener">calendar.google.com</a>, open <strong>Settings</strong>, choose <strong>Add calendar</strong> → <strong>From URL</strong>, paste the address and confirm. It then syncs down to the phone app on its own.</p>

        <p>Google refreshes external calendars on its own schedule and it isn't quick. Expect up to 24 hours for a change to show. That's Google's behaviour for every subscribed calendar, not something this feed controls.</p>

        <h2>Outlook</h2>

        <p>In Outlook on the web, open <strong>Calendar</strong>, choose <strong>Add calendar</strong> → <strong>Subscribe from web</strong>, paste the URL, give it a name and save.</p>

        <p>Desktop Outlook picks the subscription up once it syncs with the same account.</p>

        <h2>What you actually get</h2>

        <ul>
          <li>Four all-day events a year, one per major, spanning the full main draw.</li>
          <li>No match times, no draws, no scores. This is for planning a season, not following a tournament.</li>
          <li>No account, no signup, no access to anything of yours. Your app reads the same public file as everyone else.</li>
        </ul>

        <p>If a tournament's published dates move, the feed picks the change up on its weekly check and your calendar applies it whenever it next refreshes. Nothing to do at your end!</p>

        <h2>Removing it</h2>

        <p>Delete or unsubscribe from the calendar in whichever app you added it to. It's a separate calendar, so removing it leaves everything else untouched.</p>

${renderSubscribeCta({
  httpsFeedUrl,
  webcalFeedUrl,
  heading: "Ready when you are",
  blurb: "Same URL as above. Grab it and you're set for the season.",
})}`,
};

export const POSTS: BlogPost[] = [SUBSCRIBE_POST];

export function findPost(slug: string): BlogPost | undefined {
  return POSTS.find((post) => post.slug === slug);
}

/** Newest first. */
export function sortedPosts(): BlogPost[] {
  return [...POSTS].sort((a, b) => b.published.localeCompare(a.published));
}

function feedUrls(origin: string): PostContext & { baseUrl: string } {
  const baseUrl = origin.replace(/\/+$/, "");
  const httpsFeedUrl = `${baseUrl}/slams.ics`;
  return {
    baseUrl,
    httpsFeedUrl: escapeHtml(httpsFeedUrl),
    webcalFeedUrl: escapeHtml(httpsFeedUrl.replace(/^https?:\/\//i, "webcal://")),
  };
}

function longDate(iso: string): string {
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

export function renderBlogPost(origin: string, post: BlogPost): string {
  const { baseUrl, httpsFeedUrl, webcalFeedUrl } = feedUrls(origin);
  const canonicalUrl = escapeHtml(`${baseUrl}/blog/${post.slug}`);
  const dateShown = post.updated ?? post.published;

  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    url: `${baseUrl}/blog/${post.slug}`,
    datePublished: post.published,
    ...(post.updated ? { dateModified: post.updated } : {}),
    author: { "@type": "Person", name: "Daniel Workman", url: "https://danielworkman.dev" },
  }).replace(/</g, "\\u003c");

  return renderPage({
    head: {
      title: `${escapeHtml(post.title)} — Grand Slam Calendar`,
      description: escapeHtml(post.description),
      canonicalUrl,
      ogTitle: escapeHtml(post.title),
      ogDescription: escapeHtml(post.description),
      ogType: "article",
      structuredData,
    },
    feedUrl: httpsFeedUrl,
    scripts: COPY_SCRIPT,
    content: `  <header class="page-head">
${renderSiteNav()}
    <div class="page-head__inner shell">
      <h1>${escapeHtml(post.title)}</h1>
      <p class="page-head__lede">${escapeHtml(post.lede)}</p>
      <p class="page-head__meta"><time datetime="${escapeHtml(dateShown)}">${escapeHtml(longDate(dateShown))}</time></p>
    </div>
  </header>

  <main id="main">
    <section class="section shell">
      <div class="prose">
${post.body({ httpsFeedUrl, webcalFeedUrl })}
      </div>
    </section>
  </main>`,
  });
}

export function renderBlogIndex(origin: string): string {
  const { baseUrl, httpsFeedUrl } = feedUrls(origin);
  const canonicalUrl = escapeHtml(`${baseUrl}/blog`);
  const posts = sortedPosts();

  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Grand Slam Calendar",
    url: `${baseUrl}/blog`,
  }).replace(/</g, "\\u003c");

  const items = posts
    .map(
      (post) => `        <li>
          <a href="/blog/${escapeHtml(post.slug)}">
            <h2>${escapeHtml(post.title)}</h2>
            <p>${escapeHtml(post.description)}</p>
            <time datetime="${escapeHtml(post.published)}">${escapeHtml(longDate(post.published))}</time>
          </a>
        </li>`,
    )
    .join("\n");

  return renderPage({
    head: {
      title: "Guides — Grand Slam Calendar",
      description:
        "Short, practical guides to getting the tennis majors into whichever calendar app you already use.",
      canonicalUrl,
      ogTitle: "Guides — Grand Slam Calendar",
      ogDescription:
        "Short, practical guides to getting the tennis majors into whichever calendar app you already use.",
      structuredData,
    },
    feedUrl: httpsFeedUrl,
    content: `  <header class="page-head">
${renderSiteNav()}
    <div class="page-head__inner shell">
      <h1>Guides</h1>
      <p class="page-head__lede">Short and practical. Mostly about getting the majors into whichever calendar app you already use.</p>
    </div>
  </header>

  <main id="main">
    <section class="section shell">
      <ul class="post-list">
${items}
      </ul>
    </section>
  </main>`,
  });
}
