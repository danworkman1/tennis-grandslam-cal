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

export function buildSitemap(origin: string): string {
  const base = escapeXml(origin.replace(/\/+$/, ""));
  // A single-page site: the homepage is the only indexable URL. The feed
  // (/slams.ics) and /health are not HTML documents and are intentionally omitted.
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${base}/</loc>
    <changefreq>weekly</changefreq>
  </url>
</urlset>
`;
}
