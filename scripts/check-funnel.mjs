import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { relative as relativePath, resolve } from 'node:path';
import { chromium } from 'playwright';

if (!existsSync(resolve('dist/index.html'))) {
  console.error('dist/index.html does not exist. Run npm run build first.');
  process.exit(1);
}

// The service-answer figure lives on the check-a-fact solution page, and only
// there: one civil register answering several services.
const figureRoute = '/solutions/check-a-fact/';
const listHtml = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const fullPath = resolve(dir, entry.name);
  if (entry.isDirectory()) return listHtml(fullPath);
  return entry.name.endsWith('.html') ? [fullPath] : [];
});
const figurePages = listHtml(resolve('dist'))
  .filter((file) => readFileSync(file, 'utf8').includes('class="service-answers'))
  .map((file) => '/' + relativePath(resolve('dist'), file).replace(/index\.html$/, ''));
if (figurePages.length !== 1 || figurePages[0] !== figureRoute) {
  console.error(`expected the service-answer figure on ${figureRoute} only, found it on ${figurePages.join(', ') || 'no page'}`);
  process.exit(1);
}

const server = createServer(async (request, response) => {
  const { readFile } = await import('node:fs/promises');
  const { extname, join, normalize } = await import('node:path');
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  const pathname = url.pathname.endsWith('/') ? `${url.pathname}index.html` : url.pathname;
  const relative = normalize(pathname).replace(/^\/+/, '');
  const filePath = join(resolve('dist'), relative);
  const type = {
    '.css': 'text/css',
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.svg': 'image/svg+xml',
  }[extname(filePath)] ?? 'application/octet-stream';
  try {
    response.writeHead(200, { 'content-type': type });
    response.end(await readFile(filePath));
  } catch {
    response.writeHead(404);
    response.end('not found');
  }
});

await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
const { port } = server.address();
// The homepage gives a service-owner outline and one illustrative journey,
// then introduces the three products. The detailed service-answer figure
// remains on its own page.
const homeUrl = `http://127.0.0.1:${port}/`;
const url = `http://127.0.0.1:${port}${figureRoute}`;

const browser = await chromium.launch();
const failures = [];

// One source record supports three separate, minimal answers. A refused
// request must remain separate from those signed results.
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  const page = await context.newPage();
  await page.goto(url);

  const structureFailures = await page.evaluate(() => {
    const issues = [];
    const figures = document.querySelectorAll('figure.service-answers');
    if (figures.length !== 1) return [`expected exactly 1 service-answer figure, found ${figures.length}`];
    const figure = figures[0];
    const text = (element) => element?.textContent.trim() ?? '';
    const caption = figure.querySelector('figcaption');
    const captionText = text(caption);
    const captionIds = figure.getAttribute('aria-labelledby')?.split(/\s+/) ?? [];
    if (!caption?.id || !captionIds.includes(caption.id) || !/illustrat|fictional/i.test(captionText) ||
        !/record/i.test(captionText) || !/request|answer|service/i.test(captionText)) {
      issues.push('figure needs an associated caption explaining the illustrative record and service requests');
    }

    const source = figure.querySelector('.source-step .record-card');
    if (!source || figure.querySelectorAll('.record-card').length !== 1) {
      issues.push('figure must show exactly one source record');
    }
    const sourceFields = [...(source?.querySelectorAll('.record-field') ?? [])].map((field) => ({
      label: text(field.querySelector('dt')),
      value: text(field.querySelector('dd')),
    }));
    if (!sourceFields.length || sourceFields.some((field) => !field.label || !field.value)) {
      issues.push('source record must contain labelled, populated fields');
    }
    const identityValues = [...(source?.querySelectorAll('.record-name, .record-id') ?? [])].map(text).filter(Boolean);
    const sourceValues = sourceFields.map((field) => field.value).filter(Boolean);
    const privateValues = sourceFields
      .filter((field) => /date of birth|street address|marital status/i.test(field.label))
      .map((field) => field.value);
    if (privateValues.length !== 3) issues.push('source record must include the three fields kept private in this example');

    const responses = [...figure.querySelectorAll('.returned-answers .service-response')];
    const answers = [...figure.querySelectorAll('.signed-answer')];
    if (responses.length !== 3 || answers.length !== 3) {
      issues.push(`expected 3 separate service responses and signed answers, found ${responses.length} and ${answers.length}`);
    }
    const recipients = new Set();
    const results = new Set();
    for (const [index, response] of responses.entries()) {
      const answer = response.querySelector('.signed-answer');
      const recipient = text(answer?.querySelector('.answer-recipient'));
      const labels = [...(answer?.querySelectorAll('.answer-result dt') ?? [])];
      const values = [...(answer?.querySelectorAll('.answer-result dd') ?? [])];
      if (response.querySelectorAll('.signed-answer').length !== 1 || !text(response.querySelector('.service-question')) ||
          !recipient || !answer?.getAttribute('aria-label')?.trim()) {
        issues.push(`service response ${index + 1} needs its own question, recipient, and labelled signed answer`);
      }
      if (labels.length !== 1 || values.length !== 1 || !text(labels[0]) || !text(values[0])) {
        issues.push(`service response ${index + 1} must contain exactly one labelled result`);
      }
      if (!text(answer?.querySelector('.answer-signature strong')) || !text(answer?.querySelector('.answer-issuer'))) {
        issues.push(`service response ${index + 1} must identify the signature and issuer`);
      }
      recipients.add(recipient);
      results.add(`${text(labels[0])}:${text(values[0])}`);

      // A selected source value may be the agreed result. Other source values,
      // and all private fields and identity details, must stay out of the card.
      const result = text(values[0]);
      const withheld = [...identityValues, ...privateValues, ...sourceValues.filter((value) => value !== result)];
      if (withheld.some((value) => text(answer).toLowerCase().includes(value.toLowerCase()))) {
        issues.push(`service response ${index + 1} discloses source information beyond its permitted result`);
      }
    }
    if (recipients.size !== 3 || results.size !== 3) issues.push('the three responses must have distinct recipients and answers');

    const refusedRequests = figure.querySelectorAll('.refused-request');
    if (refusedRequests.length !== 1) {
      issues.push(`expected exactly 1 refused request, found ${refusedRequests.length}`);
    } else {
      const refused = refusedRequests[0];
      if (refused.closest('.returned-answers, .signed-answer') ||
          refused.querySelector('.signed-answer, .answer-result, .answer-signature, .record-card')) {
        issues.push('the refused request must remain separate and contain no signed answer or returned record');
      }
      if (!text(refused.querySelector('h4')) || !text(refused.querySelector('.refused-status')) ||
          !text(refused.querySelector('.refused-note'))) {
        issues.push('the refused request must explain the question, refusal, and absence of returned information');
      }
      if ([...identityValues, ...sourceValues].some((value) => text(refused).toLowerCase().includes(value.toLowerCase()))) {
        issues.push('the refused request discloses a source value');
      }
    }
    return issues;
  });
  failures.push(...structureFailures);

  await context.close();
}

// The homepage routes readers through its three product cards.
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  const page = await context.newPage();
  await page.goto(homeUrl);

  const homeFigureCount = await page.locator('figure.service-answers, figure.funnel').count();
  if (homeFigureCount !== 0) {
    failures.push(`expected no service-answer figure on the homepage, found ${homeFigureCount}`);
  }

  const homeUseCaseCards = await page.locator('.use-case, .scenario-card').count();
  if (homeUseCaseCards !== 0) {
    failures.push(`expected no full use-case cards on the homepage, found ${homeUseCaseCards}`);
  }

  const homeOverviewFailures = await page.evaluate(() => {
    const issues = [];
    const outline = document.querySelector('figure.service-outline');
    if (!outline || document.querySelectorAll('figure.service-outline').length !== 1) {
      issues.push('expected exactly one service outline on the homepage');
    } else {
      const labelledBy = outline.getAttribute('aria-labelledby')?.split(/\s+/) ?? [];
      if (labelledBy.length < 2 || labelledBy.some((id) => !document.getElementById(id)?.textContent.trim())) {
        issues.push('service outline must reference its visible title and illustrative caption');
      }
      if (outline.querySelectorAll('ol > li').length !== 4) {
        issues.push('service outline must show the four roles from application to permitted check');
      }
    }
    const journey = document.querySelector('figure.register-week');
    if (!journey || document.querySelectorAll('figure.register-week').length !== 1) {
      issues.push('expected exactly one example journey on the homepage');
    } else {
      const describedBy = journey.getAttribute('aria-describedby')?.split(/\s+/) ?? [];
      if (describedBy.length !== 1 || describedBy.some((id) => !document.getElementById(id)?.textContent.trim())) {
        issues.push('example journey must reference its fictional-record caption');
      }
      if (journey.querySelectorAll('.day-step').length !== 4) {
        issues.push('example journey must keep request, review, update and check as separate steps');
      }
    }
    return issues;
  });
  failures.push(...homeOverviewFailures);

  const solutionCards = await page.locator('.home-solution-card').count();
  if (solutionCards !== 3) {
    failures.push(`expected 3 homepage product cards, found ${solutionCards}`);
  }

  await context.close();
}

// The static explanation must be readable and exposed to assistive technology
// on desktop and mobile, including without JavaScript and with reduced motion.
for (const viewport of [{ width: 1440, height: 1200 }, { width: 390, height: 900 }]) {
  for (const mode of [
    { name: 'default', options: {} },
    { name: 'no JavaScript', options: { javaScriptEnabled: false } },
    { name: 'reduced motion', options: { reducedMotion: 'reduce' } },
  ]) {
    const context = await browser.newContext({ viewport, ...mode.options });
    const page = await context.newPage();
    await page.goto(url);
    const visibilityFailures = await page.locator('figure.service-answers').evaluateAll((figures) => {
      if (figures.length !== 1) return ['service-answer figure is missing or duplicated'];
      if (figures[0].querySelectorAll('.record-card').length !== 1 ||
          figures[0].querySelectorAll('.signed-answer').length !== 3 ||
          figures[0].querySelectorAll('.refused-request').length !== 1 || !figures[0].querySelector('figcaption')) {
        return ['source record, three signed answers, refusal, and caption must all be present'];
      }
      const elements = [...figures[0].querySelectorAll([
        'figcaption', '.flow-label', '.source-step h3', '.record-type', '.record-id', '.record-name',
        '.record-field dt', '.record-field dd', '.source-note', '.gateway-step h3',
        '.gateway-step p', '.gateway-step h4', '.answers-heading h3', '.service-question',
        '.answer-recipient', '.answer-result dt', '.answer-result dd',
        '.answer-signature strong', '.answer-issuer', '.flow-notes p',
      ].join(', '))];
      const issues = [];
      for (const element of elements) {
        const label = element.textContent.trim().slice(0, 70);
        if (element.closest('[aria-hidden="true"], [inert]')) {
          issues.push(`meaningful content is hidden from assistive technology: ${label}`);
        }
        const bounds = element.getBoundingClientRect();
        let hidden = bounds.width <= 0 || bounds.height <= 0;
        for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
          const style = getComputedStyle(ancestor);
          if (style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) <= 0.01) hidden = true;
        }
        if (hidden) issues.push(`content is not visible: ${label}`);
        if (bounds.left < -1 || bounds.right > window.innerWidth + 1) {
          issues.push(`content extends beyond the viewport: ${label}`);
        }
      }
      return issues;
    });
    failures.push(...visibilityFailures.map((failure) => `${viewport.width}px, ${mode.name}: ${failure}`));
    await context.close();
  }
}

await browser.close();
server.close();

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log('service-answer figure check passed');
