// Favicon as an inline SVG string. This Worker has no assets binding — it returns
// everything from template literals — so the icon is built here and served from a
// route, exactly like buildRobotsTxt/buildSitemap in seo.ts. A pure builder keeps it
// unit-testable without the router.
//
// The mark is a tennis ball drawn from the site palette (--ball on --green-deep),
// mirroring the CSS-only .brand__ball in home.ts. Modern browsers and Google's
// favicon crawler all accept SVG, so no .ico/.png variants are needed.

export function buildFaviconSvg(): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img" aria-label="Grand Slam Calendar">',
    '<circle cx="16" cy="16" r="15" fill="#dfff55" stroke="#08271c" stroke-width="2"/>',
    // Two seams, each bowing inward from the rim to carve the classic crescents.
    // Endpoints sit exactly on the circle: (16±10.6, 16±10.6) is 15 units from centre.
    // stroke-width 2 is deliberate — at 1.5 the seams turn to mush at the 16px size
    // Google renders favicons at, which is the whole point of this change.
    '<path d="M5.4 5.4A15 15 0 0 1 5.4 26.6" fill="none" stroke="#08271c" stroke-width="2"/>',
    '<path d="M26.6 5.4A15 15 0 0 0 26.6 26.6" fill="none" stroke="#08271c" stroke-width="2"/>',
    "</svg>",
    "",
  ].join("\n");
}
