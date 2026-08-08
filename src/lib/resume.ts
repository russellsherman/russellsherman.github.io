import { getCollection, getEntry } from 'astro:content';
import type { CollectionEntry } from 'astro:content';

import {
  AUTHOR_EMAIL,
  AUTHOR_LOCATION,
  AUTHOR_NAME,
  SITE_URL,
  SOCIAL,
  formatDate,
} from '../consts';

/**
 * The resume, assembled once and reused by every representation of it.
 *
 * Each resume publishes three ways — an HTML page, a Markdown file, and a PDF
 * printed from the HTML page (so the PDF is downstream of it rather than a
 * fourth source). All three need the same contact header, and hand-writing
 * that header into the Markdown would mean three places to change an email
 * address. It is built here instead, from `src/consts.ts` plus the per-entry
 * overrides in the frontmatter.
 *
 * There are two kinds of entry, and the difference is entirely about reach:
 *
 *   base       `resume.md` — public, indexed, in the sitemap, in llms.txt and
 *              llms-full.txt, linked from every page's footer.
 *   variant    `variants/<slug>.md` — tailored for one opportunity. Published,
 *              so it can be shared as a link, but unlisted: `noindex`, absent
 *              from the sitemap and both agent files, and linked from nowhere.
 *
 * Note what is deliberately *not* done for variants: they are not listed in
 * robots.txt. A `Disallow: /resume/acme-corp/` line would publish the very
 * slug the variant is trying to keep quiet — robots.txt is world-readable, and
 * disallowing a page also stops the crawler ever reading the `noindex` that
 * actually removes it. Unlinked plus `noindex` is the combination that works.
 *
 * The honest limit of all this: `noindex` is a <meta> tag, so only the HTML
 * page carries it. A variant's .md and .pdf are plain files, and suppressing
 * those would need an `X-Robots-Tag` response header, which a static host does
 * not give us. Nothing links to them, so in practice nothing finds them — but
 * unlisted is not private, and anything that must not be forwarded should be
 * sent as an attachment rather than as a URL.
 */

export type ResumeEntry = CollectionEntry<'resume'>;

export const BASE_ID = 'resume';
export const RESUME_PATH = '/resume/';
export const RESUME_MD_PATH = '/resume.md';
export const RESUME_PDF_PATH = '/resume.pdf';

export const abs = (path: string) => new URL(path, SITE_URL).href;

/** `variants/backend` -> `backend`. Null for the base entry. */
export function variantSlug(entry: ResumeEntry): string | null {
  return entry.id === BASE_ID ? null : entry.id.replace(/^variants\//, '');
}

/**
 * The slug of a variant, as a plain string.
 *
 * `getStaticPaths` needs a defined param, and every entry `getVariants()`
 * returns has one — but the type can't say so on its own. This narrows it and
 * fails loudly rather than emitting a route at `/resume/null/`.
 */
export function requireVariantSlug(entry: ResumeEntry): string {
  const slug = variantSlug(entry);
  if (slug === null) {
    throw new Error(`${entry.id} is the base resume — it has no variant slug.`);
  }
  return slug;
}

/** The three URLs an entry publishes at. */
export function resumeUrls(entry: ResumeEntry) {
  const slug = variantSlug(entry);
  return slug === null
    ? { page: RESUME_PATH, md: RESUME_MD_PATH, pdf: RESUME_PDF_PATH }
    : {
        page: `/resume/${slug}/`,
        md: `/resume/${slug}.md`,
        pdf: `/resume/${slug}.pdf`,
      };
}

export async function getResume(): Promise<ResumeEntry> {
  const entry = await getEntry('resume', BASE_ID);
  if (!entry) {
    // A build with no base resume would silently ship a /resume/ page
    // containing nothing, which is worse than not shipping one.
    throw new Error('src/content/resume/resume.md is missing — /resume/ cannot be built.');
  }
  return entry;
}

/** Every publishable variant. Drafts and the base are excluded. */
export async function getVariants(): Promise<ResumeEntry[]> {
  return getCollection(
    'resume',
    ({ id, data }) => id !== BASE_ID && !id.startsWith('_') && !data.draft,
  );
}

/** Contact lines, resolved against src/consts.ts. Shared by page and Markdown. */
export function contactFor(entry: ResumeEntry) {
  return {
    email: entry.data.email ?? AUTHOR_EMAIL,
    location: entry.data.address ?? AUTHOR_LOCATION,
    phone: entry.data.phone,
  };
}

interface MarkdownOptions {
  /** Heading level for the document title. `#` standalone, `##` when embedded. */
  level?: '#' | '##';
}

/**
 * A resume as a complete Markdown document: generated contact header, then the
 * body exactly as written in its source file.
 *
 * Kept deliberately plain — no HTML, no tables, no reference links. An agent
 * fetching /resume.md should be able to treat the bytes as the answer.
 */
export function resumeMarkdown(
  entry: ResumeEntry,
  { level = '#' }: MarkdownOptions = {},
): string {
  const { email, location, phone } = contactFor(entry);
  const urls = resumeUrls(entry);

  const lines = [
    `${level} ${AUTHOR_NAME} — ${entry.data.title}`,
    '',
    entry.data.headline,
    '',
    `- Location: ${location}`,
    `- Email: ${email}`,
    ...(phone ? [`- Phone: ${phone}`] : []),
    `- Website: ${abs('/')}`,
    `- GitHub: ${SOCIAL.github}`,
    `- LinkedIn: ${SOCIAL.linkedin}`,
    `- X: ${SOCIAL.x}`,
    '',
    `Canonical: ${abs(urls.page)}`,
    `PDF: ${abs(urls.pdf)}`,
    `Last updated: ${formatDate(entry.data.updatedDate)}`,
    '',
    '---',
    '',
    // Body headings start at `##` in the source (the page's h1 is the hero
    // heading), which is already correct under a `#` title. Under a `##` title
    // they need to shift down one so llms-full.txt keeps a valid heading order
    // alongside the post sections around it.
    demoteHeadings((entry.body ?? '').trim(), level === '##' ? 1 : 0),
    '',
  ];

  return lines.join('\n');
}

/** Adds `by` extra `#` to every ATX heading, skipping fenced code blocks. */
function demoteHeadings(markdown: string, by: number): string {
  if (by === 0) return markdown;
  let inFence = false;
  return markdown
    .split('\n')
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
      if (inFence) return line;
      return line.replace(
        /^(#{1,5})(\s)/,
        (_, hashes, space) => '#'.repeat(hashes.length + by) + space,
      );
    })
    .join('\n');
}
