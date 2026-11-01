export interface PageViewPayload {
  website: string;
  hostname: string;
  url: string;
  title: string;
  referrer?: string;
}

export interface UmamiTracker {
  track: (payload: PageViewPayload) => void | Promise<void>;
}

const STATIC_PAGE_TITLES: Record<string, string> = {
  "/": "Home",
  "/about": "About",
  "/blog": "Blog",
  "/contact": "Contact",
  "/projects": "Projects",
};

export function getUmamiScriptUrl(value: string | undefined, siteOrigin?: string): string | null {
  if (!value?.trim()) return null;

  try {
    const url = new URL(value.trim());
    const site = siteOrigin ? new URL(siteOrigin) : null;
    const isLoopback =
      url.hostname === "localhost" ||
      url.hostname.endsWith(".localhost") ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "[::1]";
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      (url.protocol === "http:" && !isLoopback) ||
      url.username ||
      url.password ||
      url.pathname !== "/script.js" ||
      url.search ||
      url.hash ||
      url.origin === site?.origin
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function isPublicAnalyticsPath(pathname: string): boolean {
  if (!pathname.startsWith("/") || pathname.includes("?") || pathname.includes("#")) {
    return false;
  }

  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (Object.hasOwn(STATIC_PAGE_TITLES, normalized)) return true;

  // Dynamic pages use Django slugs. This excludes preview, admin, API, and
  // arbitrary nested paths while retaining stable public blog/project routes.
  return /^\/(?:blog|projects)\/[a-zA-Z0-9_-]+$/.test(normalized);
}

function pageTitle(pathname: string): string | null {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const staticTitle = STATIC_PAGE_TITLES[normalized];
  if (staticTitle) return staticTitle;
  if (/^\/blog\/[a-zA-Z0-9_-]+$/.test(normalized)) return "Blog article";
  if (/^\/projects\/[a-zA-Z0-9_-]+$/.test(normalized)) return "Project";
  return null;
}

export function sanitizeExternalReferrer(
  value: string | undefined,
  siteOrigin: string,
): string | undefined {
  if (!value) return undefined;

  try {
    const origin = new URL(siteOrigin).origin;
    const referrer = new URL(value);
    if (
      (referrer.protocol !== "http:" && referrer.protocol !== "https:") ||
      referrer.username ||
      referrer.password ||
      referrer.origin === origin
    ) {
      return undefined;
    }
    return referrer.origin;
  } catch {
    return undefined;
  }
}

export function createPageViewPayload(
  pathname: string,
  website: string,
  hostname: string,
  siteOrigin: string,
  externalReferrer?: string,
): PageViewPayload | null {
  const title = pageTitle(pathname);
  if (!title || !website || !hostname) return null;

  const payload: PageViewPayload = {
    website,
    hostname,
    url: pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname,
    title,
  };
  const referrer = sanitizeExternalReferrer(externalReferrer, siteOrigin);
  if (referrer) payload.referrer = referrer;
  return payload;
}

export function sendPageView(tracker: UmamiTracker | undefined, payload: PageViewPayload): void {
  try {
    const result = tracker?.track(payload);
    if (result) void Promise.resolve(result).catch(() => {});
  } catch {
    // Analytics is optional and must not affect navigation or rendering.
  }
}
