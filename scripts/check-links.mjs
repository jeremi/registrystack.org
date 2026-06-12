import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";

const dist = resolve("dist");
const failures = [];

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
  "https://lab.registrystack.org/",
  "https://github.com/jeremi/registry-relay",
  "https://github.com/jeremi/registry-notary",
  "https://github.com/jeremi/registry-manifest",
];

for (const href of requiredExternal) {
  if (!externalLinks.has(href))
    failures.push(`missing required external link: ${href}`);
}

const requiredMailto = ["mailto:jeremi@joslin.fr"];
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
    failures.push(`external link failed ${href}: ${response.status}`);
  }
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log(
  `link check passed (${htmlFiles.length} HTML file(s), ${externalLinks.size} external link(s), ${mailtoLinks.size} mailto link(s))`,
);
