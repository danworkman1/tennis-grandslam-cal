import { describe, expect, it } from "vitest";
import { renderHomePage } from "../src/home.js";
import type { SlamEvent } from "../src/seed.js";

/** Two complete seasons on file, which is what the feed holds mid-year. */
const TWO_SEASONS: SlamEvent[] = [
  { key: "ao", start: "2026-01-18", endExclusive: "2026-02-02" },
  { key: "rg", start: "2026-05-24", endExclusive: "2026-06-08" },
  { key: "wimbledon", start: "2026-06-29", endExclusive: "2026-07-13" },
  { key: "usopen", start: "2026-08-30", endExclusive: "2026-09-14" },
  { key: "ao", start: "2027-01-17", endExclusive: "2027-02-01" },
  { key: "rg", start: "2027-05-23", endExclusive: "2027-06-07" },
  { key: "wimbledon", start: "2027-06-28", endExclusive: "2027-07-12" },
  { key: "usopen", start: "2027-08-29", endExclusive: "2027-09-13" },
].map((e) => ({ ...e, name: e.key, location: "somewhere" }) as SlamEvent);

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

  it("shows the upcoming season, not one that has already finished", () => {
    // 1 Dec 2026: the whole 2026 season is over and 2027 is known. Before this
    // fix the page kept showing 2026 until the calendar rolled over on 1 January.
    const html = renderHomePage(
      "https://calendar.example.com",
      TWO_SEASONS,
      undefined,
      new Date("2026-12-01T00:00:00Z"),
    );

    expect(html).toContain("2027 Grand Slam season");
    expect(html).not.toContain("2026 Grand Slam season");
  });

  it("keeps showing the current season while one of its majors is still to come", () => {
    // 28 Jul 2026: Wimbledon is done but the US Open has not started, so 2026 is
    // still the upcoming season even though 2027 dates are on file.
    const html = renderHomePage(
      "https://calendar.example.com",
      TWO_SEASONS,
      undefined,
      new Date("2026-07-28T00:00:00Z"),
    );

    expect(html).toContain("2026 Grand Slam season");
  });

  it("falls back to the most recent season when every date is in the past", () => {
    const html = renderHomePage(
      "https://calendar.example.com",
      TWO_SEASONS,
      undefined,
      new Date("2030-01-01T00:00:00Z"),
    );

    expect(html).toContain("2027 Grand Slam season");
  });

  it("leads with the year and the word dates in its search metadata", () => {
    const html = renderHomePage(
      "https://calendar.example.com",
      TWO_SEASONS,
      undefined,
      new Date("2026-07-28T00:00:00Z"),
    );

    expect(html).toContain("<title>2026 Grand Slam dates —");
    expect(html).toContain('content="The 2026 Australian Open');
    expect(html).toContain("<h1>2026 Grand Slam dates.");
  });

  it("moves the metadata year with the season", () => {
    const html = renderHomePage(
      "https://calendar.example.com",
      TWO_SEASONS,
      undefined,
      new Date("2026-12-01T00:00:00Z"),
    );

    expect(html).toContain("<title>2027 Grand Slam dates —");
    expect(html).toContain("<h1>2027 Grand Slam dates.");
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
