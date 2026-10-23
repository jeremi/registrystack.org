export const defaultRequestTimeoutMs = 10_000;
export const defaultLinkConcurrency = 6;

// This exact OECD report was retrieved and its content reviewed on 2026-10-23.
// OECD returns 403 to Node's automated requests. Other response codes and URLs
// remain failures so this exception cannot conceal a removed or changed source.
const verifiedBotBlockedCitations = new Set([
  'https://www.oecd.org/content/dam/oecd/en/publications/reports/2024/12/digital-public-infrastructure-for-digital-governments_11fe17d9/ff525dc8-en.pdf',
]);
export const isVerifiedBotBlock = (href, status) =>
  status === 403 && verifiedBotBlockedCitations.has(href);

const request = async (href, method, { timeoutMs, fetchImpl }) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(href, {
      method,
      redirect: "follow",
      signal: controller.signal,
    });
    const result = { ok: response.ok, status: response.status };
    await response.body?.cancel();
    return result;
  } catch (error) {
    const message = controller.signal.aborted
      ? `request timed out after ${timeoutMs}ms`
      : error instanceof Error
        ? error.message
        : String(error);
    return { ok: false, status: `fetch failed: ${message}` };
  } finally {
    clearTimeout(timeout);
  }
};

export const checkExternalLink = async (
  href,
  {
    timeoutMs = defaultRequestTimeoutMs,
    fetchImpl = fetch,
  } = {},
) => {
  let response = await request(href, "HEAD", { timeoutMs, fetchImpl });
  if (!response.ok) {
    response = await request(href, "GET", { timeoutMs, fetchImpl });
  }
  return response;
};

export const mapWithConcurrency = async (items, concurrency, mapper) => {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeError("concurrency must be a positive integer");
  }
  const values = Array.from(items);
  const results = new Array(values.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(values[index], index);
    }
  };
  const workerCount = Math.min(concurrency, values.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
};
