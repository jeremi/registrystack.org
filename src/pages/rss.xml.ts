import { getCollection } from 'astro:content';

const escapeXml = (value: string) =>
  value.replace(
    /[<>&'"]/g,
    (character) =>
      ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        "'": '&apos;',
        '"': '&quot;',
      })[character] ?? character,
  );

export async function GET() {
  const posts = (await getCollection('blog', ({ data }) => data.status === 'published')).sort(
    (left, right) =>
      right.data.publishedAt.valueOf() - left.data.publishedAt.valueOf() || left.data.order - right.data.order,
  );
  const items = posts
    .map((post) => {
      const url = `https://registrystack.org/blog/${post.id}/`;
      return [
        '<item>',
        `<title>${escapeXml(post.data.title)}</title>`,
        `<description>${escapeXml(post.data.description)}</description>`,
        `<link>${url}</link>`,
        `<guid isPermaLink="true">${url}</guid>`,
        `<pubDate>${post.data.publishedAt.toUTCString()}</pubDate>`,
        '</item>',
      ].join('');
    })
    .join('');

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '<channel>',
    '<title>Registry Stack field notes</title>',
    '<description>Practical guidance for governed registry access and trusted evidence.</description>',
    '<link>https://registrystack.org/blog/</link>',
    '<language>en</language>',
    items,
    '</channel>',
    '</rss>',
  ].join('');

  return new Response(body, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  });
}
