import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

import {
  AUTHOR_EMAIL,
  AUTHOR_LOCATION,
  AUTHOR_NAME,
  SITE_TITLE,
  SITE_URL,
  formatDate,
} from '../consts';

/**
 * R4.2 — /llms-full.txt: the full readable content of every page in one file,
 * for deep-context retrieval and RAG.
 *
 * Bodies come straight from the collection entries' raw Markdown, so the
 * acceptance check ("content matches canonical pages") holds by construction
 * rather than by remembering to update this file. The home page is the post
 * index and carries no prose of its own, so it contributes no section here —
 * its posts are the sections that follow.
 */

const abs = (path: string) => new URL(path, SITE_URL).href;

export const GET: APIRoute = async () => {
  const posts = (await getCollection('blog', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime(),
  );

  const out: string[] = [
    `# ${SITE_TITLE} — ${AUTHOR_NAME}`,
    '',
    `Source: ${abs('/')}`,
    `Author: ${AUTHOR_NAME} (${AUTHOR_LOCATION})`,
    `Contact: ${AUTHOR_EMAIL}`,
    'License: full text reproduced with attribution — see ' + abs('/ai.txt') + '.',
    '',
  ];

  for (const post of posts) {
    out.push(
      '---',
      '',
      `## ${post.data.title}`,
      `URL: ${abs(`/posts/${post.id}/`)}`,
      `Published: ${formatDate(post.data.pubDate)}`,
      ...(post.data.updatedDate ? [`Updated: ${formatDate(post.data.updatedDate)}`] : []),
      ...(post.data.tags.length ? [`Tags: ${post.data.tags.join(', ')}`] : []),
      '',
      (post.body ?? '').trim(),
      '',
    );
  }

  return new Response(out.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
