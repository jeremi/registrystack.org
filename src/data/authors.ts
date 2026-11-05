// Blog bylines. A post's `author` frontmatter must name an entry here, so a
// typo fails the build instead of quietly crediting the organization.

export type Author =
  | { kind: 'organization'; name: string; url: string }
  | { kind: 'person'; name: string; url: string; bio: string };

const authors: Author[] = [
  { kind: 'organization', name: 'Registry Stack', url: 'https://registrystack.org' },
  {
    kind: 'person',
    name: 'Jeremi Joslin',
    url: 'https://github.com/jeremi',
    bio: 'Jeremi Joslin works on Registry Stack. He also runs OpenSPP, an open-source platform for social protection programmes, sits on the standards committee of the Digital Convergence Initiative (DCI) for social protection, and takes part in the GovStack Digital Registries building block and AI working group.',
  },
];

export function authorFor(name: string): Author {
  const author = authors.find((entry) => entry.name === name);
  if (!author) throw new Error(`unknown blog author "${name}": add it to src/data/authors.ts`);
  return author;
}
