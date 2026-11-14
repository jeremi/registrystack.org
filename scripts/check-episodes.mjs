// Built-output check for the episodes pages, the video channel link and the
// email sign-up. It builds the site into temporary folders in three states and
// asserts each one:
//   zero      no episode (the shipped state), sign-up setting present
//   fixtures  sample episodes and a sample channel, sign-up setting absent
//   signup    sample episodes, sample channel and the sign-up setting
// The sample episodes live under tests/fixtures/episodes and load only when
// SITE_TEST_FIXTURES=episodes is set (see src/lib/test-fixtures.ts). The
// sign-up endpoint is intercepted in the browser; nothing leaves the machine.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, symlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cache = join(root, 'node_modules/.cache');
await mkdir(cache, { recursive: true });
const scratch = await mkdtemp(join(cache, 'episodes-'));
const endpoint = 'https://email-signup.example.test/form/submit?formId=3&privacy=kiosk';
const networkEndpoint = `${endpoint}&ajax=1`;
const filmHost = 'https://video.example.test/';

const baseEnv = {
  ...process.env,
  PUBLIC_MARKETPLACE_MIGRATION_ENABLED: '',
  MARKETPLACE_INDEXING_DECISION: '',
  PUBLIC_STARTER_REQUEST_ENDPOINT: '',
  PUBLIC_STARTER_REQUEST_TRACKED_ENDPOINT: '',
  PUBLIC_UMAMI_WEBSITE_ID: '',
  PUBLIC_MAUTIC_URL: '',
};
const states = {
  zero: { SITE_TEST_FIXTURES: '', PUBLIC_EMAIL_SIGNUP_ENDPOINT: endpoint },
  fixtures: { SITE_TEST_FIXTURES: 'episodes', PUBLIC_EMAIL_SIGNUP_ENDPOINT: '' },
  signup: { SITE_TEST_FIXTURES: 'episodes', PUBLIC_EMAIL_SIGNUP_ENDPOINT: endpoint },
};
const builds = {};
for (const [name, env] of Object.entries(states)) {
  const dist = join(scratch, `${name}-dist`);
  const build = spawnSync('npm', ['run', 'build', '--', '--outDir', dist], { cwd: root, encoding: 'utf8', env: { ...baseEnv, ...env } });
  assert.equal(build.status, 0, `${name} build failed: ${build.stderr || build.stdout}`);
  builds[name] = { dist, output: `${build.stdout}\n${build.stderr}` };
}

const page$ = (dist, path) => readFile(join(dist, path, 'index.html'), 'utf8');
const textOf = (html) => html.replace(/<(script|style)\b[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&rsquo;/g, '’').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

// Embedded or third-party content: an iframe, embed or object, or a script
// loaded from another origin.
export function outsideContent(html) {
  const found = [...html.matchAll(/<(iframe|embed|object)\b/gi)].map(([, tag]) => `<${tag.toLowerCase()}>`);
  for (const [, src] of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)) {
    const origin = new URL(src, 'https://registrystack.org/').origin;
    if (origin !== 'https://registrystack.org') found.push(`<script src="${src}">`);
  }
  return found;
}
assert.deepEqual(outsideContent('<p>x</p><script src="/_astro/a.js"></script>'), []);
assert.deepEqual(outsideContent('<iframe src="https://x.example/"></iframe><object></object>'), ['<iframe>', '<object>']);
assert.deepEqual(outsideContent('<script type="module" src="https://cdn.example/x.js"></script>'), ['<script src="https://cdn.example/x.js">']);

// ---- zero episodes: nothing about episodes, and a quiet build.
{
  const { dist, output } = builds.zero;
  assert.equal(existsSync(join(dist, 'episodes')), false, 'no English episodes page without a published episode');
  assert.equal(existsSync(join(dist, 'fr/episodes')), false, 'no French episodes page without a published episode');
  assert.doesNotMatch(await readFile(join(dist, 'sitemap-0.xml'), 'utf8'), /episodes/);
  for (const path of ['', 'fr', 'contact', 'blog', 'privacy', 'faq']) {
    const html = await page$(dist, path);
    assert.doesNotMatch(html, /href="(\/fr)?\/episodes\//, `${path || 'home'} links no episodes page`);
    assert.doesNotMatch(html, /Video channel|Chaîne vidéo/, `${path || 'home'} shows no channel link`);
    assert.doesNotMatch(html, /data-email-signup/, `${path || 'home'} shows no sign-up`);
  }
  const privacy = textOf(await page$(dist, 'privacy'));
  assert.doesNotMatch(privacy, /email updates/i, 'the privacy page says nothing of email updates with no episodes, even with the setting present');
  assert.equal(await page$(dist, 'privacy').then((html) => html.includes('privacy-email-updates')), false);
  assert.ok(privacy.includes('Effective date: November 12, 2026.'), 'the privacy date is unchanged with no addition on');
  assert.doesNotMatch(privacy, /video (channel|service)/i, 'the privacy page says nothing of a video service with no addition on');
  assert.doesNotMatch(output, /warn/i, 'a build with no episodes logs no warning');
}

// ---- fixtures: both pages, no sign-up.
{
  const { dist } = builds.fixtures;
  const sitemap = await readFile(join(dist, 'sitemap-0.xml'), 'utf8');
  assert.match(sitemap, /<loc>https:\/\/registrystack\.org\/episodes\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/registrystack\.org\/fr\/episodes\/<\/loc>/);
  const expected = {
    en: { path: 'episodes', title: 'Episodes | Registry Stack', heading: 'Episodes',
      lead: 'The short written version of each of our films about building public services with Registry Stack. Newest first.',
      titles: ['Fixture episode two', 'Fixture episode one'], dates: ['14 November 2026', '1 October 2026'],
      links: ['Watch episode 2 on the video channel', 'Watch episode 1 on the video channel'], draft: 'Fixture draft episode' },
    fr: { path: 'fr/episodes', title: 'Épisodes | Registry Stack', heading: 'Épisodes',
      lead: 'La version écrite, en bref, de chacun de nos films sur la création de services publics avec Registry Stack. Les plus récents d’abord.',
      titles: ['Épisode fixture deux', 'Épisode fixture un'], dates: ['14 novembre 2026', '1er octobre 2026'],
      links: ['Regarder l’épisode 2 sur la chaîne vidéo', 'Regarder l’épisode 1 sur la chaîne vidéo'], draft: 'Épisode fixture brouillon' },
  };
  for (const [lang, want] of Object.entries(expected)) {
    const html = await page$(dist, want.path);
    assert.match(html, new RegExp(`<title>${want.title}</title>`));
    assert.match(html, new RegExp(`<h1[^>]*>${want.heading}</h1>`));
    const text = textOf(html);
    assert.ok(text.includes(want.lead), `${lang} lead`);
    const order = [...want.titles, ...want.dates, ...want.links].map((item) => text.indexOf(item));
    assert.ok(order.every((index) => index >= 0), `${lang} shows ${[...want.titles, ...want.dates, ...want.links].join(' | ')}`);
    assert.ok(order[0] < order[1] && order[2] < order[3], `${lang} lists the newest episode first`);
    assert.equal(text.includes(want.draft), false, `${lang} leaves out the draft`);
    assert.equal((html.match(/<article\b/g) ?? []).length, 2);
    assert.match(html, new RegExp(`href="${filmHost}watch/2-${lang}"`));
    assert.deepEqual(outsideContent(html), [], `${lang} episodes page has no embedded or third-party content`);
    assert.doesNotMatch(html, /data-email-signup/, `${lang} shows no sign-up without the setting`);
  }
  // Footer, header switch and channel link.
  const home = await page$(dist, '');
  assert.match(home, /<a href="\/episodes\/"[^>]*>Episodes<\/a>/);
  assert.match(home, /<a href="https:\/\/video\.example\.test\/channel"[^>]*>Video channel<\/a>/);
  const frenchHome = await page$(dist, 'fr');
  assert.match(frenchHome, /<a href="\/fr\/episodes\/"[^>]*>Épisodes<\/a>/);
  assert.match(frenchHome, /<a href="https:\/\/video\.example\.test\/channel"[^>]*>Chaîne vidéo<\/a>/);
  assert.match(await page$(dist, 'episodes'), /class="language-switch"[^>]*href="\/fr\/episodes\/"|href="\/fr\/episodes\/"[^>]*class="language-switch"/);
  assert.match(await page$(dist, 'fr/episodes'), /class="language-switch"[^>]*href="\/episodes\/"|href="\/episodes\/"[^>]*class="language-switch"/);
  assert.doesNotMatch(frenchHome.match(/<a href="https:\/\/video\.example\.test\/channel"[^>]*>/)[0], /hreflang/, 'the channel link names no language');
  assert.doesNotMatch(home.match(/<a href="https:\/\/video\.example\.test\/channel"[^>]*>/)[0], /hreflang/);
  const fixturePrivacy = textOf(await page$(dist, 'privacy'));
  assert.doesNotMatch(fixturePrivacy, /email updates/i, 'the privacy page says nothing of email updates without the setting');
  assert.ok(fixturePrivacy.includes('It also links to our video channel and to films on it, which a separate video service hosts; this site does not embed that service’s player.'));
  assert.ok(fixturePrivacy.includes('Effective date: December 1, 2026.'));
}

// ---- the repository's own build, when present, holds no sample content.
async function* htmlFiles(folder) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(path);
    else if (entry.name.endsWith('.html')) yield path;
  }
}
if (existsSync(join(root, 'dist'))) {
  for await (const file of htmlFiles(join(root, 'dist'))) {
    assert.doesNotMatch(await readFile(file, 'utf8'), /example\.test/, `${file} holds sample test content`);
  }
}

// ---- the French check on each state's output.
async function frenchCheck(name, pairs) {
  const folder = await mkdtemp(join(scratch, `french-${name}-`));
  await symlink(builds[name].dist, join(folder, 'dist'));
  const run = spawnSync('node', [join(root, 'scripts/check-french.mjs')], { cwd: folder, encoding: 'utf8' });
  assert.equal(run.status, 0, `${name}: ${run.stderr || run.stdout}`);
  assert.match(run.stdout, new RegExp(`French check passed \\(${pairs} reciprocal page pairs\\)`));
}
await frenchCheck('zero', 32);
await frenchCheck('fixtures', 33);
await frenchCheck('signup', 33);

// ---- sign-up: wording, placement, submission, failure, honeypot, no tracking.
const serve = (dist) => createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  const file = resolve(dist, `.${path.endsWith('/') ? `${path}index.html` : path}`);
  if (!file.startsWith(`${dist}${sep}`)) { response.writeHead(404).end(); return; }
  try {
    const body = await readFile(file);
    response.writeHead(200, { 'content-type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }[extname(file)] ?? 'application/octet-stream' }).end(body);
  } catch { response.writeHead(404).end(); }
});
const server = serve(builds.signup.dist);
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const aliases = ['email', 'language', 'source_page'];
const succeed = (data) => ({ success: 1, results: Object.fromEntries(aliases.map((alias) => [alias, data[`mauticform[${alias}]`]])) });
const cors = { 'access-control-allow-origin': origin };
try {
  const html = { en: await page$(builds.signup.dist, 'episodes'), fr: await page$(builds.signup.dist, 'fr/episodes') };
  for (const lang of ['en', 'fr']) {
    assert.deepEqual(outsideContent(html[lang]), [], `${lang} episodes page with the sign-up has no embedded or third-party content`);
    assert.ok(html[lang].lastIndexOf('<article') < html[lang].indexOf('data-email-signup'), `${lang} sign-up sits below the list`);
  }
  const privacy = await page$(builds.signup.dist, 'privacy');
  assert.match(privacy, /<h3 id="privacy-email-updates"[^>]*>Email updates<\/h3>/);
  assert.ok(textOf(privacy).includes('If you sign up for email updates, we store your email address, the language of the page you signed up on, that page’s address and the time of your sign-up in our self-hosted Mautic system.'));
  assert.ok(textOf(privacy).includes('The notes carry no open or click tracking.'));
  assert.ok(textOf(privacy).includes('Signing up does not turn on optional visit tracking: the sign-up sends no browser identifier and does not attach your current visits. If you have also sent us an enquiry or request with the same address, Mautic can keep both on one contact record, together with any visit history already attached to it.'));
  assert.ok(textOf(privacy).includes('Email update details are kept in our self-hosted Mautic system while you are signed up. Unsubscribing stops the notes but does not automatically delete those details; you can request their deletion through the privacy contact form.'));
  assert.ok(textOf(privacy).includes('It also links to our video channel and to films on it, which a separate video service hosts; this site does not embed that service’s player.'));
  assert.ok(textOf(privacy).includes('Effective date: December 1, 2026.'));
  assert.match(privacy, /There is no automatic marketing signup\./, 'the enquiry wording stays');
  assert.match(privacy, /Submitting an enquiry does not sign you up for email\s+marketing\./, 'the contact form still subscribes nobody');

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  // Accepted tracking and a stored browser identifier must not reach the sign-up.
  await context.addInitScript(() => {
    localStorage.setItem('registrystack.marketing-tracking', JSON.stringify({ version: 1, choice: 'accepted', expiresAt: Date.now() + 86400000 }));
    localStorage.setItem('mautic_device_id', 'a'.repeat(23));
  });
  // A cookie for the sign-up server must not be sent with the sign-up.
  await context.addCookies([{ name: 'probe', value: '1', url: 'https://email-signup.example.test/', sameSite: 'None', secure: true }]);
  const page = await context.newPage();
  const browserErrors = [];
  const outbound = [];
  const submissions = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('request', (request) => { if (!request.url().startsWith(origin)) outbound.push(request); });
  let releaseFirst;
  const firstReleased = new Promise((done) => { releaseFirst = done; });
  let held = false;
  await page.route(networkEndpoint, async (route) => {
    const data = Object.fromEntries(new URLSearchParams(route.request().postData()));
    submissions.push(data);
    if (!held) { held = true; await firstReleased; }
    await route.fulfill({ json: succeed(data), headers: cors });
  });

  // English: wording, accessibility, submission.
  await page.goto(`${origin}/episodes/?utm_source=example#top`);
  const signup = page.locator('[data-email-signup]');
  assert.equal(await signup.getByRole('heading', { level: 2, name: 'Email updates' }).count(), 1);
  assert.ok((await signup.textContent()).includes('A short note about once a month: what we published and what changed in Registry Stack.'));
  assert.equal(await signup.locator('#email-signup-privacy a').getAttribute('href'), '/privacy/#privacy-email-updates');
  assert.equal(await signup.locator('#email-signup-privacy').textContent().then((value) => value.replace(/\s+/g, ' ').trim()),
    'We use your email address only to send these notes. Signing up does not turn on visit tracking. Every note has an unsubscribe link. See the privacy policy.');
  assert.equal(await signup.getByRole('checkbox').count(), 0);
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `episodes page fits ${width}px`);
  }
  const axe = await new AxeBuilder({ page }).analyze();
  assert.deepEqual(axe.violations.map(({ id, help }) => `${id}: ${help}`), [], 'English episodes page passes the accessibility rules');
  const emailInput = signup.getByRole('textbox', { name: 'Email address' });
  assert.equal(await emailInput.getAttribute('aria-describedby'), 'email-signup-privacy');
  assert.equal(await signup.locator('form').getAttribute('aria-describedby'), null);
  assert.equal(await signup.locator('form').getAttribute('method'), 'post');
  assert.equal(await signup.locator('[data-email-signup-no-script]').isVisible(), false, 'the script note is hidden when scripts run');
  // The browser reports an address the code would refuse; nothing is sent.
  await emailInput.fill('name@intranet');
  await signup.getByRole('button', { name: 'Sign up' }).click();
  assert.equal(await emailInput.evaluate((input) => input.validity.patternMismatch), true);
  assert.deepEqual(submissions, []);
  await emailInput.fill('reader@example.invalid');
  await signup.getByRole('button', { name: 'Sign up' }).click();
  await signup.locator('[data-email-signup-sending]').waitFor({ state: 'visible' });
  assert.equal(await signup.locator('[data-email-signup-sending]').textContent(), 'Sending…');
  releaseFirst();
  await signup.locator('[data-email-signup-success]').waitFor({ state: 'visible' });
  assert.equal(await signup.locator('[data-email-signup-sending]').isVisible(), false);
  assert.equal(await signup.locator('[data-email-signup-success]').textContent(), 'Almost done. Check your inbox for an email with a link to confirm your address.');
  assert.deepEqual(submissions, [{
    'mauticform[email]': 'reader@example.invalid',
    'mauticform[language]': 'en',
    'mauticform[source_page]': '/episodes/',
    'mauticform[website]': '',
    'mauticform[formId]': '3',
  }]);
  assert.equal(outbound.length, 1, 'only the sign-up endpoint is contacted');
  const sentHeaders = await outbound[0].allHeaders();
  assert.equal(sentHeaders['referer'], undefined);
  assert.equal(sentHeaders['cookie'], undefined);
  assert.equal(await signup.locator('[data-email-signup-error]').isVisible(), false);

  // The privacy link reaches the section.
  await page.goto(`${origin}/privacy/#privacy-email-updates`);
  assert.equal(await page.locator('#privacy-email-updates').count(), 1);

  // A failed sign-up shows the error, keeps the address and can be retried.
  await page.unroute(networkEndpoint);
  await page.route(networkEndpoint, (route) => route.fulfill({ json: { success: 0 }, headers: cors }));
  await page.goto(`${origin}/episodes/`);
  const retrySignup = page.locator('[data-email-signup]');
  await retrySignup.getByRole('textbox', { name: 'Email address' }).fill('retry@example.invalid');
  await retrySignup.getByRole('button', { name: 'Sign up' }).click();
  await retrySignup.locator('[data-email-signup-error]').waitFor({ state: 'visible' });
  assert.equal(await retrySignup.locator('[data-email-signup-error]').textContent(), 'We could not confirm your sign-up. Please try again later.');
  assert.equal(await retrySignup.getByRole('textbox', { name: 'Email address' }).inputValue(), 'retry@example.invalid');
  assert.equal(await retrySignup.getByRole('button', { name: 'Sign up' }).isEnabled(), true);
  assert.equal(await retrySignup.locator('[data-email-signup-success]').isVisible(), false);

  // A filled honeypot sends nothing and shows the normal confirmation.
  submissions.length = 0;
  await page.unroute(networkEndpoint);
  await page.route(networkEndpoint, async (route) => {
    submissions.push(Object.fromEntries(new URLSearchParams(route.request().postData())));
    await route.fulfill({ json: { success: 0 }, headers: cors });
  });
  await page.goto(`${origin}/episodes/`);
  const botSignup = page.locator('[data-email-signup]');
  await botSignup.getByRole('textbox', { name: 'Email address' }).fill('bot@example.invalid');
  await botSignup.locator('input[name="website"]').evaluate((input) => { input.value = 'https://spam.example/'; });
  await botSignup.getByRole('button', { name: 'Sign up' }).click();
  await botSignup.locator('[data-email-signup-success]').waitFor({ state: 'visible' });
  assert.deepEqual(submissions, []);

  // French: wording, accessibility, submission.
  submissions.length = 0;
  await page.unroute(networkEndpoint);
  await page.route(networkEndpoint, async (route) => {
    const data = Object.fromEntries(new URLSearchParams(route.request().postData()));
    submissions.push(data);
    await route.fulfill({ json: succeed(data), headers: cors });
  });
  await page.goto(`${origin}/fr/episodes/`);
  assert.equal(await page.locator('html').getAttribute('lang'), 'fr');
  const frenchSignup = page.locator('[data-email-signup]');
  assert.equal(await frenchSignup.getByRole('heading', { level: 2, name: 'Nouvelles par courriel' }).count(), 1);
  assert.equal(await frenchSignup.locator('#email-signup-privacy a').getAttribute('hreflang'), 'en');
  assert.equal(await frenchSignup.locator('#email-signup-privacy').textContent().then((value) => value.replace(/\s+/g, ' ').trim()),
    'Nous utilisons votre adresse électronique uniquement pour vous envoyer ces notes. L’abonnement n’active pas le suivi des visites. Chaque note contient un lien de désabonnement. Voir la politique de confidentialité (en anglais).');
  const frenchAxe = await new AxeBuilder({ page }).analyze();
  assert.deepEqual(frenchAxe.violations.map(({ id, help }) => `${id}: ${help}`), [], 'French episodes page passes the accessibility rules');
  await frenchSignup.getByRole('textbox', { name: 'Adresse électronique' }).fill('lecteur@example.invalid');
  await frenchSignup.getByRole('button', { name: 'S’abonner' }).click();
  await frenchSignup.locator('[data-email-signup-success]').waitFor({ state: 'visible' });
  assert.equal(await frenchSignup.locator('[data-email-signup-success]').textContent(), 'Presque terminé. Consultez votre boîte de réception : un message contient un lien pour confirmer votre adresse.');
  assert.deepEqual(submissions, [{
    'mauticform[email]': 'lecteur@example.invalid',
    'mauticform[language]': 'fr',
    'mauticform[source_page]': '/fr/episodes/',
    'mauticform[website]': '',
    'mauticform[formId]': '3',
  }]);
  assert.equal(outbound.every((request) => request.url().startsWith(networkEndpoint) || request.url().startsWith(origin)), true);
  assert.equal(outbound.every((request) => !request.url().startsWith(filmHost)), true, 'no film address is loaded');
  assert.deepEqual(browserErrors, []);
  await context.close();

  // Without scripts the form stays disabled instead of posting anywhere.
  const noJs = await browser.newContext({ javaScriptEnabled: false });
  const plain = await noJs.newPage();
  await plain.goto(`${origin}/episodes/`);
  assert.equal(await plain.locator('[data-email-signup] form').isVisible(), false, 'the form is hidden without scripts');
  assert.equal(await plain.locator('[data-email-signup-no-script]').isVisible(), true);
  assert.equal(await plain.locator('[data-email-signup-no-script]').textContent(), 'The sign-up form needs JavaScript.');
  await noJs.close();
  console.log('Episodes checks passed: zero-episode build is silent and has no trace; both pages, order, drafts, footer, channel link, alternates, French pairs (32 then 33), no embedded content, privacy wording, sign-up submission, failure, honeypot, no tracking, accessibility, mobile and no-JS.');
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
}
