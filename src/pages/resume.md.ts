import type { APIRoute } from 'astro';

import { getResume, resumeMarkdown } from '../lib/resume';

/**
 * /resume.md — the resume as plain Markdown.
 *
 * The reason this exists as a distinct URL rather than as content negotiation
 * on /resume/: the site is static, served by GitHub Pages, so there is no
 * layer that can vary a response on `Accept`. `/resume.md` is the convention
 * agents actually guess at, and /resume/ advertises it via
 * `<link rel="alternate" type="text/markdown">` for the ones that don't.
 *
 * Served as text/markdown rather than text/plain so the type is honest.
 * Note that GitHub Pages sets the Content-Type from the file extension and
 * will do the same thing on its own — this header is what the dev server and
 * `astro preview` use, and keeps the two consistent.
 */
export const GET: APIRoute = async () =>
  new Response(resumeMarkdown(await getResume()), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
