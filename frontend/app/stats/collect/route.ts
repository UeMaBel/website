import { validContribution } from "../../../lib/analytics";
import { getPublicSiteOrigin } from "../../../lib/public-origin";

function response(status: number) {
  return new Response(null, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (process.env.STATISTICS_ENABLED?.trim().toLowerCase() === "false") return response(204);
  const origin = request.headers.get("origin");
  const allowedOrigins = [new URL(request.url).origin, getPublicSiteOrigin().origin];
  // Next's standalone server may construct request.url with localhost internally.
  // The incoming Host still identifies the same-origin browser destination.
  let matchesHost = false;
  try {
    const browserOrigin = new URL(origin || "");
    matchesHost = browserOrigin.host === request.headers.get("host")
      && browserOrigin.protocol === new URL(request.url).protocol;
  } catch { /* A malformed or opaque origin is never trusted. */ }
  if (!origin || (!allowedOrigins.includes(origin) && !matchesHost)
    || request.headers.get("sec-fetch-site") === "cross-site") return response(403);
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") return response(415);
  if (new URL(request.url).search) return response(400);

  try {
    // Bound the body before decoding; never log or forward the raw request.
    const reader = request.body?.getReader();
    if (!reader) return response(400);
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > 1024) { await reader.cancel(); return response(413); }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    let data: unknown;
    try { data = JSON.parse(new TextDecoder().decode(bytes)); } catch { return response(400); }
    if (!validContribution(data)) return response(400);
    const backend = new URL(process.env.BACKEND_API_URL?.trim() || "http://127.0.0.1:8000");
    if (!["http:", "https:"].includes(backend.protocol) || backend.username || backend.password) return response(503);
    // Server-to-server: no visitor IP, browser headers, cookies, or Referer.
    const result = await fetch(new URL("/api/v1/statistics/", backend), {
      method: "POST", body: JSON.stringify(data),
      headers: { "Content-Type": "application/json", "User-Agent": "aggregate-statistics" },
      credentials: "omit", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(3000),
    });
    return response(result.ok ? 204 : 503);
  } catch {
    return response(503);
  }
}
