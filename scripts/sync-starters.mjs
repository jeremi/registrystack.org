import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

// Brings a starters catalogue export into the site. The export comes from
// `registry-starters export-catalogue DIR` in the breg-registry-starters
// repository and holds catalogue.json plus one zip per starter. The zips are
// published as assets of a GitHub release of that repository, not committed
// here, so the site only stores the catalogue with each download pointing at
// its release asset. This script verifies every zip against the catalogue,
// writes src/data/starters.json, and records the export's origin, release tag
// and digest in src/upstream/starters.json so a reviewer can tell which
// revision the published catalogue came from.
//
// Usage: node scripts/sync-starters.mjs EXPORT_DIR --release TAG [--repo PATH]
//   --release TAG  the release of breg-registry-starters that carries the zips
//   --repo PATH    the starters checkout the export was made from; its HEAD and
//                  working-tree state are recorded in the pin file.

const SCHEMA_VERSION = 2;
const DATA_FILE = 'src/data/starters.json';
const PIN_FILE = 'src/upstream/starters.json';
const REPOSITORY_URL = 'https://github.com/registrystack/breg-registry-starters';

const args = process.argv.slice(2);
const exportDir = args.find((arg) => !arg.startsWith('--'));
const optionValue = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};
const repoPath = optionValue('--repo');
const releaseTag = optionValue('--release');

if (!exportDir || !releaseTag) {
  console.error('usage: node scripts/sync-starters.mjs EXPORT_DIR --release TAG [--repo PATH]');
  process.exit(2);
}
const releaseBase = `${REPOSITORY_URL}/releases/download/${releaseTag}`;

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

const cataloguePath = join(exportDir, 'catalogue.json');
if (!existsSync(cataloguePath)) {
  console.error(`missing ${cataloguePath}`);
  process.exit(1);
}
const catalogueBytes = readFileSync(cataloguePath);
const catalogue = JSON.parse(catalogueBytes.toString('utf8'));
if (catalogue.schemaVersion !== SCHEMA_VERSION) {
  console.error(`expected schemaVersion ${SCHEMA_VERSION}, found ${catalogue.schemaVersion}`);
  process.exit(1);
}

const failures = [];
let totalBytes = 0;
for (const starter of catalogue.starters) {
  const zipPath = join(exportDir, starter.download.path);
  if (!existsSync(zipPath)) {
    failures.push(`${starter.id}: missing ${starter.download.path}`);
    continue;
  }
  const bytes = readFileSync(zipPath);
  if (sha256(bytes) !== starter.download.sha256) {
    failures.push(`${starter.id}: sha256 of ${starter.download.path} does not match catalogue.json`);
  }
  if (bytes.length !== starter.download.bytes) {
    failures.push(`${starter.id}: size of ${starter.download.path} does not match catalogue.json`);
  }
  totalBytes += bytes.length;
}
if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

const gitValue = (...gitArgs) =>
  execFileSync('git', ['-C', repoPath, ...gitArgs], { encoding: 'utf8' }).trim();

const source = {
  repository: REPOSITORY_URL,
  release: releaseTag,
  revision: repoPath ? gitValue('rev-parse', 'HEAD') : null,
  // A dirty tree means the export may include changes that are not in `revision`.
  dirty: repoPath ? gitValue('status', '--porcelain').length > 0 : null,
};

// The catalogue is stored as the site reads it: each download is the URL of
// its release asset. The zips are deterministic, so the sha256 in the
// catalogue is the sha256 of the asset.
const siteCatalogue = {
  ...catalogue,
  starters: catalogue.starters.map((starter) => ({
    ...starter,
    download: { ...starter.download, path: `${releaseBase}/${basename(starter.download.path)}` },
  })),
};

mkdirSync(resolve('src/upstream'), { recursive: true });
writeFileSync(resolve(DATA_FILE), `${JSON.stringify(siteCatalogue, null, 2)}\n`);
writeFileSync(
  resolve(PIN_FILE),
  `${JSON.stringify(
    {
      schemaVersion: SCHEMA_VERSION,
      source,
      exportCommand: 'registry-starters export-catalogue',
      catalogueSha256: sha256(catalogueBytes),
      starterCount: catalogue.starters.length,
      syncedAt: new Date().toISOString().slice(0, 10),
    },
    null,
    2,
  )}\n`,
);

console.log(
  `synced ${catalogue.starters.length} starters to ${DATA_FILE}; ${(totalBytes / 1024 / 1024).toFixed(1)} MB of zips verified for ${releaseBase}/; pin in ${PIN_FILE}`,
);
