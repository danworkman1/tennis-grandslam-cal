// Crawler-facing helpers. Pure string builders so they can be unit-tested without
// the router; both take the resolved public origin (see resolvePublicOrigin in index.ts)
// so the emitted URLs match the branded host regardless of which host served the request.

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildRobotsTxt(origin: string): string {
  const base = origin.replace(/\/+$/, "");
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin/", // token-guarded refresh endpoint; nothing to index
    `Sitemap: ${base}/sitemap.xml`,
    "",
  ].join("\n");
}

export type SitemapEntry = {
  /** Root-relative, leading slash included: "/", "/blog", "/blog/some-post". */
  path: string;
  /**
   * "YYYY-MM-DD", hand-edited when the page's content actually changes.
   *
   * Deliberately omitted for the homepage. The two automatic sources both lie:
   * `meta:last_success` is written on every successful cron with no content
   * comparison, so it would bump ~52 times a year on a page that never changed,
   * and a build-time constant bumps on deploys that touch only the refresh path
   * and change no rendered byte. Google only uses lastmod when it is consistently
   * accurate, so a wrong one is worse than none.
   */
  lastmod?: string;
};

export function buildSitemap(
  origin: string,
  entries: SitemapEntry[] = [{ path: "/" }],
): string {
  const base = escapeXml(origin.replace(/\/+$/, ""));
  // The feed (/slams.ics) and /health are not HTML documents and are intentionally
  // omitted; /admin/ is disallowed in robots.txt.
  const urls = entries
    .map(({ path, lastmod }) => {
      const loc = `${base}${escapeXml(path.startsWith("/") ? path : `/${path}`)}`;
      const lastmodLine = lastmod ? `\n    <lastmod>${escapeXml(lastmod)}</lastmod>` : "";
      return `  <url>\n    <loc>${loc}</loc>${lastmodLine}\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}
