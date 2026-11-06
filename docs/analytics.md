# Aggregate-only website statistics

The 2026-11-06 user decision supersedes the previous Umami integration. The public website now uses its own React tracker and Django daily counters. Umami scripts and outbound-click tracking are no longer loaded. The old Compose stack is retained only for handling historical data; it is not needed by the website and no existing database or volume is deleted.

## What is stored

The Django `site_statistics.DailyPageTotal` table contains only:

- UTC calendar day (not a precise request/event time).
- An allowlisted public page path; blog posts must be published and project slugs must exist.
- One of `direct`, `google`, `bing`, `duckduckgo`, `github`, `linkedin`, `other`.
- Total page views and total approximate visible-tab seconds.

There are no visitor records, sessions, cookies, local/session storage, browser/OS/location data, IP addresses or hashes, outbound events, custom identifiers, or individual event rows. Contributions increment existing counters immediately using atomic database updates. Arbitrary metadata is rejected, not silently stored. Unknown referrer hosts are reduced to `other` in the browser; raw referrer URLs, private subdomains, paths, and queries are never transmitted. Internal navigation is counted as `direct` (direct/internal/unknown), without building a navigation history. Counts cannot deduplicate people or bots.

## Browser behavior

The tracker counts one view when a public page first becomes visible, including SPA navigation and back/forward. Approximate viewing time is the time the tab is visible, not proof of attention. Time is rounded down to five-second increments and submitted every 30 seconds, when hidden, when navigating, or on pagehide. A suspended timer contributes at most 30 seconds per wake-up, and each page is capped at 30 minutes. Unsaved fractions and unsuccessful requests may be lost. No retries, durable queues, or deduplication IDs are used. React StrictMode and bfcache restores do not add duplicate views. DNT and Global Privacy Control suppress collection.

Requests use `fetch` with `credentials: omit`, `referrerPolicy: no-referrer`, `keepalive: true`, and no cache. `sendBeacon` is deliberately avoided because credentials cannot be omitted with it.

## Collection boundary

`POST /stats/collect` is a same-origin Next.js route. It accepts only a bounded JSON payload with `path`, `referrer`, `views`, and `seconds`. It forwards that object to Django `/api/v1/statistics/` without browser cookies, Referer, visitor IP headers, or browser User-Agent. Django strips cookie/auth/IP/browser metadata before its session middleware, then validates the payload independently. The write endpoint is public; it exposes no reporting data and cannot promise fraud-resistant counts without adding identifiers. It must not be used for billing or unique-visitor metrics.

`STATISTICS_ENABLED=false` on frontend and backend disables collection. It defaults to true for the requested implementation. The retired `UMAMI_*` settings have no effect on the tracker.

## Reporting and retention

Open Django admin ? **Anonymous statistics ? Daily page totals**. Staff can filter by date and referrer or search a page path. Reports contain views, summed seconds, and approximate seconds per view; no session drilldown exists. The aggregate rows are read-only in admin.

Collection deletes aggregate rows older than the current UTC day plus the previous 89 days. Also schedule `python manage.py purge_statistics` daily, including while collection is disabled. Set backups to expire within the chosen retention policy; deleting live aggregates does not delete old backups.

## Network and logging limits

An HTTP server necessarily processes the source address transiently to deliver a request. This implementation promises aggregate-only statistics storage, not that personal data never touches the network or that a legal exemption is guaranteed. The Next collector strips identity before forwarding to Django. Gunicorn access logs are disabled in the Docker image and both website Compose configurations; error logging remains. The checked-in Caddy configuration has no access logger. External CDNs, load balancers, hosting access/error logs, monitoring, older releases, and historical Umami records must be reviewed separately. Do not claim that IPs are never processed or universally absent from infrastructure logs.

Privacy text must describe the actual hosting setup and the reduced referrer categories. Do not describe the metrics as unique visitors, exact reading times, full referrer URLs, or proof that consent is legally unnecessary.

## Verification

Frontend tests cover public-path and payload allowlists, source reduction, credential-free transport, StrictMode, SPA navigation, hidden tabs, bfcache, and timing caps. Next collector tests verify origin checks, body limits, and that visitor headers are not forwarded. Django tests cover immediate aggregation, rejected identity fields, draft/unknown paths, cookie isolation, disabling, and retention. Local live smoke uses synthetic visits only.
