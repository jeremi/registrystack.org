// Test-only build switch, read here and nowhere else. The built-output check
// sets SITE_TEST_FIXTURES=episodes to build with the sample episodes under
// tests/fixtures/episodes, a sample video channel address and a sample privacy date. A normal build
// leaves it unset and uses neither.
export const episodeFixturesEnabled = process.env.SITE_TEST_FIXTURES === 'episodes';
export const fixtureVideoChannelUrl = 'https://video.example.test/channel';
export const fixturePrivacyDate = 'December 1, 2026';
