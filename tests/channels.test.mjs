// Run with: node --test tests/channels.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  channelsPrivacyDate,
  configuredVideoChannelUrl,
  privacyEffectiveDate,
  validateVideoChannelUrl,
  videoChannelUrl,
} from '../src/data/channels.ts';

test('the repository ships without a video channel, so the site shows no channel link', () => {
  assert.equal(videoChannelUrl, undefined);
  assert.equal(configuredVideoChannelUrl(), undefined);
});

test('a video channel address is an HTTPS address without credentials', () => {
  assert.equal(validateVideoChannelUrl(undefined), undefined);
  assert.equal(validateVideoChannelUrl('https://video.example.org/@channel'), 'https://video.example.org/@channel');
  for (const bad of [
    '',
    'not a url',
    'http://video.example.org/@channel',
    'ftp://video.example.org/',
    'https://user:secret@video.example.org/',
    'https://user@video.example.org/',
    'javascript:alert(1)',
  ]) {
    assert.throws(() => validateVideoChannelUrl(bad), /video channel/i, `rejects ${JSON.stringify(bad)}`);
  }
});

test('the footer links the channel as an ordinary outbound link in both languages, only when it is set', async () => {
  const footer = await readFile(new URL('../src/components/SiteFooter.astro', import.meta.url), 'utf8');
  assert.match(footer, /configuredVideoChannelUrl\(\)/);
  assert.match(footer, /'Video channel'/);
  assert.match(footer, /'Chaîne vidéo'/);
  assert.match(footer, /videoChannelHref \?\s*\[/, 'the entry exists only when a channel is set');
  assert.doesNotMatch(footer, /<iframe|<embed|<object|<script\s+src/i);
});

test('a channel address carrying a share parameter is refused, other parameters stay allowed', () => {
  for (const bad of [
    'https://video.example.org/@channel?si=abc',
    'https://video.example.org/@channel?feature=share',
    'https://video.example.org/@channel?utm_source=x',
    'https://video.example.org/@channel?a=1&UTM_medium=x',
  ]) {
    assert.throws(() => validateVideoChannelUrl(bad), /video channel.*(share|tracking)/i, bad);
  }
  assert.equal(validateVideoChannelUrl('https://video.example.org/c?list=abc'), 'https://video.example.org/c?list=abc');
});

test('the footer channel link carries no language attribute in either language', async () => {
  const footer = await readFile(new URL('../src/components/SiteFooter.astro', import.meta.url), 'utf8');
  assert.match(footer, /videoChannelHref/);
  assert.match(footer, /hreflang=\{link\.href === videoChannelHref \? undefined : englishTarget/);
  assert.match(footer, /data-language-unknown/);
});

test('the privacy date is the page date until an addition is on, then the configured date', () => {
  assert.equal(channelsPrivacyDate, undefined);
  assert.equal(privacyEffectiveDate(false, undefined), undefined);
  assert.equal(privacyEffectiveDate(false, 'garbage'), undefined);
  assert.equal(privacyEffectiveDate(true, 'January 12, 2027'), 'January 12, 2027');
  assert.equal(privacyEffectiveDate(true, 'March 3, 2027'), 'March 3, 2027');
  for (const bad of [undefined, '', '2027-01-12', 'Jan 12, 2027', 'January 32, 2027', 'February 30, 2027', 'January 12 2027', 'january 12, 2027']) {
    assert.throws(() => privacyEffectiveDate(true, bad), /privacy date/i, String(bad));
  }
});

test('the privacy page keeps its own effective date literal', async () => {
  const page = await readFile(new URL('../src/pages/privacy.astro', import.meta.url), 'utf8');
  assert.match(page, /Effective date: November 12, 2026\./);
  assert.doesNotMatch(page, /November 14, 2026/);
});
