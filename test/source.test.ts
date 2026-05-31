import { describe, it, expect } from "vitest";
import { parseDateRange, cleanInfoboxValue, fetchFromSource } from "../src/source.js";

describe("cleanInfoboxValue", () => {
  it("strips footnotes, refs, templates and wikilinks", () => {
    const raw = "August 24{{efn|Mixed doubles began on August 19.}} – September 7<ref>x</ref>";
    expect(cleanInfoboxValue(raw)).toBe("August 24 – September 7");
  });

  it("turns {{snd}} into a dash", () => {
    expect(cleanInfoboxValue("18 January {{snd}} 1 February 2026")).toBe(
      "18 January – 1 February 2026",
    );
  });
});

describe("parseDateRange — real infobox formats", () => {
  it("Australian Open (dmy, cross-month, year at end)", () => {
    expect(parseDateRange("18 January – 1 February 2026", 2026)).toEqual({
      start: "2026-01-18",
      endExclusive: "2026-02-02",
    });
  });

  it("French Open (dmy)", () => {
    expect(parseDateRange("24 May – 7 June 2026", 2026)).toEqual({
      start: "2026-05-24",
      endExclusive: "2026-06-08",
    });
  });

  it("Wimbledon (dmy, June->July)", () => {
    expect(parseDateRange("29 June – 12 July 2026", 2026)).toEqual({
      start: "2026-06-29",
      endExclusive: "2026-07-13",
    });
  });

  it("US Open (mdy, no year on the line, with footnote)", () => {
    expect(
      parseDateRange("August 24{{efn|Mixed doubles competition began on August 19.}} – September 7", 2025),
    ).toEqual({ start: "2025-08-24", endExclusive: "2025-09-08" });
  });

  it("inherits the month when one side omits it (e.g. '24 – 31 August')", () => {
    expect(parseDateRange("24 – 31 August 2025", 2025)).toEqual({
      start: "2025-08-24",
      endExclusive: "2025-09-01",
    });
  });

  it("returns null on unparseable input", () => {
    expect(parseDateRange("sometime next summer", 2026)).toBeNull();
    expect(parseDateRange("18 January 2026", 2026)).toBeNull(); // no range
  });
});

describe("fetchFromSource", () => {
  const ok = (title: string, date: string) => ({
    ok: true,
    status: 200,
    json: async () => ({ parse: { title, wikitext: `|date = ${date}\n` } }),
  });

  it("parses events, ignores not-yet-published (redirect) articles", async () => {
    const fakeFetch = (async (url: string) => {
      const u = decodeURIComponent(String(url));
      if (u.includes("2026 Australian Open")) return ok("2026 Australian Open", "18 January – 1 February 2026");
      if (u.includes("2026 French Open")) return ok("2026 French Open", "24 May – 7 June 2026");
      if (u.includes("2026 Wimbledon")) return ok("2026 Wimbledon Championships", "29 June – 12 July 2026");
      // US Open 2026 article not published yet -> redirects to the parent series page
      if (u.includes("2026 US Open")) return ok("US Open (tennis)", "");
      // 2027 articles don't exist at all
      return { ok: true, status: 200, json: async () => ({}) };
    }) as unknown as typeof fetch;

    const events = await fetchFromSource([2026, 2027], fakeFetch);
    const keys = events.map((e) => `${e.key}-${new Date(e.start).getUTCFullYear()}`).sort();
    expect(keys).toEqual(["ao-2026", "rg-2026", "wimbledon-2026"]); // no usopen (redirect), no 2027
  });

  it("throws only when every request fails (total outage)", async () => {
    const downFetch = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    await expect(fetchFromSource([2026], downFetch)).rejects.toThrow(/unreachable/);
  });
});
