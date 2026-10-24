# Website enquiries

Website contact invitations and starter pages submit directly to two native
Mautic 7.2.1 forms through a narrow Traefik boundary. There is no request relay
or separate application service. The contact and starter flows retain email
recovery for no-JavaScript use, an unavailable form, or an unset
`PUBLIC_STARTER_REQUEST_ENDPOINT`.

The default form works without tracking consent. A second form may associate a
request with an existing Mautic device after consent. Both forms only capture a
request for manual review. They have no submit actions and do not send mail,
start a Campaign, score a Contact, or deliver a starter.

## Configure the Mautic forms

Create the unlinked form in kiosk mode with these case-sensitive aliases:

| Alias | Label | Type | Required | Default or mapping | Save result |
| --- | --- | --- | --- | --- | --- |
| `email` | Email | Email | Yes | Map only this field to Contact: Email | Yes |
| `organization` | Organization | Text | No | No Contact mapping | Yes |
| `role` | Your role | Text | No | No Contact mapping | Yes |
| `message` | What are you trying to do? | Textarea | No | No Contact mapping | Yes |
| `starter_id` | Starter | Hidden | No | Empty; a starter page supplies its ID | Yes |
| `source_page` | Source page | Hidden | Yes | Empty; the website supplies its canonical path | Yes |
| `request_token` | Request reference | Hidden | Yes | No default; the website supplies it | Yes |
| `request_type` | Request type | Hidden | No | Empty; the website supplies `question`, `service`, `proposal`, `starter`, `privacy`, or `terms` | Yes |
| `request_context` | Request context | Hidden | No | Empty; the website supplies a short page-specific label | Yes |
| `website` | Leave this empty | Captcha | No | Correct answer is empty | No |

Turn auto-fill off for every field. Add no form actions. Set the post action to
the message `Request received.` Keep **Publicly updatable** off for the Contact
Email field. SMTP may be configured separately for controlled operator use,
but these forms must have no actions and no Campaign may send from them.

Create the consented form with the same fields, order, mappings, result-saving
settings, post action, and no actions. Keep kiosk mode off for this form. The
website sends a valid Mautic device ID as the top-level `mautic_device_id` POST
value when current consent and a usable device are present. This field is not
inside `mauticform` and is not saved as a form result.

The website always sends a `privacy` request through the unlinked kiosk form,
even when the browser has accepted tracking and has a usable device ID. A
starter request made directly from a starter page supplies `starter_id`; a
catalogue or general contact invitation may classify the request as `starter`
and preserve its public context while leaving `starter_id` empty.

The email and device ID are self-asserted marketing identity. Their association
supports attribution; it does not authenticate the submitter or prove control
of the mailbox. Repeated submissions can reuse one Contact, so use Form
Submissions or each form's Results screen for request counts.
An unlinked kiosk submission has no new tracking ID, but email matching can
reuse a Contact that already has devices or page history. Kiosk mode does not
erase or detach that pre-existing history.

Keep the existing form aliases when broadening a starter-only deployment to
sitewide enquiries. Rename only their display names to **Website request
(unlinked)** and **Website request (consented)**. Preserving the aliases keeps
the existing result-table names and historical submissions intact.

## Publish only the two submission variants

Load [`traefik-form-boundary.example.yaml`](traefik-form-boundary.example.yaml)
through Traefik's file provider after replacing the example host, entry point,
website origin, form IDs, and backend service. It exposes only these browser
requests:

- `POST /form/submit?formId=1&privacy=kiosk&ajax=1` for the unlinked kiosk form;
- `POST /form/submit?formId=2&privacy=consented&ajax=1` for the consented form; and
- the matching, exact-origin CORS preflight requests.

Use the deployment's actual positive form IDs in place of `1` and `2`. The
allowed POST routers require the exact website `Origin`. Every other public
`/form...` and `/index.php/form...` request is denied at a higher priority than
Mautic's normal router. Do not expose an alternate native submission path.
Traefik's `Query` matcher requires the exact value for each named key but does
not reject an unrelated extra query key. The website endpoint parser accepts
only `formId` and `privacy`, then the submission adapter adds Mautic's required
`ajax=1`.

Mautic selects the submitted form from the URL-encoded
`mauticform[formId]` body field, not from the proxy's query selector. Traefik
does not inspect or remove URL-encoded fields. The adapter sends the matching
body ID and omits `mautic_device_id` on the kiosk path, but another caller can
alter either field. Therefore only these two reviewed forms may be published,
and both must have no actions. Treat every query and body field as untrusted;
self-asserted identity is not an authorization boundary.

Both allowed paths remove incoming `Cookie` and outgoing `Set-Cookie`, disable
caching, limit the request body to 16 KiB, and apply a per-client rate of 100
requests per 15 minutes. The kiosk path also sets `DNT: 1`. The consented path
preserves the browser User-Agent and top-level device value so Mautic can match
the previously consented device. A higher-priority guard returns `403` through
`noop@internal` before Mautic if a consented-form request carries browser
`DNT: 1` or `Sec-GPC: 1`. The website normally selects the kiosk endpoint
whenever either privacy signal is active.

The proxy derives its rate-limit client address from the direct connection. If
another proxy is added in front, configure Traefik's trusted forwarded-header
sources explicitly before relying on the limit as per-visitor protection.
CORS restricts browsers; it does not authenticate a caller.

The native boundary is intentionally smaller than a custom validation service.
The website enforces Email, 254-character Email, 200-character Organization
and Role, and 2,000-character Message limits before submission. The proxy caps
the complete encoded body, while Mautic supplies Email validation and the
`website` honeypot. A caller can bypass browser `maxlength`, so operators must
treat saved text as untrusted input and review it before replying. This is
appropriate for this manually reviewed website inbox; it is not a general
public form platform. The `request_type` and `request_context` values organize
the inbox but remain untrusted text rather than authorization or workflow
state.

The same proxy file preserves the tracking-cookie boundary: on `/mtc...` and
`/mtracking.gif` routes it strips incoming `Cookie` and outgoing `Set-Cookie`.
Keep that middleware off the administrator UI and other authenticated routes.

The example uses Traefik's documented [file-provider router
configuration](https://doc.traefik.io/traefik/reference/routing-configuration/other-providers/file/),
[rule matchers and priority](https://doc.traefik.io/traefik/reference/routing-configuration/http/routing/rules-and-priority/),
[buffering](https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/buffering/),
[headers](https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/headers/),
and [rate limiting](https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/ratelimit/).

## Build the website

Set the unlinked endpoint to its full HTTPS URL, including the exact path and
query. The tracked endpoint is optional, must use the same origin and path, and
must name a distinct positive form ID. Configure only `formId` and `privacy`;
the browser adapter adds `ajax=1` when it sends the native request.

```sh
PUBLIC_STARTER_REQUEST_ENDPOINT='https://mautic.example.org/form/submit?formId=1&privacy=kiosk' \
PUBLIC_STARTER_REQUEST_TRACKED_ENDPOINT='https://mautic.example.org/form/submit?formId=2&privacy=consented' \
PUBLIC_MAUTIC_URL='https://mautic.example.org' \
npm run build
```

Leaving the unlinked endpoint unset preserves the email invitation journeys.
Leaving only the tracked endpoint unset keeps native request capture but sends
every request through the unlinked form. An invalid scheme, path, query,
fragment, credentials, duplicate form ID, or mismatched endpoint origin fails
the site build or browser helper checks.

## Activate and verify

Keep both forms in draft until the proxy boundary is loaded. Then:

1. Confirm no form other than IDs 1 and 2 is published. Record both managed
   forms' result counts and the Contact count.
2. Confirm direct POSTs to `/form/submit` with missing or changed `formId`,
   `privacy`, or `ajax` values, and all `/index.php/form...` requests, receive
   `403` and change no counts.
3. Confirm an `OPTIONS` request from the exact website origin succeeds only for
   one of the two exact query variants. Confirm a different origin receives no
   usable CORS response.
4. Publish only the two reviewed forms, each with no actions, and confirm the
   complete published-form set is exactly IDs 1 and 2. Set the public website
   variables and deploy the site.
5. Without consent, submit once with a fresh synthetic email and confirm one
   row appears in the kiosk form, no row appears in the consented form, and no
   device or page-hit association is created by the submission.
6. With consent and an existing device, submit once and confirm one row appears
   in the consented form and associates with the same Contact and device.
7. Force the consented-route request with `DNT: 1` and `Sec-GPC: 1`
   separately. Both must receive `403` before Mautic, with no result-count
   change. Separately confirm the normal website selects the usable kiosk
   endpoint whenever either signal is present.
8. Confirm allowed form and tracking responses have no `Set-Cookie`, and form
   and tracking requests reach Mautic without an incoming `Cookie`.
9. Confirm the saved result contains the expected Email, Organization, Role,
   Message, optional starter ID, source page, request token, request type, and
   request context. Confirm no Email stat, notification, Campaign membership,
   or outbound message is created by the form.

The browser deliberately does not retry. A timeout can occur after Mautic has
saved a row, so check recent Results in both forms before asking a submitter to
try again. Fulfillment and replies remain manual.

Run `npm run check` before deploying the website. The tests cover endpoint
parsing, fixed native fields, browser validation, consented-device selection,
fallback to the kiosk form, exact result verification, and no automatic retry.

The optional Mautic acceptance check requires a disposable Mautic 7.2.1
installation with a loopback site URL and `null://null` mailer. This restriction
belongs to the isolated synthetic test fixture, not the production mail
configuration:

```sh
MAUTIC_TEST_CONTAINER=mautic-web-test \
  MAUTIC_TEST_URL=http://127.0.0.1:8080 \
  node scripts/check-starter-request-mautic.mjs
```

Its fixture rejects a non-loopback instance or enabled mail. It creates the two
test forms and exercises native submissions, device association, queued page
hits, cookie boundaries, DNT/GPC fallback, and absence of email events. Never
point it at a live Mautic instance.

See [Mautic tracking operations](mautic-tracking.md) for tracking, reporting,
Segments, queue processing, withdrawal, and retention boundaries.
