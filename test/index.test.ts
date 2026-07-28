import { describe, expect, it } from "vitest";
import worker from "../src/index.js";
import type { Env } from "../src/refresh.js";

function makeEnv(publicOrigin?: string): Env {
  const store = new Map<string, string>();
  const SLAMS = {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, value);
    },
  } as unknown as KVNamespace;
  return { SLAMS, PUBLIC_ORIGIN: publicOrigin };
}

const fetchPath = (url: string, env: Env) =>
  worker.fetch(new Request(url), env, {} as ExecutionContext);

const BRANDED = "https://grandslamcalendar.com";
const LEGACY = "https://tennis-slams-ics.danielworkman.workers.dev";

describe("X-Robots-Tag on the legacy origin", () => {
  it("marks the homepage noindex when served from a non-canonical host", async () => {
    const res = await fetchPath(`${LEGACY}/`, makeEnv(BRANDED));

    expect(res.headers.get("X-Robots-Tag")).toBe("noindex");
  });

  it("leaves the branded host indexable", async () => {
    const res = await fetchPath(`${BRANDED}/`, makeEnv(BRANDED));

    expect(res.headers.get("X-Robots-Tag")).toBeNull();
  });

  it("does not mark anything noindex when PUBLIC_ORIGIN is unset", async () => {
    // Without a configured brand there is no canonical host to prefer, so the
    // request's own host is canonical by definition.
    const res = await fetchPath(`${LEGACY}/`, makeEnv());

    expect(res.headers.get("X-Robots-Tag")).toBeNull();
  });

  it("ignores a malformed PUBLIC_ORIGIN rather than noindexing every host", async () => {
    const res = await fetchPath(`${LEGACY}/`, makeEnv("not a url"));

    expect(res.headers.get("X-Robots-Tag")).toBeNull();
  });

  it("never touches the feed, which is what legacy subscribers actually poll", async () => {
    const res = await fetchPath(`${LEGACY}/slams.ics`, makeEnv(BRANDED));

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Robots-Tag")).toBeNull();
    expect(res.headers.get("Content-Type")).toContain("text/calendar");
  });

  it("keeps the canonical pointing at the branded host from the legacy origin", async () => {
    // The noindex is additive: the canonical hint stays exactly as it was.
    const res = await fetchPath(`${LEGACY}/`, makeEnv(BRANDED));

    expect(await res.text()).toContain(`<link rel="canonical" href="${BRANDED}/">`);
  });
});
