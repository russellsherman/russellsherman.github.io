import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

import { BIO_PARAGRAPHS } from '../lib/bio';
import { AUTHOR_EMAIL, SITE_TITLE, SITE_URL, formatDate } from '../consts';

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

  const projects = (await getCollection('projects', ({ data }) => !data.draft)).sort(
    (a, b) => a.data.order - b.data.order,
  );

  const lines: string[] = [
    `# ${SITE_TITLE} — Russell Sherman`,
    '',
    `> ${BIO_PARAGRAPHS[0]}`,
    '',
    'Personal site and writing. Contact: ' + AUTHOR_EMAIL + '.',
    '',
    '## Key pages',
    '',
    `- [Home](${abs('/')}): who I am and what I work on.`,
    `- [Blog](${abs('/blog/')}): index of all writing.`,
    `- [Projects](${abs('/projects/')}): things I've built, the problem each solved, and the stack.`,
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

  if (projects.length > 0) {
    lines.push('', '## Projects', '');
    for (const project of projects) {
      lines.push(
        `- [${project.data.title}](${abs(`/projects/#${project.id}`)}): ${project.data.description}`,
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
