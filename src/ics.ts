import type { SlamEvent } from "./seed.js";

/** Minimal KV surface buildICS needs — lets tests inject a fake. */
export interface SeqStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

const DOMAIN = "tennis-slams-ics.danielworkman.workers.dev";
const PRODID = "-//dworkman//tennis-slams//EN";

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" -> "YYYYMMDD" for VALUE=DATE fields. */
export const dateOnly = (iso: string) => iso.replaceAll("-", "");

/** UTC DTSTAMP, "YYYYMMDDTHHMMSSZ". */
export const utcStamp = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T` +
  `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

/** Escape RFC 5545 special chars in text values. */
export const esc = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");

/**
 * Fold a content line at 75 octets, continuation lines beginning with a single
 * space (RFC 5545 §3.1). Splits on UTF-8 byte boundaries (per code point) so we
 * never cut a multi-byte character in half.
 */
export function fold(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const chunks: string[] = [];
  let cur = "";
  let first = true;
  for (const ch of line) {
    const limit = first ? 75 : 74; // continuation lines spend 1 octet on the leading space
    if (enc.encode(cur + ch).length > limit) {
      chunks.push(first ? cur : " " + cur);
      first = false;
      cur = ch;
    } else {
      cur += ch;
    }
  }
  chunks.push(first ? cur : " " + cur);
  return chunks.join("\r\n");
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function startYear(e: SlamEvent): number {
  return new Date(e.start).getUTCFullYear();
}

/**
 * Render the events to an ICS string with CRLF line endings and a trailing
 * CRLF. SEQUENCE for each event is bumped (via the injected store) only when the
 * event's content hash changes, so a genuine date change updates the existing
 * event instead of creating a duplicate.
 */
export async function buildICS(
  events: SlamEvent[],
  store: SeqStore,
  now: Date = new Date(),
): Promise<string> {
  const stamp = utcStamp(now);
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Tennis Grand Slams",
    "REFRESH-INTERVAL;VALUE=DURATION:PT24H",
    "X-PUBLISHED-TTL:PT24H",
  ];

  for (const e of events) {
    const year = startYear(e);
    const idBase = `${e.key}-${year}`;
    const content = `${e.name}|${e.location}|${e.start}|${e.endExclusive}`;
    const hash = await sha256(content);
    const prevHash = await store.get(`hash:${idBase}`);
    let seq = parseInt((await store.get(`seq:${idBase}`)) ?? "0", 10);
    if (prevHash !== hash) {
      seq += 1;
      await store.put(`seq:${idBase}`, String(seq));
      await store.put(`hash:${idBase}`, hash);
    }
    lines.push(
      "BEGIN:VEVENT",
      `UID:${idBase}@${DOMAIN}`,
      `DTSTAMP:${stamp}`,
      `SEQUENCE:${seq}`,
      `SUMMARY:${esc(e.name)}`,
      `LOCATION:${esc(e.location)}`,
      "TRANSP:TRANSPARENT",
      `DTSTART;VALUE=DATE:${dateOnly(e.start)}`,
      `DTEND;VALUE=DATE:${dateOnly(e.endExclusive)}`,
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
