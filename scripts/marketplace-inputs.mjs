// Like check-content.mjs, read the maintained TypeScript data as text so these
// Node entrypoints do not depend on native type stripping or an added loader.
import { readFileSync } from 'node:fs';

const source = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8');
export const startersData = JSON.parse(source('../src/data/starters.json'));
const solutionsSource = source('../src/data/solutions.ts');
const areas = [...solutionsSource.matchAll(
  /key: '([^']+)',\s*slug: '([^']+)',[\s\S]*?kind: '([^']+)'/g,
)].map(([, key, slug, kind]) => ({ key, slug, kind }));
const membership = new Map([...solutionsSource.matchAll(
  /key: '([^']+)',[\s\S]*?starters: \[([^\]]*)\]/g,
)].map(([, key, list]) => [key, [...list.matchAll(/'([^']+)'/g)].map(([, id]) => id)]));

export const registerFamilies = areas.filter((area) => area.kind === 'register-family').map((area) => {
  const starters = membership.get(area.key);
  if (!starters?.length || area.slug !== `/solutions/${area.key}/`) {
    throw new Error(`Cannot read the maintained register-family inputs for ${area.key}.`);
  }
  return { ...area, starters };
});
if (registerFamilies.length !== 7) throw new Error(`Expected seven register-family inputs, read ${registerFamilies.length}; review the data reader if its source format changed.`);
