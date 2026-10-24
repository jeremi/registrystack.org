# Mautic website tracking operations

This guide covers the current Registry Stack website tracking boundary. It
uses Mautic for consented, person-level website activity and request records.
Umami remains the separate source for aggregate, cookie-free website traffic
and outbound-link counts.

Email delivery must remain disabled in Mautic. Starter fulfillment and replies
are manual.

## Mautic 7.2.1 contracts and activation target

This integration targets Mautic 7.2.1. Review of that release's source
establishes these contracts:

- A non-kiosk form submission can associate the submitted Contact with a valid
  Mautic device when `mautic_device_id` is a top-level form POST value.
- A kiosk form submitted with `DNT: 1` records the request without associating
  the submitting browser's device activity.
- After its queued page-hit notification is processed, Mautic records page
  URL, title, referrer, and inbound UTM parameters on the tracked page hit.

Local acceptance checks additionally confirm that the two request forms may
reuse or merge Contacts with the same submitted email address. Contact count
is therefore not request count. Count Form Submissions when measuring
requests.

The website integration adds the consent boundary: it loads the complete
`/mtc.js` tracker only after consent because the website needs no Mautic browser
feature before consent. The separate kiosk and consented form routes preserve
that choice when a visitor submits a request.

Online documentation can describe behavior added after this installed build.
Use the pinned 7.2.1 source for implementation contracts and the activation
checks below for runtime behavior, especially consent loading and device
association.

## Required Mautic configuration

Keep the mailer DSN set to `null://null`. Do not create Email, SMS, push,
notification, Campaign, scoring, or Stage automation for this journey.

Before activation, apply these tracking controls in
**Settings > Configuration**:

- Restrict CORS to the exact public website origin.
- Anonymize stored IP addresses.
- Do not identify visitors by IP address.
- Keep Email and other identity-bearing Contact fields **Publicly updatable**
  off. In 7.2.1 this is the control that prevents asserted identity values in
  tracking URLs from updating those fields; there is no separate tracking-URL
  identification switch.
- Do not configure Google Analytics, Facebook Pixel, or another advertising
  integration through Mautic.
- Keep the built-in bot exclusions enabled.

The website consent layer is the authority for whether tracking runs. Do not
depend on a browser header or a Mautic-side filter as a substitute for the
website's consent decision.

## Adding documentation and demo properties

Use this Mautic instance for all enrolled Registry Stack properties. The full
canonical page URL identifies the property for Reports and Segments; keep the
origin in that URL instead of reducing every property to a relative path.
Enrollment is explicit for each reviewed HTTPS origin. Do not use wildcard
CORS entries for all subdomains or all demo deployments.

The current integration grants consent and stores anonymous device identity
on one origin. It does not yet provide a continuous anonymous journey across
the main website, documentation, and demos. Mautic can combine activity on a
Contact after an explicitly consented identification flow, but that is not
automatic anonymous cross-property recognition.

Before enabling cross-property anonymous attribution, add and verify a shared
consent and identity mechanism for the exact enrolled origins. It must support
withdrawal across those properties, invalidate stale local identifiers, and
check consent before loading the tracker on each property. Update the notice
and consent version to cover the expanded scope. Do not pass email addresses,
Contact IDs, device IDs, or consent tokens through navigation URLs.

Do not solve continuity by setting a broad parent-domain cookie or removing
the proxy cookie boundary. In Mautic 7.2.1, the tracker writes host-only cookies
and origin-scoped browser storage; `cookie_domain` controls server response
cookies, not that storage. A parent-domain cookie is readable and writable by
sibling applications, and a surviving Mautic-host cookie can override the
website's current device ID after withdrawal. Unrelated domains also cannot
reliably share browser storage through third-party cookies.

Each property's page-data adapter must follow this contract:

| Property | Permitted page data | Identification and consent |
| --- | --- | --- |
| Main website | Canonical static paths and public titles; reviewed inbound campaign labels | Current local consent and optional request association |
| Documentation | Public documentation routes and titles; no search text or private query values | Enroll its exact origin and implement the agreed consent and identity mechanism |
| Demos | Explicitly allowlisted public screens or route templates, such as `/records/:recordId`; fixed, nonidentifying titles | Separate demo application accounts from marketing identity; require tracking consent |

Do not copy the website helper unchanged into a demo. It removes query strings
and fragments, but full paths and page titles can still contain personal data
or record identifiers. Disable tracking on sensitive screens, or map them to
safe templates before calling Mautic. Disable campaign-label passthrough in
demos unless their allowed values have been reviewed. Demo form contents,
record details, account identifiers, and credentials must never become page
titles, tracking parameters, or marketing Contact fields.

Acceptance for each enrollment must cover navigation between properties,
consent refusal on arrival, withdrawal and re-consent, storage or tracker
blocking, correct property attribution, and absence of sensitive route data.
Until shared identity passes those checks, label reporting as activity per
property rather than a continuous anonymous journey.

## Configure the two native forms

Create two Mautic forms with the exact field aliases, types, defaults,
and mappings in [the native-form guide](README.md#configure-the-mautic-forms).
Keep auto-fill off. Neither form sends mail, adds Campaign membership, or runs
another submit action.

Configure their behavior as follows:

| Form | Kiosk mode | Browser association | Use |
| --- | --- | --- | --- |
| Unlinked starter request | Yes | None; the proxy injects `DNT: 1` and the website sends no device ID | Every request without valid tracking consent and a valid device |
| Consented starter request | No | The website sends the validated device ID as top-level `mautic_device_id` | Only a request with current tracking consent and a valid device |

Publish exactly one POST route for each form at the reverse proxy. Match the
exact path, form ID, privacy value, `ajax=1`, method, and website Origin. The
configured endpoint omits `ajax`; the browser adapter adds it for Mautic. Deny
every other public `/form...` and `/index.php/form...` request so a caller
cannot bypass the reviewed variants.

These query values select the intended adapter routes; they do not bind the
submitted form. Mautic selects the form from URL-encoded
`mauticform[formId]`, and Traefik does not inspect or remove body fields. The
adapter sends the matching body ID and omits `mautic_device_id` for the kiosk
request. Only forms 1 and 2 may be published, both with no actions, so a direct
caller cannot select another active form through the allowed route. Treat all
body values as untrusted. Self-asserted identity is not an authorization
boundary.

For the consented form, `mautic_device_id` is a sibling of `mauticform`, not a
field inside it:

```text
mautic_device_id=<validated device ID>
mauticform[email]=<submitted email>
mauticform[...]=...
```

Only this valid consent-plus-device path includes a device ID. The browser
chooses the unlinked form whenever consent or a usable device is absent. The
proxy injects `DNT: 1` on that route and removes request cookies. It also injects
The proxy returns `403` before Mautic if a consented-route request carries
`DNT: 1` or `Sec-GPC: 1`. The normal website selects the kiosk route when
either signal is active. The consented route preserves the browser User-Agent
and device value required by Mautic's device signature.

Never put an email address in a tracking URL, tracking query, device value, or
publicly editable Contact field. The email in either request form is asserted
by the submitter. Linking activity to that address supports attribution; it is
not authentication and does not prove that the submitter controls the mailbox.

## Website and proxy boundary

Publish only the two exact native form variants and tracking routes required by
the generated tracker. On both surfaces, strip the incoming `Cookie` header
before proxying and strip `Set-Cookie` from every response. This prevents an old
Mautic source cookie from overriding the website-provided device ID after
withdrawal and re-consent. Keep admin and API routes outside this public
surface.

For the form routes, restrict CORS to the exact website Origin, cap the encoded
body at 16 KiB, and rate-limit each client to 100 requests per 15 minutes. CORS
is a browser control, not caller authentication. The website's `maxlength`
checks, Mautic's Email validation and honeypot, and the proxy body cap are
sufficient for this manually reviewed request inbox, but they are weaker than
server-side field-by-field validation. Treat every saved field as untrusted.

Before consent, the page must not request `/mtc.js`, a tracking pixel, or a
Mautic event endpoint. After consent, load the complete tracker and allow it to
record the current and later page views. The tracker must not receive Email or
another asserted identity in its URL or page-view parameters.

The request form does not wait for the tracker. At submission time, the website
uses the consent and device state already available:

1. With current consent and a valid device, submit to the consented form with
   top-level `mautic_device_id`.
2. Otherwise, submit immediately to the kiosk form with `DNT: 1` and no device
   value.

This fallback keeps the form usable when tracking is declined, blocked, still
loading, or unavailable.

When consent is withdrawn, stop loading or calling the tracker, clear the
Mautic website device and Contact identifiers stored by the client, and hard
reload the page. A later form request must then use the unlinked kiosk form
unless the visitor grants consent again and receives a new valid device.

### Process queued page hits

Mautic's `hit` Messenger transport handles `PageHitNotification` and email-open
tracking, while the separate `email` transport handles outbound mail. A
tracking request first stores a bare page-hit row; processing its notification
later fills the Contact, URL, title, referrer, UTM, and activity data. Reports
and Segments are incomplete until this work finishes.

Mautic defaults the `hit` transport to `sync://`, which processes this work in
the request and needs no consumer. If your stack uses an asynchronous
Doctrine DSN instead, run one dedicated `hit` consumer under a process
supervisor that restarts it after each bounded run:

```sh
php bin/console messenger:consume hit --time-limit=3600 --memory-limit=256M --no-interaction
```

Consume only `hit` when testing this tracking workflow. Keep email delivery
disabled with the null mail transport, and do not configure outreach Campaigns
or run broadcast commands. An existing `email` worker does not enable delivery
while that null transport is enforced. Monitor failed hit messages separately;
do not silently discard them.

## Native operating views

Use Mautic's native screens for person-level operations. Do not reproduce them
in a custom analytics service.

### Page interest

Create a small set of dynamic Segments for identified, consented Contacts.
Every Segment must start with the Contact field **Email** (`email`) set to
**not empty**. This excludes anonymous Contact records from these operator
views. Add these behavior filters:

- **Licensing interest:** **Visited X URL** (`hit_url`) with the **regexp**
  operator and `/(solutions/licensing|starters/professional-licensing)/`.
- **Implementation interest:** **Visited X URL** (`hit_url`) with the
  **contains** operator and `/pricing/`.
- **Recent website activity:** **Visited any URL (date)** (`hit_url_date`) with
  **in the last** and the operational review window chosen by the team.

These are observed page-interest views. They do not establish procurement
intent, organizational authority, qualification, or readiness. Anonymous
and aggregate traffic plus outbound-link counts remain in Umami. Request
counts come from Mautic's native form submissions; this guide does not add an
Umami form-success event or claim an Umami conversion funnel.

Run `mautic:segments:update` on the normal Mautic schedule after the hit
consumer is operating so dynamic Segment membership stays current. No Campaign
cron is required by this guide.

### Starter requests

Mautic 7.2.1 cannot provide one native report containing the saved custom
results from both forms. The shared **Form Submissions** report can filter both
form IDs, but the saved custom values live in a separate result table for each
form.

Use the two per-form Results screens as the fulfillment queues:

1. In **Components > Forms**, open **Results** for the unlinked form.
2. Review the saved email, organization, role, message, `starter_id`,
   `source_page`, and `request_token`, and fulfill each request manually.
3. Repeat the same review for the consented form. Each Results screen can
   export its own rows when an offline working copy is required.

If Report-builder views are preferable, enable **Settings > Configuration >
Form Settings > Use the form result as report data sources**, then create two
**Form Results** Reports, one for each form. Do not combine them: each source
reads only that form's result table.

Create one additional **Form Submissions** Report filtered to both request form
IDs only for combined request counts and shared metadata. Add **Form ID equals
the unlinked form ID**, followed by an **OR Form ID equals the consented form
ID** filter. Include:

- form name or ID;
- submission date;
- current Contact email; and
- Contact ID or other shared Contact metadata needed to follow attribution.

Because only email is mapped to the Contact, this combined report cannot show
organization, role, message, `starter_id`, `source_page`, or `request_token`.
Its Contact email is the Contact's current value; use the per-form Results
screen for the exact email saved with that submission.
Repeated submissions remain separate rows even when Mautic associates them
with one Contact.

### Attribution

Use a **Page hits** Report for consented page activity, with page URL, page
title, referrer, Contact, and hit date. Its source includes anonymous rows. Add
a Contact Email **not empty** filter when the report is an identified-Contact
operator view; do not treat it as anonymous traffic coverage. Use Mautic's
**UTM Codes** Report for `utm_source`, `utm_medium`, `utm_campaign`,
`utm_content`, and `utm_term`.

Do not add UTM parameters to internal Registry Stack links. Internal UTMs would
replace the inbound source that attribution is meant to preserve. Outbound
documentation and demo links may keep their existing UTMs for the destination
site and their existing Umami click event.

The form's fixed `source_page` is available for every request. Earlier page
history and UTM attribution are available on the request Contact only when the
consented device association succeeds. Report the unlinked and linked paths
together for request volume, and distinguish them when evaluating attribution
coverage.

## Activation and verification

Activate tracking only after all of these checks pass:

1. The two forms have identical fields, the required kiosk modes, and no
   actions. No form outside IDs 1 and 2 is published.
2. Email transport is still `null://null`.
3. The proxy accepts only the two exact POST routes and their exact-origin
   preflight requests. All other public `/form...` and `/index.php/form...`
   requests are blocked.
4. A forced consented-route request with `DNT: 1` or `Sec-GPC: 1` receives
   `403` and does not reach Mautic. The normal website uses the kiosk route for
   both signals.
5. Public tracking requests reach Mautic without a `Cookie` header, and public
   tracking responses contain no `Set-Cookie` header.
6. Without consent, a page creates no Mautic request or website identifier and
   a starter request appears only in the unlinked form.
7. The `hit` consumer processes a consented page hit into a row with its URL,
   title, referrer, Contact, and supplied UTM values before the Segment update
   runs.
8. With consent, page hits appear on the device Contact and a starter request
   through the consented form associates with that same device activity.
9. Withdrawing consent clears the website identifiers, a hard reload sends no
   further tracking request, and the starter form still succeeds through the
   unlinked form.
10. Granting consent again produces a new website device ID and does not relink
   the browser to the withdrawn profile through an old Mautic cookie.
11. Both per-form Results screens show their complete saved request fields, and
   the combined Form Submissions Report counts successful requests from both
   form IDs without treating Contact count as submission count.
12. The public privacy notice accurately describes consented Mautic tracking,
   storage, attribution, withdrawal, and the independent no-consent form path.

Use an incognito browser and a new address or test alias for each identity-flow
case. Delete test records only through the agreed operational procedure.

## Retention

A 365-day retention period for anonymous tracking data is a proposal, not a
deployed setting or privacy promise. The owner must approve the retention rule
for anonymous page hits, identified Contacts, form submissions, and audit logs
before it appears in public policy or automation.

Do not schedule `mautic:maintenance:cleanup` yet. The command deletes supported
old records and requires a verified backup, an approved policy, and a reviewed
dry run before any recurring use.

## Official references

- [Mautic 7.2.1 form submission controller](https://github.com/mautic/mautic/blob/8cbb7ef874d52a411ae5a884f979acf6cc320181/app/bundles/FormBundle/Controller/PublicController.php)
- [Mautic 7.2.1 device tracking service](https://github.com/mautic/mautic/blob/8cbb7ef874d52a411ae5a884f979acf6cc320181/app/bundles/LeadBundle/Tracker/Service/DeviceTrackingService/DeviceTrackingService.php)
- [Mautic 7.2.1 form reporting sources](https://github.com/mautic/mautic/blob/8cbb7ef874d52a411ae5a884f979acf6cc320181/app/bundles/FormBundle/EventListener/ReportSubscriber.php)
- [Mautic 7.2.1 per-form Results screen](https://github.com/mautic/mautic/blob/8cbb7ef874d52a411ae5a884f979acf6cc320181/app/bundles/FormBundle/Controller/ResultController.php)
- [Mautic 7.2.1 segment behavior filters](https://github.com/mautic/mautic/blob/8cbb7ef874d52a411ae5a884f979acf6cc320181/app/bundles/LeadBundle/EventListener/FilterOperatorSubscriber.php)
- [Mautic 7.2.1 Page hits reporting source](https://github.com/mautic/mautic/blob/8cbb7ef874d52a411ae5a884f979acf6cc320181/app/bundles/PageBundle/EventListener/ReportSubscriber.php)
- [Mautic 7.2.1 queued page-hit processing](https://github.com/mautic/mautic/blob/8cbb7ef874d52a411ae5a884f979acf6cc320181/app/bundles/PageBundle/Model/PageModel.php)
- [Mautic 7.2.1 page-hit message handler](https://github.com/mautic/mautic/blob/8cbb7ef874d52a411ae5a884f979acf6cc320181/app/bundles/MessengerBundle/MessageHandler/PageHitNotificationHandler.php)
- [Mautic 7.2.1 Messenger worker guidance](https://github.com/mautic/mautic/blob/8cbb7ef874d52a411ae5a884f979acf6cc320181/app/bundles/MessengerBundle/README.md)
- [Mautic 7.2.1 Messenger routing](https://github.com/mautic/mautic/blob/8cbb7ef874d52a411ae5a884f979acf6cc320181/app/config/config.php)
- [Mautic form configuration](https://docs.mautic.org/en/7.2/components/forms.html)
- [Mautic contact tracking](https://docs.mautic.org/en/7.2/contacts/manage_contacts.html)
- [Mautic Segments](https://docs.mautic.org/en/7.2/segments/manage_segments.html)
- [Mautic Reports](https://docs.mautic.org/en/7.2/reports/reports.html)
- [Mautic UTM tags](https://docs.mautic.org/en/7.2/utm_tags/utm_tags_overview.html)
- [Mautic cron jobs and maintenance cleanup](https://docs.mautic.org/en/7.2/configuration/cron_jobs.html)
