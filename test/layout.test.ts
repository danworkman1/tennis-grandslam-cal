import { describe, expect, it } from "vitest";
import { renderPage, renderFooter } from "../src/layout.js";

const HEAD = {
  title: "A title",
  description: "A description",
  canonicalUrl: "https://grandslamcalendar.com/somewhere",
  ogTitle: "An og title",
  ogDescription: "An og description",
  structuredData: '{"@context":"https://schema.org"}',
};

const page = (overrides: Partial<Parameters<typeof renderPage>[0]> = {}) =>
  renderPage({
    head: HEAD,
    content: "  <main id=\"main\">hello</main>",
    feedUrl: "https://grandslamcalendar.com/slams.ics",
    ...overrides,
  });

describe("renderPage", () => {
  it("emits a complete document shell", () => {
    const html = page();

    expect(html.startsWith("<!doctype html>\n<html lang=\"en\">\n<head>\n")).toBe(true);
    expect(html.endsWith("</body>\n</html>")).toBe(true);
  });

  it("puts the skip link first in the body, ahead of page content", () => {
    const html = page();

    expect(html.indexOf('class="skip-link"')).toBeLessThan(html.indexOf("hello"));
  });

  it("carries the shared footer, including the support and attribution links", () => {
    const html = page();

    expect(html).toContain("https://buymeacoffee.com/dworkman");
    expect(html).toContain("https://danielworkman.dev");
    expect(html).toContain('<a href="https://grandslamcalendar.com/slams.ics">Raw .ics feed</a>');
  });

  it("places page scripts after the footer and before </body>", () => {
    const html = page({ scripts: "  <script>void 0;</script>" });

    expect(html.indexOf("<footer")).toBeLessThan(html.indexOf("void 0;"));
    expect(html.indexOf("void 0;")).toBeLessThan(html.indexOf("</body>"));
  });

  it("does not leave a stray script gap when a page has no scripts", () => {
    // A blog page has no copy-button script; it should not inherit blank lines.
    expect(page()).not.toContain("\n\n\n</body>");
  });
});

describe("renderPage head", () => {
  it("uses the canonical URL for both the canonical link and og:url", () => {
    const html = page();

    expect(html).toContain('<link rel="canonical" href="https://grandslamcalendar.com/somewhere">');
    expect(html).toContain(
      '<meta property="og:url" content="https://grandslamcalendar.com/somewhere">',
    );
  });

  it("renders the per-page title, description and JSON-LD", () => {
    const html = page();

    expect(html).toContain("<title>A title</title>");
    expect(html).toContain('<meta name="description" content="A description">');
    expect(html).toContain(
      '<script type="application/ld+json">{"@context":"https://schema.org"}</script>',
    );
  });

  it("defaults og:type to website but lets a page override it", () => {
    expect(page()).toContain('<meta property="og:type" content="website">');
    expect(page({ head: { ...HEAD, ogType: "article" } })).toContain(
      '<meta property="og:type" content="article">',
    );
  });

  it("ships the stylesheet with the document", () => {
    const html = page();

    expect(html).toContain("<style>");
    expect(html).toContain("--paper: #f4f0e4;");
  });
});

describe("renderFooter", () => {
  it("links the feed URL it is given", () => {
    expect(renderFooter("https://example.com/slams.ics")).toContain(
      'href="https://example.com/slams.ics"',
    );
  });
});
