import { describe, expect, it } from "vitest";
import { buildFaviconSvg } from "../src/icon.js";

describe("buildFaviconSvg", () => {
  it("is a self-contained square SVG document", () => {
    const svg = buildFaviconSvg();

    expect(svg).toContain("<svg");
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('viewBox="0 0 32 32"');
    expect(svg).toContain("</svg>");
  });

  it("uses the brand palette so the icon matches the site", () => {
    const svg = buildFaviconSvg();

    expect(svg).toContain("#dfff55");
    expect(svg).toContain("#08271c");
  });

  it("references no external resources", () => {
    const svg = buildFaviconSvg();

    // www.w3.org is exempt in both schemes: the SVG xmlns is a namespace
    // identifier fixed by spec, not a resource the renderer ever fetches.
    expect(svg).not.toMatch(/http:\/\/(?!www\.w3\.org)/);
    expect(svg).not.toMatch(/https:\/\/(?!www\.w3\.org)/);
  });
});
