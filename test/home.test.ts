import { describe, expect, it } from "vitest";
import { renderHomePage } from "../src/home.js";

describe("renderHomePage", () => {
  it("uses the active origin for subscribe and copy URLs", () => {
    const html = renderHomePage("https://calendar.example.com");

    expect(html).toContain('href="webcal://calendar.example.com/slams.ics"');
    expect(html).toContain("https://calendar.example.com/slams.ics");
  });

  it("explains the calendar and includes every Grand Slam", () => {
    const html = renderHomePage("https://calendar.example.com");

    expect(html).toContain("Australian Open");
    expect(html).toContain("Roland-Garros");
    expect(html).toContain("Wimbledon");
    expect(html).toContain("US Open");
    expect(html).toContain("Updated weekly");
    expect(html).toContain("All-day events");
    expect(html).toContain("No account needed");
    expect(html).toContain("18 Jan — 1 Feb");
    expect(html).toContain("30 Aug — 13 Sep");
  });

  it("shows live feed health in the page chrome", () => {
    const html = renderHomePage("https://calendar.example.com", undefined, {
      lastSuccess: "2026-07-06T06:00:00.000Z",
      failCount: 0,
      servingStale: false,
    });

    expect(html).toContain("Feed healthy · checked 6 Jul 2026");
  });

  it("does not call an overdue refresh healthy", () => {
    const html = renderHomePage("https://calendar.example.com", undefined, {
      lastSuccess: "2026-06-01T06:00:00.000Z",
      failCount: 0,
      servingStale: true,
    });

    expect(html).toContain("Last-known-good dates active");
    expect(html).not.toContain("Feed healthy");
  });

  it("escapes an untrusted origin before inserting it into HTML", () => {
    const html = renderHomePage('https://example.com/\"><script>alert(1)</script>');

    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("falls back to bundled dates when preview data is incomplete", () => {
    const html = renderHomePage("https://calendar.example.com", []);

    expect(html).toContain("Australian Open");
    expect(html).toContain("US Open");
  });

  it("rejects a preview that repeats one major four times", () => {
    const duplicate = {
      key: "ao" as const,
      name: "Australian Open",
      location: "Melbourne",
      start: "2027-01-18",
      endExclusive: "2027-02-02",
    };
    const html = renderHomePage("https://calendar.example.com", [
      duplicate,
      duplicate,
      duplicate,
      duplicate,
    ]);

    expect(html).toContain("2026 Grand Slam season");
  });

  it("provides a keyboard-selectable manual feed URL", () => {
    const html = renderHomePage("https://calendar.example.com");

    expect(html).toContain('class="feed-url"');
    expect(html).toContain("readonly");
  });

  it("credits the author with a followed backlink", () => {
    const html = renderHomePage("https://calendar.example.com");

    expect(html).toContain('href="https://danielworkman.dev"');
    expect(html).toContain("Built by");
  });

  it("offers a Buy Me a Coffee support button in the footer", () => {
    const html = renderHomePage("https://calendar.example.com");

    expect(html).toContain('href="https://buymeacoffee.com/dworkman"');
    expect(html).toContain("Buy me a coffee");
    // Opens in a new tab, safely.
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    // Branded button, no third-party widget script.
    expect(html).toContain("#ffdd00");
    expect(html).not.toContain("buymeacoffee.com/widget");
    expect(html).not.toContain("cdnjs.buymeacoffee.com");
  });
});
