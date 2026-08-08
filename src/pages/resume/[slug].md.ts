import type { APIRoute, GetStaticPaths } from 'astro';

import { getVariants, requireVariantSlug, resumeMarkdown } from '../../lib/resume';

/**
 * /resume/<slug>.md — a variant as plain Markdown, matching /resume.md for the
 * base. Same unlisted rules apply: reachable, but in the sitemap nowhere and
 * linked from nowhere except the variant's own page head.
 */
export const getStaticPaths: GetStaticPaths = async () => {
  const variants = await getVariants();
  return variants.map((entry) => ({
    params: { slug: requireVariantSlug(entry) },
    props: { entry },
  }));
};

export const GET: APIRoute = ({ props }) =>
  new Response(resumeMarkdown(props.entry), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
