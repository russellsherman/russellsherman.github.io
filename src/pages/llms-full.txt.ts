import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

import { BIO_HEADING, BIO_PARAGRAPHS } from '../lib/bio';
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
 * Bodies come straight from the collection entries' raw Markdown, and the
 * home page prose comes from the same module the home page renders, so the
 * acceptance check ("content matches canonical pages") holds by construction
 * rather than by remembering to update this file.
 */

const abs = (path: string) => new URL(path, SITE_URL).href;

export const GET: APIRoute = async () => {
  const posts = (await getCollection('blog', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime(),
  );

  const projects = (await getCollection('projects', ({ data }) => !data.draft)).sort(
    (a, b) => a.data.order - b.data.order,
  );

  const out: string[] = [
    `# ${SITE_TITLE} — ${AUTHOR_NAME}`,
    '',
    `Source: ${abs('/')}`,
    `Author: ${AUTHOR_NAME} (${AUTHOR_LOCATION})`,
    `Contact: ${AUTHOR_EMAIL}`,
    'License: full text reproduced with attribution — see ' + abs('/ai.txt') + '.',
    '',
    '---',
    '',
    `## ${BIO_HEADING}`,
    `URL: ${abs('/')}`,
    '',
    ...BIO_PARAGRAPHS.map((paragraph) => `${paragraph}\n`),
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

  for (const project of projects) {
    out.push(
      '---',
      '',
      `## ${project.data.title}`,
      `URL: ${abs(`/projects/#${project.id}`)}`,
      `Started: ${formatDate(project.data.startDate)}`,
      ...(project.data.endDate ? [`Ended: ${formatDate(project.data.endDate)}`] : []),
      `Stack: ${project.data.stack.join(', ')}`,
      ...(project.data.repo ? [`Source: ${project.data.repo}`] : []),
      ...(project.data.demo ? [`Demo: ${project.data.demo}`] : []),
      '',
      `Problem: ${project.data.problem}`,
      '',
      (project.body ?? '').trim(),
      '',
    );
  }

  return new Response(out.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
