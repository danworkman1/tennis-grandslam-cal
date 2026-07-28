import { Hono, type Context } from "hono";
import { renderHomePage } from "./home.js";
import { buildFaviconSvg } from "./icon.js";
import { buildICS } from "./ics.js";
import { findPost, renderBlogIndex, renderBlogPost, sortedPosts } from "./blog.js";
import { renderNotFoundPage } from "./layout.js";
import { buildRobotsTxt, buildSitemap } from "./seo.js";
import { SEED, type SlamEvent } from "./seed.js";
import { refresh, type Env } from "./refresh.js";

const app = new Hono<{ Bindings: Env }>();

const REFRESH_INTERVAL_MS = 7 * 86_400_000; // weekly cron

function isServingStale(lastSuccess: string | null, failCount: number): boolean {
  const lastSuccessMs = lastSuccess ? Date.parse(lastSuccess) : NaN;
  return (
    failCount > 0 ||
    !Number.isFinite(failCount) ||
    !Number.isFinite(lastSuccessMs) ||
    Date.now() - lastSuccessMs > 2 * REFRESH_INTERVAL_MS
  );
}

// The configured branded origin, or null when PUBLIC_ORIGIN is unset or malformed.
// Split out from resolvePublicOrigin so callers can tell "nothing configured" apart
// from "configured, and it happens to match this request".
function configuredOrigin(env: Env): URL | null {
  if (!env.PUBLIC_ORIGIN) return null;
  try {
    const configured = new URL(env.PUBLIC_ORIGIN);
    if (configured.protocol !== "https:" && configured.protocol !== "http:") return null;
    return configured;
  } catch {
    // Ignore a malformed optional origin instead of breaking the response.
    return null;
  }
}

// The branded host for public URLs: PUBLIC_ORIGIN when set (so links resolve to the
// custom domain even from the legacy workers.dev origin), else the request's own host.
function resolvePublicOrigin(c: Context<{ Bindings: Env }>): string {
  const requestUrl = new URL(c.req.url);
  return configuredOrigin(c.env)?.origin ?? `${requestUrl.protocol}//${requestUrl.host}`;
}

/**
 * True when the request arrived on a host other than the branded one — in practice
 * the legacy workers.dev origin.
 *
 * That host serves byte-identical HTML, so the same page exists on two URLs. The
 * duplicate cannot be removed: `workers_dev` must stay enabled because existing
 * calendar apps poll the URL they originally saved and there is no subscriber
 * registry that can rewrite it (see README). The canonical tag already points at the
 * branded host, but canonical is a hint, not a directive — this is the directive.
 */
function isNonCanonicalHost(c: Context<{ Bindings: Env }>): boolean {
  const configured = configuredOrigin(c.env);
  return configured !== null && new URL(c.req.url).host !== configured.host;
}

/**
 * Security headers shared by every HTML response.
 *
 * Takes the context so this stays the one place HTML-only headers are decided —
 * the legacy-origin `X-Robots-Tag: noindex` belongs here too once that lands, and
 * it must cover the blog routes, not just the homepage.
 */
function sharedHtmlHeaders(c: Context<{ Bindings: Env }>): Record<string, string> {
  return {
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    // HTML only. The feed and /health must stay indexable-agnostic: /slams.ics is
    // what subscribers poll on the legacy host and noindex there would be noise.
    ...(isNonCanonicalHost(c) ? { "X-Robots-Tag": "noindex" } : {}),
  };
}

app.get("/slams.ics", async (c) => {
  let ics = await c.env.SLAMS.get("feed:ics");
  if (!ics) ics = await buildICS(SEED, c.env.SLAMS); // cold-start: render bundled seed
  return c.body(ics, 200, {
    "Content-Type": "text/calendar; charset=utf-8",
    "Cache-Control": "public, max-age=3600",
  });
});

app.get("/health", async (c) => {
  const lastSuccess = await c.env.SLAMS.get("meta:last_success");
  const failCount = parseInt((await c.env.SLAMS.get("meta:fail_count")) ?? "0", 10);
  const lastErrorRaw = await c.env.SLAMS.get("meta:last_error");
  const servingStale = isServingStale(lastSuccess, failCount);
  return c.json({
    last_success: lastSuccess,
    fail_count: failCount,
    last_error: lastErrorRaw ? JSON.parse(lastErrorRaw) : null,
    serving_stale: servingStale,
  });
});

// Manual refresh kick — same code path as the weekly cron. Guarded by a secret
// so it can't be abused to hammer Wikipedia. Set REFRESH_TOKEN as a secret.
app.get("/admin/refresh", async (c) => {
  const token = c.env.REFRESH_TOKEN;
  if (!token || c.req.query("key") !== token) return c.text("forbidden", 403);
  await refresh(c.env);
  const failCount = parseInt((await c.env.SLAMS.get("meta:fail_count")) ?? "0", 10);
  return c.json({ refreshed: true, fail_count: failCount });
});

app.get("/robots.txt", (c) => {
  return c.body(buildRobotsTxt(resolvePublicOrigin(c)), 200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "public, max-age=86400",
  });
});

app.get("/sitemap.xml", (c) => {
  // Every indexable HTML URL. Posts carry a hand-edited lastmod; the homepage and
  // the blog index deliberately do not — see SitemapEntry.
  const entries = [
    { path: "/" },
    { path: "/blog" },
    ...sortedPosts().map((post) => ({
      path: `/blog/${post.slug}`,
      lastmod: post.updated ?? post.published,
    })),
  ];
  return c.body(buildSitemap(resolvePublicOrigin(c), entries), 200, {
    "Content-Type": "application/xml; charset=utf-8",
    "Cache-Control": "public, max-age=86400",
  });
});

app.get("/favicon.svg", (c) => {
  return c.body(buildFaviconSvg(), 200, {
    "Content-Type": "image/svg+xml; charset=utf-8",
    "Cache-Control": "public, max-age=86400",
  });
});

// "/blog/" matches neither route below, so it would otherwise 404 on a trailing
// slash a reader is quite likely to type.
app.get("/blog/", (c) => c.redirect("/blog", 301));

app.get("/blog", (c) => {
  return c.html(renderBlogIndex(resolvePublicOrigin(c)), 200, {
    "Cache-Control": "public, max-age=900",
    ...sharedHtmlHeaders(c),
  });
});

app.get("/blog/:slug", (c) => {
  const post = findPost(c.req.param("slug"));
  if (!post) return c.notFound(); // delegates to the app-level handler below
  return c.html(renderBlogPost(resolvePublicOrigin(c), post), 200, {
    "Cache-Control": "public, max-age=3600",
    ...sharedHtmlHeaders(c),
  });
});

app.get("/", async (c) => {
  let eventsRaw: string | null = null;
  let lastSuccess: string | null = null;
  let failCountRaw: string | null = null;
  try {
    [eventsRaw, lastSuccess, failCountRaw] = await Promise.all([
      c.env.SLAMS.get("feed:events"),
      c.env.SLAMS.get("meta:last_success"),
      c.env.SLAMS.get("meta:fail_count"),
    ]);
  } catch {
    // The public page can still render its bundled season if KV is unavailable.
  }

  let events: SlamEvent[] = SEED;
  if (eventsRaw) {
    try {
      const parsed = JSON.parse(eventsRaw) as SlamEvent[];
      if (Array.isArray(parsed) && parsed.length > 0) events = parsed;
    } catch {
      // A malformed preview must never stop the landing page using bundled dates.
    }
  }

  const failCount = parseInt(failCountRaw ?? "0", 10);
  return c.html(
    renderHomePage(resolvePublicOrigin(c), events, {
      lastSuccess,
      failCount,
      servingStale: isServingStale(lastSuccess, failCount),
    }),
    200,
    {
      "Cache-Control": "public, max-age=300",
      ...sharedHtmlHeaders(c),
    },
  );
});

// One app-level handler covers unknown paths and unknown post slugs alike.
// max-age is short on purpose: a URL that later becomes a real post must not stay
// cached as missing.
app.notFound((c) => {
  return c.html(renderNotFoundPage(resolvePublicOrigin(c)), 404, {
    "Cache-Control": "public, max-age=300",
    ...sharedHtmlHeaders(c),
  });
});

export default {
  fetch: app.fetch,
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(refresh(env));
  },
};
