import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export class FetchPageError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "FetchPageError";
  }
}

const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 15000;
const MAX_REDIRECTS = 5;

/** True for loopback, private, link-local and other non-public addresses. */
export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateAddress(v6.slice(7));
  return v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80");
}

async function assertPublicUrl(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new FetchPageError("Only http and https links can be imported.");
  }
  if (process.env.ALLOW_PRIVATE_IMPORTS === "1") return;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address);
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new FetchPageError("That address is not a public website.");
  }
}

/**
 * Fetch a public web page's HTML. Blocks private network addresses (so the
 * server can't be used to reach internal services), follows a limited number
 * of redirects, and caps size and time.
 */
export async function fetchPublicPage(rawUrl: string, fetchImpl: typeof fetch = fetch): Promise<{ html: string; finalUrl: string }> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new FetchPageError("That doesn't look like a valid link.");
  }

  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    await assertPublicUrl(url);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetchImpl(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; RecipeFun/1.0; personal recipe importer)",
          accept: "text/html,application/xhtml+xml",
        },
      });
    } catch (err) {
      throw new FetchPageError(
        controller.signal.aborted ? "The site took too long to respond." : `Couldn't reach the site (${(err as Error).message}).`,
        502,
      );
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new FetchPageError("The site sent a redirect without a destination.", 502);
      url = new URL(location, url);
      continue;
    }
    if (res.status === 401 || res.status === 403) {
      throw new FetchPageError("The site blocked automated access. Paste the recipe text instead.", 422);
    }
    if (!res.ok) throw new FetchPageError(`The site returned an error (${res.status}).`, 502);

    const length = Number(res.headers.get("content-length") ?? 0);
    if (length > MAX_BYTES) throw new FetchPageError("That page is too large to import.", 413);
    const html = await res.text();
    if (html.length > MAX_BYTES) throw new FetchPageError("That page is too large to import.", 413);
    return { html, finalUrl: url.toString() };
  }
  throw new FetchPageError("Too many redirects.", 502);
}
