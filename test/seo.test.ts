import { describe, expect, it } from "vitest";
import { buildRobotsTxt, buildSitemap } from "../src/seo.js";

describe("buildRobotsTxt", () => {
  it("allows crawling and points at the sitemap on the given origin", () => {
    const txt = buildRobotsTxt("https://grandslamcalendar.com");

    expect(txt).toContain("User-agent: *");
    expect(txt).toContain("Allow: /");
    expect(txt).toContain("Sitemap: https://grandslamcalendar.com/sitemap.xml");
  });

  it("keeps the token-guarded admin path out of the index", () => {
    expect(buildRobotsTxt("https://grandslamcalendar.com")).toContain("Disallow: /admin/");
  });

  it("does not double up the slash when the origin has a trailing slash", () => {
    expect(buildRobotsTxt("https://grandslamcalendar.com/")).toContain(
      "Sitemap: https://grandslamcalendar.com/sitemap.xml",
    );
  });
});

describe("buildSitemap", () => {
  it("defaults to a valid single-URL urlset for the homepage", () => {
    const xml = buildSitemap("https://grandslamcalendar.com");

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain("<loc>https://grandslamcalendar.com/</loc>");
    // Scoped to the default argument: this pins the no-entries case, not the
    // site's page count. Passing entries is expected to produce more <url>s.
    expect((xml.match(/<url>/g) ?? []).length).toBe(1);
  });

  it("escapes the origin before embedding it in XML", () => {
    const xml = buildSitemap('https://example.com/"&<');

    expect(xml).not.toContain('"&<');
    expect(xml).toContain("&quot;&amp;&lt;");
  });

  it("enumerates every entry it is given", () => {
    const xml = buildSitemap("https://grandslamcalendar.com", [
      { path: "/" },
      { path: "/blog" },
      { path: "/blog/when-is-wimbledon" },
    ]);

    expect(xml).toContain("<loc>https://grandslamcalendar.com/</loc>");
    expect(xml).toContain("<loc>https://grandslamcalendar.com/blog</loc>");
    expect(xml).toContain("<loc>https://grandslamcalendar.com/blog/when-is-wimbledon</loc>");
    expect((xml.match(/<url>/g) ?? []).length).toBe(3);
  });

  it("emits lastmod only for entries that declare one", () => {
    const xml = buildSitemap("https://grandslamcalendar.com", [
      { path: "/" },
      { path: "/blog/a-post", lastmod: "2026-07-28" },
    ]);

    expect((xml.match(/<lastmod>/g) ?? []).length).toBe(1);
    expect(xml).toContain("<lastmod>2026-07-28</lastmod>");
  });

  it("omits changefreq, which Google documents that it ignores", () => {
    expect(buildSitemap("https://grandslamcalendar.com")).not.toContain("changefreq");
  });

  it("escapes the path as well as the origin", () => {
    const xml = buildSitemap("https://grandslamcalendar.com", [{ path: "/blog/a&b" }]);

    expect(xml).toContain("<loc>https://grandslamcalendar.com/blog/a&amp;b</loc>");
  });

  it("tolerates an entry path that is missing its leading slash", () => {
    const xml = buildSitemap("https://grandslamcalendar.com", [{ path: "blog" }]);

    expect(xml).toContain("<loc>https://grandslamcalendar.com/blog</loc>");
  });
});
