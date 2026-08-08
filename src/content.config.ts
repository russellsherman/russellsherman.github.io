import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
// Astro 7 deprecates re-exporting `z` from `astro:content`. `astro/zod` is the
// public export and stays pinned to the zod version Astro itself validates
// with, so schemas can't drift from the validator.
import { z } from 'astro/zod';

/**
 * Blog posts.
 *
 * `description` is required rather than optional on purpose: R2.4 wants a
 * unique meta description per page, and the build should fail loudly when a
 * new post forgets one instead of silently falling back to the site default.
 */
const blog = defineCollection({
  // `_template.md` files are authoring stubs; they carry `draft: true`, which
  // every page and endpoint filters on. scripts/verify.mjs asserts none leak.
  loader: glob({
    pattern: '**/*.{md,mdx}',
    base: './src/content/blog',
  }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    /** Set true to keep a post out of the build entirely. */
    draft: z.boolean().default(false),
  }),
});

/*
 * There was a `projects` collection here (R6.2 — problem, approach, stack).
 * The site is now the blog and nothing else, so it and /projects/ are gone;
 * git history has the schema if projects ever come back.
 */

/**
 * The resume, and its tailored variants.
 *
 * A collection rather than a plain Markdown import because it gives both a
 * rendered body (`render()`, for the HTML page) and the untouched Markdown
 * source (`entry.body`, for the .md file and llms-full.txt) off one file.
 * Importing the Markdown directly would give one or the other, and the point
 * of these routes is that the page, the .md and the PDF cannot disagree.
 *
 * Layout inside the collection carries meaning, and the build depends on it:
 *
 *   resume.md            the base. Public, indexed, linked, in llms.txt.
 *   variants/<slug>.md   tailored for one opportunity. Published but unlisted
 *                        — noindex, out of the sitemap and the agent files,
 *                        linked from nowhere. See src/lib/resume.ts.
 *
 * `updatedDate` is required, unlike on a post: a resume with no date on it is
 * a resume nobody trusts.
 */
const resume = defineCollection({
  loader: glob({
    pattern: '**/*.{md,mdx}',
    base: './src/content/resume',
  }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    /** One line under the name — the role, not a tagline. */
    headline: z.string(),
    updatedDate: z.coerce.date(),

    /*
     * Contact overrides, all optional, all falling back to src/consts.ts.
     *
     * These exist so the *public* resume and a variant sent to a named
     * employer can differ on exactly the fields where that matters. A phone
     * number and a street address on an indexed page that robots.txt invites
     * training crawlers to read is a different decision from the same details
     * in a PDF you hand to one company, and the schema should let those be
     * different without forking the document.
     */
    email: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),

    /** Keeps a variant out of the build entirely — used by `_template.md`. */
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog, resume };
