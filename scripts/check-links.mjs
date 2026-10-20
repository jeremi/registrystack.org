import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";

const dist = resolve("dist");
const failures = [];
const warnings = [];

// The lab redeploys on its own schedule, and while it is down the links on the
// already-deployed site are just as dead: blocking this build would not protect
// anyone. Unreachability there warns; everywhere else it fails.
// Starter zips are assets of a release of the starters repository, listed in
// src/upstream/starters.json. The site can be built before that release is
// published, and 84 asset checks against GitHub can hit its rate limit, so an
// unreachable asset warns instead of failing the build.
const warnOnlyOrigins = [
  "https://lab.registrystack.org",
  "https://github.com/registrystack/breg-registry-starters/releases",
];
// The public registers each starter was modelled on come from the starters
// catalogue, not from this site's copy, and several of them answer automated
// requests with 403 or 503. They warn here; fixing one means fixing it in
// breg-registry-starters and syncing the catalogue again.
const catalogueSourceLinks = new Set(
  JSON.parse(readFileSync(resolve("src/data/starters.json"), "utf8")).starters.flatMap(
    (starter) => starter.sourceUrls,
  ),
);
// The Casework documentation pages publish when the Casework merge lands in
// the product repository. Until docs.registrystack.org serves them, these
// links warn instead of failing the build. Empty this list once they resolve.
const warnOnlyLinks = [
  "https://docs.registrystack.org/start/casework/",
  "https://docs.registrystack.org/configure/casework/",
  "https://docs.registrystack.org/operate/casework/",
  "https://docs.registrystack.org/reference/apis/registry-casework/",
];
const isWarnOnly = (href) =>
  warnOnlyLinks.includes(href) ||
  catalogueSourceLinks.has(href) ||
  warnOnlyOrigins.some(
    (origin) => href === origin || href.startsWith(`${origin}/`),
  );

const htmlFiles = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    if (entry.isFile() && extname(path) === ".html") htmlFiles.push(path);
  }
};

if (!existsSync(dist)) {
  console.error("dist/ does not exist. Run npm run build first.");
  process.exit(1);
}

walk(dist);

// The site's own origin. Absolute links to it (canonical tags, self-referencing
// nav) are resolved against the freshly built dist/ rather than fetched over the
// network: they are this build's own pages, which need not be deployed yet for
// the build to be correct.
const siteOrigin = "https://registrystack.org";

const externalLinks = new Set();
const mailtoLinks = new Set();
const mailtoAddresses = new Set();

const resolveInternal = (pathname, file) => {
  const target = pathname.endsWith("/")
    ? join(dist, pathname, "index.html")
    : join(dist, pathname);
  if (!existsSync(target))
    failures.push(`missing internal link target ${pathname} from ${file}`);
};

for (const file of htmlFiles) {
  const html = readFileSync(file, "utf8");
  for (const [, href] of html.matchAll(/\shref="([^"]+)"/g)) {
    if (href.startsWith("#")) continue;
    if (href.startsWith("mailto:")) {
      mailtoLinks.add(href);
      continue;
    }
    if (href === siteOrigin || href.startsWith(`${siteOrigin}/`)) {
      const { pathname } = new URL(href);
      resolveInternal(pathname, file);
      continue;
    }
    if (href.startsWith("http://") || href.startsWith("https://")) {
      externalLinks.add(href);
      continue;
    }
    if (href.startsWith("/")) {
      const { pathname } = new URL(href, siteOrigin);
      resolveInternal(pathname, file);
    }
  }
}

const requiredExternal = [
  "https://docs.registrystack.org/",
  "https://github.com/registrystack/registry-stack",
  "https://github.com/registrystack/registry-stack/security/advisories/new",
  "https://docs.registrystack.org/decisions/registry-relay-retirement-2026-10-03/",
  "https://docs.registrystack.org/products/registry-manifest/",
];

for (const href of requiredExternal) {
  if (!externalLinks.has(href))
    failures.push(`missing required external link: ${href}`);
}

const requiredMailto = ["mailto:contact@registrystack.org"];
for (const href of mailtoLinks) {
  const address = href.slice("mailto:".length).split("?")[0];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
    failures.push(`invalid mailto address: ${href}`);
  } else {
    mailtoAddresses.add(address);
  }
}

for (const href of requiredMailto) {
  const address = href.slice("mailto:".length);
  if (!mailtoAddresses.has(address))
    failures.push(`missing required contact link: ${href}`);
}

for (const href of externalLinks) {
  // Some hosts (the lab among them) reject HEAD outright, so fall back to GET
  // before declaring the link dead.
  let response = await fetch(href, {
    method: "HEAD",
    redirect: "follow",
  }).catch((error) => ({
    ok: false,
    status: `fetch failed: ${error.message}`,
  }));
  if (!response.ok) {
    response = await fetch(href, { method: "GET", redirect: "follow" }).catch(
      (error) => ({
        ok: false,
        status: `fetch failed: ${error.message}`,
      }),
    );
  }
  if (!response.ok) {
    if (isWarnOnly(href)) {
      warnings.push(`external link unreachable ${href}: ${response.status}`);
    } else {
      failures.push(`external link failed ${href}: ${response.status}`);
    }
  }
}

if (warnings.length > 0) {
  console.warn(warnings.map((warning) => `! ${warning}`).join("\n"));
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log(
  `link check passed (${htmlFiles.length} HTML file(s), ${externalLinks.size} external link(s), ${mailtoLinks.size} mailto link(s))`,
);
