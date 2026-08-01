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

/**
 * Projects / case studies.
 *
 * The schema encodes R6.2 structurally — a project cannot be published
 * without stating the problem it solved, how it was approached, and its
 * stack. Content requirements enforced by the type system don't rot.
 */
const projects = defineCollection({
  loader: glob({
    pattern: '**/*.{md,mdx}',
    base: './src/content/projects',
  }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    /** R6.2 — lead with the problem. */
    problem: z.string(),
    /** R6.2 — the stack, listed explicitly. */
    stack: z.array(z.string()).min(1),
    /** R6.2 — links to source and/or a demo. */
    repo: z.string().url().optional(),
    demo: z.string().url().optional(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional(),
    /** Lower numbers sort first on the index. */
    order: z.number().default(100),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog, projects };
