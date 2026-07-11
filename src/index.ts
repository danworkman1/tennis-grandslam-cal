import { Hono } from "hono";
import { renderHomePage } from "./home.js";
import { buildICS } from "./ics.js";
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

  const requestUrl = new URL(c.req.url);
  const requestOrigin = `${requestUrl.protocol}//${requestUrl.host}`;
  let publicOrigin = requestOrigin;
  if (c.env.PUBLIC_ORIGIN) {
    try {
      const configuredOrigin = new URL(c.env.PUBLIC_ORIGIN);
      if (configuredOrigin.protocol === "https:" || configuredOrigin.protocol === "http:") {
        publicOrigin = configuredOrigin.origin;
      }
    } catch {
      // Ignore a malformed optional origin instead of breaking the homepage.
    }
  }
  const failCount = parseInt(failCountRaw ?? "0", 10);
  return c.html(
    renderHomePage(publicOrigin, events, {
      lastSuccess,
      failCount,
      servingStale: isServingStale(lastSuccess, failCount),
    }),
    200,
    {
      "Cache-Control": "public, max-age=300",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Content-Type-Options": "nosniff",
    },
  );
});

export default {
  fetch: app.fetch,
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(refresh(env));
  },
};
