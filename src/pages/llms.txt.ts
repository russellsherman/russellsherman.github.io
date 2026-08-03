import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

import {
  AUTHOR_EMAIL,
  SITE_DESCRIPTION,
  SITE_TITLE,
  SITE_URL,
  formatDate,
} from '../consts';

/**
 * R4.1 — /llms.txt: a curated, lean index of the highest-value pages.
 *
 * Generated from the content collections rather than hand-maintained, so a
 * new post appears here automatically and no link can 404 (R4.3's acceptance
 * check is that every link is absolute and 200-OK).
 *
 * "Lean" is a real constraint: this is an index, not a copy of the site. The
 * full text lives in /llms-full.txt.
 */

const abs = (path: string) => new URL(path, SITE_URL).href;

export const GET: APIRoute = async () => {
  const posts = (await getCollection('blog', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime(),
  );

  const lines: string[] = [
    `# ${SITE_TITLE} — Russell Sherman`,
    '',
    // The site's own meta description, so this summary line cannot drift from
    // what the home page tells every other crawler.
    `> ${SITE_DESCRIPTION}`,
    '',
    'Personal site and writing. Contact: ' + AUTHOR_EMAIL + '.',
    '',
    '## Key pages',
    '',
    `- [Blog](${abs('/')}): the home page — index of all writing.`,
  ];

  if (posts.length > 0) {
    lines.push('', '## Writing', '');
    for (const post of posts) {
      lines.push(
        `- [${post.data.title}](${abs(`/posts/${post.id}/`)}) (${formatDate(
          post.data.pubDate,
        )}): ${post.data.description}`,
      );
    }
  }

  lines.push(
    '',
    '## Optional',
    '',
    `- [Full text of all pages](${abs('/llms-full.txt')}): every page's readable content in one file.`,
    `- [Feed](${abs('/feed.xml')}): RSS.`,
    `- [Usage policy](${abs('/ai.txt')}): training and attribution terms.`,
    '',
  );

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
