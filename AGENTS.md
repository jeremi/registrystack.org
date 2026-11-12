# Registry Stack public website guidance

Before writing or reviewing pages, navigation, calls to action or metadata, read:

1. [README.md](README.md): how the site is built and run, data ownership and commands.
2. The Apps workspace's private `registry-internal`: `current/website.md` holds
   content, voice, claims and page contracts; `runbooks/website-content.md` holds
   the repeatable workflow. Read them from the verified workspace, not an assumed
   sibling of this worktree.
3. Current owning product documentation for actual behavior, maturity and terms.

Keep website strategy, private process, deployment details, buyer information
and findings out of this public repository. Do not create another skill or voice
guide to duplicate project truth. Preserve unrelated work and obey the task's
publication boundary.

Use the applicable `npm` checks in package.json. Layout or behavior changes use
`npm run check` plus actual desktop/mobile inspection. For guidance-only edits,
review wording, references and the diff; a site build does not validate strategy.
