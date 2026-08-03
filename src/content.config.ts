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

export const collections = { blog };
