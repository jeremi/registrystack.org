# Professional licensing starter request service

This Node 24 service accepts the public website form at `/starter-request` and
submits the request to one self-hosted Mautic form. It supports only the
`professional-licensing` starter. The website retains its email request link as
a no-JavaScript fallback and whenever `PUBLIC_STARTER_REQUEST_ENDPOINT` is
unset.

The browser calls this service only. The service sends `DNT: 1` to Mautic and
does not forward the browser's network address, cookies, user agent, or
referrer. It uses a fixed service user agent and a unique request token to
confirm that Mautic saved the matching request. No Mautic API key or browser
tracking script is used.

## Configure the Mautic form

Create one published form in kiosk mode. Configure its fields exactly as
follows; aliases are case-sensitive.

| Alias | Label | Type | Required | Default or mapping | Save result |
| --- | --- | --- | --- | --- | --- |
| `email` | Email | Email | Yes | Map only this field to Contact: Email | Yes |
| `organization` | Organization | Text | No | No contact mapping | Yes |
| `role` | Your role | Text | No | No contact mapping | Yes |
| `message` | What are you trying to do? | Textarea | No | No contact mapping | Yes |
| `starter_id` | Starter | Hidden | Yes | `professional-licensing` | Yes |
| `source_page` | Source page | Hidden | Yes | `/starters/professional-licensing/` | Yes |
| `request_token` | Request reference | Hidden | Yes | No default; the service supplies it | Yes |
| `website` | Leave this empty | Captcha | No | Correct answer is empty | No |

Turn auto-fill off for every field. Do not add form actions, campaign
membership, notifications, or automatic email. Set the post action to a message
with the confirmation `Request received.` Keep Mautic's email transport disabled
with `null://null`; fulfillment and replies are manual.

Mautic kiosk mode and the relay's `DNT: 1` request are both required. The local
acceptance fixture in `tests/fixtures/mautic-starter-form.php` creates this shape
against Mautic 7.2.1 and refuses a non-local instance or an instance with email
enabled.

## Configure the service

The service can run directly with Node 24 or from `server/Dockerfile`. Set these
required environment variables in the runtime environment:

| Variable | Value |
| --- | --- |
| `MAUTIC_BASE_URL` | Private base URL of the Mautic service, for example `http://mautic/` on a shared private Docker network |
| `MAUTIC_FORM_ID` | Positive integer ID of the form configured above |
| `WEBSITE_ORIGIN` | Exact public website origin allowed to submit, for example `https://www.example.org` |

`PORT` defaults to `3000`. `PER_IP_RATE_LIMIT` defaults to 100 requests and
`GLOBAL_RATE_LIMIT` to 300 requests per 15-minute window. These values are
positive integers.

For a local Docker deployment, provide the required variables to Compose and
run:

```sh
docker compose -f server/compose.yaml up --build -d
```

The supplied Compose service runs read-only as an unprivileged user and binds
the container only to `127.0.0.1:${STARTER_REQUEST_PORT:-3000}`. Put an HTTPS
reverse proxy in front of it, publish only `/starter-request`, and keep
`/healthz` available to internal health checks. Do not expose the container
port directly to the internet. Attach the relay and Mautic services to the same
private Docker network. `MAUTIC_BASE_URL` must resolve directly to the Mautic
container on that network; it must not point back through Mautic's public
hostname or public reverse-proxy route. A direct Node deployment starts with:

```sh
node server/starter-request.mjs
```

Build the public site with the external HTTPS route, not the Mautic URL:

```sh
PUBLIC_STARTER_REQUEST_ENDPOINT=https://requests.example.org/starter-request npm run build
```

An invalid or missing path, query string, fragment, credentials, or non-HTTPS
URL fails configuration validation. Leaving the variable unset preserves the
existing email request journey.

## Block native public form submission

The browser must not be able to bypass the relay and post directly to Mautic.
The example [`traefik-form-boundary.example.yaml`](traefik-form-boundary.example.yaml)
is a Traefik dynamic configuration file that gives `/form` and
`/index.php/form` on the public Mautic host a higher-priority router. Its IP
allowlist contains only the unroutable unspecified address, so every routable
client receives `403` before Traefik reaches `noop@internal`.

Replace `mautic.example.org` and `websecure-replace-me` with the deployment's
public Mautic host and TLS entry point. Load the file with Traefik's file
provider. Keep the relay off this public route: its `MAUTIC_BASE_URL` should be
the private service URL such as `http://mautic/`. The website's
`PUBLIC_STARTER_REQUEST_ENDPOINT` remains the external HTTPS relay URL such as
`https://requests.example.org/starter-request`, and `WEBSITE_ORIGIN` remains
the exact website origin such as `https://www.example.org`.

Before setting `PUBLIC_STARTER_REQUEST_ENDPOINT` and enabling the website form:

1. Record the Mautic form-result and Contact counts.
2. From outside the deployment network, send `POST` requests to both
   `https://mautic.example.org/form/submit?ajax=1` and
   `https://mautic.example.org/index.php/form/submit?ajax=1`.
3. Require `403` from both requests and confirm that neither count changed.
4. Submit once through the relay and confirm that exactly one matching form
   result exists and the relay returns success.

This example follows Traefik's documented [file-provider router
configuration](https://doc.traefik.io/traefik/reference/routing-configuration/other-providers/file/),
[explicit router priority](https://doc.traefik.io/traefik/reference/routing-configuration/http/routing/rules-and-priority/#priority-calculation),
and [IP allowlist](https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/ipallowlist/).

## Operating boundaries

The request service accepts only the configured website origin, but CORS is a
browser policy rather than authentication. Keep the native Mautic form routes
blocked at the public reverse proxy as described above. The relay's validation
and limits cannot protect any alternate public path to those routes.

The public reverse proxy owns per-client rate limiting. It must derive the
client address from the direct connection or explicitly trusted upstreams, not
from untrusted forwarded-address headers. The application's
`PER_IP_RATE_LIMIT` uses only the socket peer, so behind the proxy it is a
shared proxy-peer defense, not a per-visitor limit. `GLOBAL_RATE_LIMIT` is an
additional per-instance defense. Both counters are in memory and reset on
restart; a fixed cap on tracked peers bounds memory use.

Application logs do not include submitted fields or browser network addresses,
and startup failures use generic messages. Review reverse-proxy and platform
logging separately. Runtime responses expose generic errors and no Mautic
details.

The service does not send a notification or deliver a starter automatically.
An operator must review saved Mautic results, fulfill the request, and reply
manually.

The relay does not retry automatically. A timeout or lost upstream response
can occur after Mautic has saved the result, and a manual retry uses a new
request token and can create a second result. When a submitter reports an error
or timeout, check recent Mautic results for the same email and submission time
before asking them to try again. Treat repeated rows as separate requests only
after that operator check.

## Verify

Run the repository checks before deployment:

```sh
npm run check
```

This includes unit coverage for validation, request correlation, rate limiting,
upstream failures, and the browser request journey. Run only the browser journey
with `npm run check:starter-request`.

The Mautic acceptance check is optional. It requires an existing disposable
Mautic 7.2.1 installation with its site URL set to `127.0.0.1`, the mailer set
to `null://null`, and no cron jobs or workers running:

```sh
MAUTIC_TEST_CONTAINER=mautic-web-test \
  MAUTIC_TEST_URL=http://127.0.0.1:8080 \
  node scripts/check-starter-request-mautic.mjs
```

The check creates the fixture form in that local container and compares stored
record counts before and after its requests. Its safeguards reject a live
Mautic instance; do not point it at production.
