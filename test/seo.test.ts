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
  it("is a valid single-URL urlset for the homepage", () => {
    const xml = buildSitemap("https://grandslamcalendar.com");

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain("<loc>https://grandslamcalendar.com/</loc>");
    expect((xml.match(/<url>/g) ?? []).length).toBe(1);
  });

  it("escapes the origin before embedding it in XML", () => {
    const xml = buildSitemap('https://example.com/"&<');

    expect(xml).not.toContain('"&<');
    expect(xml).toContain("&quot;&amp;&lt;");
  });
});
