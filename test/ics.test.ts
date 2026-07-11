import { describe, it, expect } from "vitest";
import { buildICS, esc, fold, dateOnly, utcStamp, type SeqStore } from "../src/ics.js";
import type { SlamEvent } from "../src/seed.js";

function fakeStore(): SeqStore {
  const m = new Map<string, string>();
  return {
    get: async (k) => m.get(k) ?? null,
    put: async (k, v) => void m.set(k, v),
  };
}

const AO: SlamEvent = {
  key: "ao",
  name: "Australian Open",
  location: "Melbourne Park, Melbourne, Australia",
  start: "2026-01-18",
  endExclusive: "2026-02-02",
};

const FIXED = new Date("2026-05-31T06:00:00Z");

describe("helpers", () => {
  it("dateOnly strips dashes", () => {
    expect(dateOnly("2026-02-02")).toBe("20260202");
  });

  it("utcStamp formats UTC", () => {
    expect(utcStamp(FIXED)).toBe("20260531T060000Z");
  });

  it("esc escapes RFC 5545 specials", () => {
    expect(esc("a, b; c \\ d\ne")).toBe("a\\, b\\; c \\\\ d\\ne");
  });

  it("fold leaves short lines untouched", () => {
    expect(fold("SUMMARY:short")).toBe("SUMMARY:short");
  });

  it("fold wraps >75 octet lines with leading-space continuation", () => {
    const long = "LOCATION:" + "x".repeat(120);
    const folded = fold(long);
    const lines = folded.split("\r\n");
    expect(lines.length).toBeGreaterThan(1);
    // first line <= 75 octets, continuations start with a space
    expect(new TextEncoder().encode(lines[0]!).length).toBeLessThanOrEqual(75);
    for (const l of lines.slice(1)) expect(l.startsWith(" ")).toBe(true);
    // unfolding (drop CRLF + leading space) restores the original
    expect(folded.replace(/\r\n /g, "")).toBe(long);
  });
});

describe("buildICS", () => {
  it("joins with CRLF and ends with a trailing CRLF", async () => {
    const ics = await buildICS([AO], fakeStore(), FIXED);
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics).toContain("BEGIN:VCALENDAR\r\n");
    expect(ics.includes("\n\n")).toBe(false); // no bare LF blocks
  });

  it("emits calendar-level subscription hints once", async () => {
    const ics = await buildICS([AO], fakeStore(), FIXED);
    expect(ics).toContain("REFRESH-INTERVAL;VALUE=DURATION:PT24H");
    expect(ics).toContain("X-PUBLISHED-TTL:PT24H");
    expect(ics.match(/BEGIN:VCALENDAR/g)).toHaveLength(1);
  });

  it("uses an exclusive all-day DTEND (day after the final day)", async () => {
    const ics = await buildICS([AO], fakeStore(), FIXED);
    expect(ics).toContain("DTSTART;VALUE=DATE:20260118");
    expect(ics).toContain("DTEND;VALUE=DATE:20260202"); // final day is 1 Feb
  });

  it("builds a stable UID from key-startYear", async () => {
    const ics = await buildICS([AO], fakeStore(), FIXED);
    expect(ics).toContain("UID:ao-2026@tennis-slams-ics.danielworkman.workers.dev");
  });

  it("escapes commas in LOCATION", async () => {
    const ics = await buildICS([AO], fakeStore(), FIXED);
    expect(ics).toContain("LOCATION:Melbourne Park\\, Melbourne\\, Australia");
  });

  it("keeps SEQUENCE stable when content is unchanged", async () => {
    const store = fakeStore();
    const a = await buildICS([AO], store, FIXED);
    const b = await buildICS([AO], store, FIXED);
    expect(a).toContain("SEQUENCE:1");
    expect(b).toContain("SEQUENCE:1"); // no bump on identical content
  });

  it("bumps SEQUENCE when an event's dates change", async () => {
    const store = fakeStore();
    await buildICS([AO], store, FIXED);
    const moved: SlamEvent = { ...AO, start: "2026-01-19", endExclusive: "2026-02-03" };
    const ics = await buildICS([moved], store, FIXED);
    expect(ics).toContain("SEQUENCE:2");
  });
});
