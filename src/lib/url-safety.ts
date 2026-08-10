// Shared SSRF guard for any server-side fetch of a user-supplied URL — Knowledge Base web
// sources (sources.ts's processWebSource, the original caller this was extracted from), RSS
// feed connect/ingestion (project-integrations.ts, ai-news-items.ts), and Slack webhook
// validation (project-integrations.ts). Reject non-http(s) schemes and resolve-then-check the
// hostname against private/loopback/link-local ranges before fetching.
//
// Known residual gap: this checks the resolved address once up front, not the address
// actually connected to — a DNS-rebinding attacker could still swap the record between the
// check and the fetch. Callers should still pass `redirect: "manual"` to fetch() and treat a
// 3xx as a failure rather than following it, closing the simpler bypass of that same class of
// hole (processWebSource already does this).
import { lookup } from "node:dns/promises";

export function isPrivateAddress(address: string): boolean {
  const a = address.toLowerCase();
  if (a === "::1" || a === "0.0.0.0") return true;
  const v4 = a.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const o1 = Number(v4[1]);
    const o2 = Number(v4[2]);
    if (o1 === 10 || o1 === 127 || o1 === 0) return true;
    if (o1 === 172 && o2 >= 16 && o2 <= 31) return true;
    if (o1 === 192 && o2 === 168) return true;
    if (o1 === 169 && o2 === 254) return true;
  }
  if (a.startsWith("fc") || a.startsWith("fd")) return true; // fc00::/7 (unique local)
  if (/^fe[89ab]/.test(a)) return true; // fe80::/10 (link-local)
  return false;
}

// Validates protocol + resolves + checks isPrivateAddress; throws a plain, safe (non-leaky)
// Error on any failure. Returns the parsed URL on success so callers don't need to re-parse.
export async function assertSafeExternalUrl(url: string): Promise<URL> {
  const parsed = new URL(url); // throws naturally on malformed input
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http(s) URLs are allowed.");
  }
  const { address } = await lookup(parsed.hostname);
  if (isPrivateAddress(address)) {
    throw new Error("This URL resolves to a private/internal address and can't be used.");
  }
  return parsed;
}
