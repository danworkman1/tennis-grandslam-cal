import { Hono } from "hono";
import { buildICS } from "./ics.js";
import { SEED } from "./seed.js";
import { refresh, type Env } from "./refresh.js";

const app = new Hono<{ Bindings: Env }>();

const REFRESH_INTERVAL_MS = 7 * 86_400_000; // weekly cron

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
  const servingStale =
    failCount > 0 ||
    !lastSuccess ||
    Date.now() - Date.parse(lastSuccess) > 2 * REFRESH_INTERVAL_MS;
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

app.get("/", (c) => {
  const host = c.req.header("host") ?? "tennis-slams-ics.workers.dev";
  return c.html(`<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tennis Grand Slams calendar</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:38rem;margin:4rem auto;padding:0 1rem;line-height:1.5;color:#1a1a1a}
  code{background:#f2f2f2;padding:.15rem .35rem;border-radius:.25rem;word-break:break-all}
  a.btn{display:inline-block;margin:.5rem 0 1rem;padding:.6rem 1rem;background:#2e7d32;color:#fff;text-decoration:none;border-radius:.4rem}
</style></head>
<body>
  <h1>🎾 Tennis Grand Slams</h1>
  <p>A subscribable calendar of the four Grand Slams — Australian Open, Roland-Garros, Wimbledon, and the US Open. Subscribe once; it stays current on its own.</p>
  <p><a class="btn" href="webcal://${host}/slams.ics">Subscribe</a></p>
  <p>Or add this URL manually in your calendar app:<br><code>webcal://${host}/slams.ics</code></p>
  <p style="color:#666;font-size:.9rem"><a href="/health">status</a></p>
</body></html>`);
});

export default {
  fetch: app.fetch,
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(refresh(env));
  },
};
