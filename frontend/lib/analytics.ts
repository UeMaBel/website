export const REFERRER_SOURCES = ["direct", "google", "bing", "duckduckgo", "github", "linkedin", "other"] as const;
export type ReferrerSource = typeof REFERRER_SOURCES[number];
export interface StatisticsContribution { path: string; referrer: ReferrerSource; views: number; seconds: number; }
const PUBLIC_PATHS = new Set(["/", "/about", "/blog", "/projects", "/contact", "/datenschutz"]);
export function isPublicAnalyticsPath(path: string): boolean {
  return path.length <= 280 && (PUBLIC_PATHS.has(path) || /^\/(blog|projects)\/[a-zA-Z0-9_-]{1,250}$/.test(path));
}
// Never transmit arbitrary referrer URLs, hostnames, paths, or query strings.
export function referrerSource(value: string, siteOrigin: string): ReferrerSource {
  if (!value) return "direct";
  try {
    const url = new URL(value);
    if (url.origin === siteOrigin) return "direct";
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return "other";
    const hosts: Record<string, ReferrerSource> = {
      "google.com": "google", "www.google.com": "google", "google.de": "google", "www.google.de": "google",
      "bing.com": "bing", "www.bing.com": "bing", "duckduckgo.com": "duckduckgo", "www.duckduckgo.com": "duckduckgo",
      "github.com": "github", "www.github.com": "github", "linkedin.com": "linkedin", "www.linkedin.com": "linkedin",
    };
    return Object.hasOwn(hosts, url.hostname) ? hosts[url.hostname] : "other";
  } catch { return "other"; }
}
export function validContribution(value: unknown): value is StatisticsContribution {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  return Object.keys(data).sort().join(",") === "path,referrer,seconds,views"
    && typeof data.path === "string" && isPublicAnalyticsPath(data.path)
    && REFERRER_SOURCES.some(source => source === data.referrer)
    && (data.views === 0 || data.views === 1)
    && typeof data.seconds === "number" && Number.isInteger(data.seconds)
    && data.seconds >= 0 && data.seconds <= 30 && data.seconds % 5 === 0
    && (data.views === 1 ? data.seconds === 0 : data.seconds > 0);
}
export function sendContribution(data: StatisticsContribution): void {
  try {
    // sendBeacon includes credentials; fetch lets us explicitly omit cookies.
    void fetch("/stats/collect", {
      method: "POST", body: JSON.stringify(data), headers: { "Content-Type": "application/json" },
      credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store", keepalive: true,
    }).catch(() => {});
  } catch { /* Statistics must never interrupt the site. No retries or stored queue. */ }
}
