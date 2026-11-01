# Analytics selection and integration contract

Ticket 52 decision, researched 2026-11-01 against the personal website spec.

## Choice

Use **self-hosted Umami**, initially targeting **v3.4.1**, with its own PostgreSQL
database and Compose project. This is a product selection, not a running service.
The upstream release identifies v3.4.1 as a security hotfix and asks self-hosted
operators to update. Ticket 53 must verify the published image/tag and pin an
immutable digest; do not copy the upstream example's floating `latest` tag.
Sources: [release](https://github.com/umami-software/umami/releases/tag/v3.4.1),
[tagged Compose example](https://github.com/umami-software/umami/blob/v3.4.1/docker-compose.yml).

Umami's MIT license permits self-hosting. Its application plus PostgreSQL fits the
existing operational skill set without adding another database technology.
The latter is our engineering judgment, not a resource benchmark.
Sources: [license](https://github.com/umami-software/umami/blob/v3.4.1/LICENSE),
[installation](https://docs.umami.is/docs/install).

| Candidate | Fit and operational tradeoff | Outcome |
| --- | --- | --- |
| Umami | Reports pageviews/referrers and custom events; app plus PostgreSQL. | Selected for the required small aggregate reporting scope. [Overview](https://docs.umami.is/docs), [installation](https://docs.umami.is/docs/install). |
| Plausible Community Edition | Strong alternative for traffic analytics; its official stack runs the app, PostgreSQL, and ClickHouse. It recommends at least 2GB RAM and requires supported CPU instructions. | Additional database operations are unnecessary for this scope. No claim that Umami is faster or uses a measured amount of RAM. [CE guide](https://github.com/plausible/community-edition/blob/v3.2.1/README.md), [Compose](https://github.com/plausible/community-edition/blob/v3.2.1/compose.yml). |
| Matomo On-Premise | Tracks page information and outlinks; requires a PHP/webserver and MySQL/MariaDB stack. Cookieless tracking needs explicit configuration. | Broader platform and another database/runtime to operate. [Requirements](https://matomo.org/faq/on-premise/matomo-requirements/), [tracked data](https://matomo.org/faq/general/faq_18254/), [cookieless settings](https://matomo.org/faq/how-to/how-do-i-enforce-tracking-without-cookies/). |

## Required reports

| Spec requirement | Umami capability and project interpretation |
| --- | --- |
| Aggregate page views | Website traffic metrics, grouped by date; count views, not authenticated readers. [Overview](https://docs.umami.is/docs). |
| Traffic sources | Referrer reporting; retain an external origin only, without referring path/query. Referrer suppression by browsers means some visits remain direct/unknown. [Metrics](https://docs.umami.is/docs/metric-definitions). |
| Popular posts | Group public blog paths by pageview count; article titles can label reports but public paths are the stable grouping key. [Breakdown API](https://docs.umami.is/docs/api-reference/get-website-breakdown). |
| Outbound interest | Custom events for email/profile/repository/demo clicks. The event report and properties distinguish categories. Counts indicate interest, never confirmed enquiries or completed contact. [Events](https://docs.umami.is/docs/track-events). |

## Privacy boundaries

Cookie-free does not mean collection-free. Umami groups sessions using a hash of
website ID, IP, User-Agent, and a rotating salt; the standard analytics record
does not store the IP field. IPs are still processed and may reach infrastructure
logs. Session IDs can correlate visits within a rotation period, and are not a
guarantee of anonymity. Source: [metric definitions](https://docs.umami.is/docs/metric-definitions).
The server can still derive browser/OS/device and approximate location from request
metadata; reducing browser payload fields alone does not remove that processing.
Keep those reports outside the project's measurement scope. The same source
describes these session and location metrics.

Project settings and limits:

- Use one website ID for this website only; do not install its tracker on demos,
  independent projects, mail, or other sites. Never use `identify`, distinct IDs,
  session properties, user IDs, emails, or free-text event properties.
- Set `SALT_ROTATION=day` to shorten the correlation window; daily rotation is
  implemented in the selected tag. Inspect aggregate reports only; do not use
  individual session profiles. Source: [tagged salt implementation](https://github.com/umami-software/umami/blob/v3.4.1/src/lib/crypto.ts).
- No replays, recorder script, heatmaps, pixels, tracked redirect links, error or
  performance collection. Leave their optional settings off. Replays require a
  separate recorder and website setting; do not enable either. Source:
  [replay configuration](https://docs.umami.is/docs/replays).
- Set `PRIVATE_MODE=1`, `DISABLE_TELEMETRY=1`, and `DISABLE_UPDATES=1`. Monitor
  releases manually. Keep Redis and MCP off. Restrict dashboard access; no public
  share links. Sources: [environment variables](https://docs.umami.is/docs/environment-variables),
  [share-link access](https://docs.umami.is/docs/guides/create-a-public-dashboard).
- Send only allowlisted public paths and generic public titles. Exclude query
  strings/fragments; reject preview/admin/login/API paths. Referrers are external
  HTTP(S) origins only; never full URLs, credentials, query strings, or email
  addresses. Do not send outbound URLs, link labels, or `mailto:` targets.
- Umami self-hosted retention is indefinite by default. Proposed operating policy:
  retain event/session data at most 90 days, with a verified scheduled purge and
  matching expiry for backups before production activation. This is a project
  policy, not a claimed built-in retention switch. Ticket 53 must document the
  chosen deletion procedure; ticket 56 verifies it and the restricted payload.
  Source: [self-hosted retention FAQ](https://docs.umami.is/docs/faq).

The tracker also reads the local-storage opt-out flag `umami.disabled`; therefore
do not advertise the integration as making no terminal-storage accesses.
Source: [v3.4.1 tracker](https://github.com/umami-software/umami/blob/v3.4.1/src/tracker/index.ts).

### Consent and deployment implications

The product choice does not decide a lawful basis. For a Germany/EU deployment,
assess terminal storage/access separately from processing personal data. TDDDG
section 25 requires consent for covered accesses unless an exception applies;
the GDPR also requires a lawful basis, transparency, minimization, and retention
limits where personal data is processed. A cookie-free marketing claim establishes
neither exemption nor a legitimate-interests assessment. Sources:
[TDDDG section 25](https://www.gesetze-im-internet.juris.de/ttdsg/__25.html),
[GDPR Articles 5, 6, 13 and 21](https://eur-lex.europa.eu/eli/reg/2016/679).

Before production activation, record the operator's jurisdiction-specific basis,
privacy notice, retention/logging policy, processor/hosting arrangements, and
consent or opt-out design. Where consent is required, do not load the tracker or
send requests until granted; withdrawal stops future tracking. Until that mode is
resolved, production collection stays disabled. Local integration can use synthetic
visits. These are deployment inputs, not a blocker to the local implementation.
DNT can be honored as an additional signal but is not a consent system.
Source: [Umami configuration and DNT limitations](https://docs.umami.is/docs/tracker-configuration).

## Contract for tickets 53–56

### Independent service (53)

Use a dedicated Compose project/network/volume and PostgreSQL credentials. The
analytics database is private, distinct from Django's database, and has no host
port. Only its app joins the shared proxy network. Configure the analytics host
separately; no website startup or health dependency on analytics. Set unique
`APP_SECRET` and `TWO_FACTOR_ENCRYPTION_KEY`; replace the seeded admin password
before exposing a dashboard. Back up database and required secrets and rehearse
restore independently. Sources: [installation/default account](https://docs.umami.is/docs/install),
[environment variables](https://docs.umami.is/docs/environment-variables).

The image's internal app port is 3000 and `/api/heartbeat` is the upstream
healthcheck. Measure resource use locally and set limits without assuming a RAM
minimum that upstream has not established here. Validate runtime/DB versions and
migrations against the selected release before pinning. Source:
[tagged Compose](https://github.com/umami-software/umami/blob/v3.4.1/docker-compose.yml).
See [the independent local stack and update guide](analytics-stack.md) for the
immutable image digest, proxy hostname, isolated storage, secret setup, update,
and retention procedure.

### Public client integration (54–55)

Load the script from the separate analytics origin, asynchronously, only when
configured and permitted. Use `data-auto-track="false"` and own the small explicit
tracking adapter: one event per completed public navigation, including the initial
route and back/forward. The allowlist and payload reduction apply to every event.
Do not combine manual events with automatic pageview hooks. Use only public
website ID/config in the browser, never dashboard credentials.
Set `data-do-not-track="true"` as an additional browser preference safeguard.
Sources: [tracker configuration](https://docs.umami.is/docs/tracker-configuration),
[explicit payload API](https://docs.umami.is/docs/tracker-functions).

Ticket 54 adds an explicit pageview adapter to the Next.js root layout. It reads
the runtime-only `UMAMI_ENABLED`, `UMAMI_SCRIPT_URL`, and `UMAMI_WEBSITE_ID`
settings. Tracking defaults off unless `UMAMI_ENABLED=true` and both public
settings are valid. The script URL must point to the separate service's
`/script.js`; non-local script origins must use HTTPS. Local HTTP is accepted
only for loopback/`.localhost` hosts. The website ID is public and is not a
dashboard credential. The production Compose stack does not enable analytics.
Keep production collection off until the deployment's lawful basis, privacy
notice, retention, and consent/opt-out requirements have been resolved.

Only `/`, `/about`, `/contact`, `/blog`, `/blog/<public-slug>`, `/projects`, and
`/projects/<public-slug>` are eligible. Preview, admin, API, and other nested
paths are excluded. Events use the path without query or fragment, generic page
titles, and an external HTTP(S) referrer origin only on the initial public
navigation. Client route changes are tracked once per pathname; rerenders,
query changes, and hash changes do not emit extra views. The adapter queues
navigation while the script loads and discards the queue if loading fails.

For a local synthetic smoke, create a website in the local Umami dashboard and
use its website ID (never the production ID). From `frontend` in PowerShell,
set the runtime values and start the Next.js development server:

```powershell
$env:UMAMI_ENABLED = "true"
$env:UMAMI_SCRIPT_URL = "http://analytics.localhost:3000/script.js"
$env:UMAMI_WEBSITE_ID = "<local Umami website ID>"
npm run dev -- --port 31054
```

Open `http://127.0.0.1:31054`, then use client navigation and browser
back/forward. The Network panel should show one `/api/send` request for each
public pathname and none for query/hash changes or the draft preview route.
Inspect that the JSON contains only `website`, `hostname`, `url`, `title`, and
an optional sanitized `referrer`. Remove the settings or set
`UMAMI_ENABLED=false` to disable tracking.
Outbound anchors send `name="outbound_interest"` and one fixed `data.category`:
`contact_email`, `contact_profile`, `repository`, or `demo`. Contact categories
measure interest only; they do not represent an enquiry. The event contains no
address, destination URL, or link label. Build it as an explicit custom payload
so Umami's default screen/language and other browser fields are omitted.
Ordinary anchor navigation is never prevented or delayed, and tracking failures
are ignored.

In the same local smoke, click the email and professional profile links and a
project's repository and demo links. The Network panel should show the event
name, one category, and minimal public page context in each payload, with no
address, destination URL, or link label. Then stop or block analytics and
repeat: email links should still open the mail client and
profile/repository/demo anchors should still open their
normal destinations. The complete frontend regression suite runs with
`cd frontend; npm test`.

Emit a minimal page payload with `website`, `hostname`, public `url`, generic
`title`, and sanitized `referrer`. Click events add `name="outbound_interest"`
and `data.category`, one of `contact_email`, `contact_profile`, `repository`, `demo`.
Do not spread the tracker's default payload into ours. Leave screen/language and
other unnecessary fields out. Event names/properties are supported by the
[tracker functions](https://docs.umami.is/docs/tracker-functions).

Use ordinary anchors and fire-and-forget tracking with guarded optional calls and
rejection handling. Never await analytics, prevent navigation, retry indefinitely,
or use a tracking redirect. The tagged built-in attribute-based link handler can
wait for collection before navigating; therefore do not use it for our anchors.
Source: [v3.4.1 click handler](https://github.com/umami-software/umami/blob/v3.4.1/src/tracker/index.ts).

### Verification (56)

With the local stack and a synthetic website ID, verify:

1. One initial view and one per client route transition; no duplicates on query/hash
   changes or rerenders. Public blog paths appear in traffic/popular-page reports;
   sanitized external origins appear as sources, subject to browser referrer policy.
2. All four outbound categories appear in event reports. Inspect payloads for no
   personal fields, full outbound URLs, queries, fragments, or private paths.
3. Preview/admin pages produce no events; blocked scripts, rejected/hanging sends,
   offline analytics, and a stopped analytics stack preserve reading and links.
4. No replay/heatmap scripts or cross-site identification. Verify cookie/storage
   behavior and consent/disable mode rather than assuming defaults suffice.
5. Database persistence and restore survive an independent app update; demonstrate
   retention deletion on disposable data without erasing wanted production history.

## Selection verification and remaining inputs

Repeat this read-only source probe in PowerShell; it requires network access but
no credentials, containers, or modifications to upstream:

```powershell
$analyticsBase = 'https://raw.githubusercontent.com/umami-software/umami/v3.4.1'
$analyticsChecks = @{
  'LICENSE' = @('MIT License')
  'docker-compose.yml' = @('postgres:', '/api/heartbeat', 'umami-db-data:')
  'src/tracker/index.ts' = @("config('auto-track')", "getItem('umami.disabled')", 'e.preventDefault()', 'keepalive: true')
  'src/lib/crypto.ts' = @("saltRotation === 'day'")
}
foreach ($analyticsFile in $analyticsChecks.Keys) {
  $analyticsSource = (Invoke-WebRequest "$analyticsBase/$analyticsFile" -UseBasicParsing).Content
  foreach ($analyticsToken in $analyticsChecks[$analyticsFile]) {
    if (!$analyticsSource.Contains($analyticsToken)) { throw "Missing $analyticsToken in $analyticsFile" }
  }
  Write-Output "Verified $analyticsFile"
}
git diff --check
```

On 2026-11-01 the tagged source probe and whitespace check passed. Official
documentation/source review supports the selection; no container, report, or
privacy-control runtime verification is claimed by ticket 52. Live v3 documentation
also describes newer features (for example v3.5 options); use the pinned source
when implementing, and re-review on upgrades. No code changes require app tests
for this ticket. Ticket 53 supplies concrete image digests, local ports, secrets,
and retention procedure. Production host/domain, credentials, operator privacy
decision, and backup destination remain later inputs; nothing was provisioned.
