import { describe, expect, it } from "vitest";
import worker from "../src/index.js";
import type { Env } from "../src/refresh.js";
import { POSTS, findPost, renderBlogIndex, renderBlogPost, sortedPosts } from "../src/blog.js";

const ORIGIN = "https://grandslamcalendar.com";
const post = POSTS[0]!;

function makeEnv(): Env {
  const store = new Map<string, string>();
  const SLAMS = {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, value);
    },
  } as unknown as KVNamespace;
  return { SLAMS, PUBLIC_ORIGIN: ORIGIN };
}

const fetchPath = (path: string) =>
  worker.fetch(new Request(`${ORIGIN}${path}`), makeEnv(), {} as ExecutionContext);

describe("post registry", () => {
  it("finds a post by slug and misses cleanly", () => {
    expect(findPost(post.slug)).toBe(post);
    expect(findPost("nope")).toBeUndefined();
  });

  it("sorts newest first", () => {
    const dates = sortedPosts().map((p) => p.published);
    expect([...dates].sort().reverse()).toEqual(dates);
  });
});

describe("renderBlogPost", () => {
  const html = renderBlogPost(ORIGIN, post);

  it("canonicalises to its own URL, not the homepage", () => {
    expect(html).toContain(`<link rel="canonical" href="${ORIGIN}/blog/${post.slug}">`);
    expect(html).toContain(`<meta property="og:url" content="${ORIGIN}/blog/${post.slug}">`);
  });

  it("is an article, not a website", () => {
    expect(html).toContain('<meta property="og:type" content="article">');
  });

  it("describes itself as a BlogPosting rather than the homepage's WebApplication", () => {
    expect(html).toContain('"@type":"BlogPosting"');
    expect(html).toContain(`"datePublished":"${post.published}"`);
    expect(html).not.toContain("WebApplication");
  });

  it("uses its own title and description", () => {
    expect(html).toContain(`<title>${post.title} — Grand Slam Calendar</title>`);
    expect(html).toContain(post.description);
  });

  it("renders the https feed URL as visible text, not only a webcal link", () => {
    // webcal:// is not a crawlable scheme, and it silently no-ops in desktop
    // browsers with no registered handler.
    expect(html).toContain(`value="${ORIGIN}/slams.ics"`);
  });

  it("carries a working CTA at both the paste step and the end", () => {
    expect((html.match(/class="copy-button"/g) ?? []).length).toBe(2);
    // Each CTA is its own copy scope, so the second button is not dead. The old
    // script bound a single `.copy-button` via querySelector and would have
    // shipped exactly that bug on this page.
    expect((html.match(/class="post-cta" data-copy-scope>/g) ?? []).length).toBe(2);
    expect(html).toContain('querySelectorAll(".copy-button")');
  });

  it("inherits the shared footer chrome", () => {
    expect(html).toContain("https://buymeacoffee.com/dworkman");
    expect(html).toContain("https://danielworkman.dev");
  });

  it("does not inherit the homepage-only hero", () => {
    expect(html).not.toContain('class="hero"');
    expect(html).toContain('class="page-head"');
  });
});

describe("renderBlogIndex", () => {
  const html = renderBlogIndex(ORIGIN);

  it("lists every post with a link", () => {
    for (const p of POSTS) {
      expect(html).toContain(`href="/blog/${p.slug}"`);
      expect(html).toContain(p.title);
    }
  });

  it("canonicalises to /blog", () => {
    expect(html).toContain(`<link rel="canonical" href="${ORIGIN}/blog">`);
  });
});

describe("routing", () => {
  it("serves the blog index", async () => {
    const res = await fetchPath("/blog");

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=900");
  });

  it("serves a post", async () => {
    const res = await fetchPath(`/blog/${post.slug}`);

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=3600");
    expect(await res.text()).toContain(post.title);
  });

  it("redirects the trailing slash rather than 404ing it", async () => {
    const res = await fetchPath("/blog/");

    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("/blog");
  });

  it("returns an HTML 404 for an unknown slug", async () => {
    const res = await fetchPath("/blog/not-a-real-post");

    expect(res.status).toBe(404);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    expect(await res.text()).toContain("That page does not exist.");
  });

  it("returns the same 404 for an unknown path", async () => {
    const res = await fetchPath("/nowhere");

    expect(res.status).toBe(404);
    // Short cache: a URL that later becomes a real post must not stay cached missing.
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=300");
  });

  it("sets the shared HTML security headers on blog routes too", async () => {
    const res = await fetchPath("/blog");

    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("still serves the feed and the homepage", async () => {
    expect((await fetchPath("/slams.ics")).status).toBe(200);
    expect((await fetchPath("/")).status).toBe(200);
  });
});

describe("sitemap", () => {
  it("enumerates the homepage, the blog index and every post", async () => {
    const xml = await (await fetchPath("/sitemap.xml")).text();

    expect(xml).toContain(`<loc>${ORIGIN}/</loc>`);
    expect(xml).toContain(`<loc>${ORIGIN}/blog</loc>`);
    for (const p of POSTS) {
      expect(xml).toContain(`<loc>${ORIGIN}/blog/${p.slug}</loc>`);
    }
    expect((xml.match(/<url>/g) ?? []).length).toBe(2 + POSTS.length);
  });

  it("gives posts a lastmod but not the homepage", async () => {
    const xml = await (await fetchPath("/sitemap.xml")).text();

    expect((xml.match(/<lastmod>/g) ?? []).length).toBe(POSTS.length);
    expect(xml).toContain(`<lastmod>${post.published}</lastmod>`);
  });
});
