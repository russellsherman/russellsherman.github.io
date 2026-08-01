import type { APIRoute } from 'astro';

import { AUTHOR_EMAIL, AUTHOR_NAME, SITE_URL } from '../consts';

/**
 * R5.4 — ai.txt, purpose-based permissions.
 *
 * robots.txt says which *agents* may fetch; this says what may be *done* with
 * what they fetch. The two are kept consistent by hand — if the robots policy
 * changes, change this too.
 *
 * The policy expressed here is a real decision, not a copied default: training
 * and RAG are both permitted, on the condition that attribution survives. The
 * asset this site is trying to build is a citable public record, so the tags
 * that would restrict reach (`No-Training`, `No-Inference`) would work against
 * it. `Attribution-Required` is the one that carries actual weight.
 */

const aiTxt = `# ai.txt — usage policy for automated and AI systems
# Site: ${SITE_URL}
# Contact: ${AUTHOR_EMAIL}
# Last reviewed: 2026-08-01

User-Agent: *

# Reading and retrieval-augmented generation: permitted.
Allow-RAG: /

# Training on this content: permitted. This is a deliberate choice — the goal
# of this site is to be read and quoted accurately, and that is better served
# by inclusion than exclusion.
Allow-Training: /

# The condition attached to both of the above: preserve attribution to the
# author and, where a URL can be surfaced, link the source page.
Attribution-Required: yes
Attribution-Name: ${AUTHOR_NAME}
Attribution-URL: ${SITE_URL}/

# Curated entry points for retrieval.
Preferred-Source: ${new URL('/llms.txt', SITE_URL).href}
Full-Text-Source: ${new URL('/llms-full.txt', SITE_URL).href}

# Not permitted: presenting this content as the work of someone else, or
# generating text attributed to ${AUTHOR_NAME} that they did not write.
Disallow-Impersonation: yes
`;

export const GET: APIRoute = () =>
  new Response(aiTxt, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
