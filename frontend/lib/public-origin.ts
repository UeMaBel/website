import "server-only";

const DEFAULT_PUBLIC_SITE_ORIGIN = "http://127.0.0.1:3000";

export function getPublicSiteOrigin(): URL {
  const configuredOrigin = process.env.PUBLIC_SITE_ORIGIN?.trim() || DEFAULT_PUBLIC_SITE_ORIGIN;
  let origin: URL;

  try {
    origin = new URL(configuredOrigin);
  } catch {
    throw new Error("PUBLIC_SITE_ORIGIN must be an absolute HTTP(S) origin.");
  }

  if (
    (origin.protocol !== "http:" && origin.protocol !== "https:") ||
    origin.username.length > 0 ||
    origin.password.length > 0 ||
    origin.pathname !== "/" ||
    origin.search.length > 0 ||
    origin.hash.length > 0
  ) {
    throw new Error("PUBLIC_SITE_ORIGIN must be an HTTP(S) origin without credentials, path, query, or fragment.");
  }

  return origin;
}
