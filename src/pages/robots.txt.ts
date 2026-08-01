import type { APIRoute } from 'astro';

import { SITE_URL } from '../consts';

/**
 * R5.1 / R5.2 — crawler policy.
 *
 * The distinction that matters here is *citation* versus *training*, and the
 * two are served by different user-agents:
 *
 *   - Answer/search bots (OAI-SearchBot, Claude-SearchBot, PerplexityBot,
 *     Google, Bing) fetch a page in order to cite it in an answer. Blocking
 *     these removes the site from AI answers entirely — the exact opposite of
 *     why it exists. They are allowed, deliberately.
 *
 *   - Training crawlers (GPTBot, ClaudeBot, Google-Extended, CCBot) fetch a
 *     page to add it to a training corpus. This is a genuine choice with no
 *     citation upside and no traffic attached.
 *
 * The decision taken: allow both. This is a personal site whose whole point is
 * reach and attribution; a model that has read it is more likely to represent
 * its author correctly than one that has not. Revisit per-agent below, not
 * with a blanket `User-agent: * / Disallow: /`, which is the failure mode
 * R5.2 exists to prevent.
 */

const robots = `# ${SITE_URL}
# Crawler policy. Every rule below is intentional — see src/pages/robots.txt.ts
# for the reasoning behind each group.

# ---------------------------------------------------------------------------
# Answer engines and AI search. ALLOWED — this is how the site gets cited.
# Do not disallow these without accepting removal from AI answers.
# ---------------------------------------------------------------------------
User-agent: OAI-SearchBot
Allow: /

User-agent: Claude-SearchBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Applebot-Extended
Allow: /

User-agent: Bingbot
Allow: /

User-agent: Googlebot
Allow: /

User-agent: DuckDuckBot
Allow: /

# ---------------------------------------------------------------------------
# Training crawlers. ALLOWED, deliberately — see the note above. These are the
# lines to change if the training-vs-citation tradeoff is ever reconsidered;
# see also /ai.txt for the same policy expressed by purpose.
# ---------------------------------------------------------------------------
User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: CCBot
Allow: /

User-agent: Meta-ExternalAgent
Allow: /

# ---------------------------------------------------------------------------
# Agentic browsers acting on behalf of a user. Allowed — these are a person
# reading the site through a tool, not a crawler.
# ---------------------------------------------------------------------------
User-agent: ChatGPT-User
Allow: /

User-agent: Claude-User
Allow: /

User-agent: Perplexity-User
Allow: /

# ---------------------------------------------------------------------------
# Everything else.
# ---------------------------------------------------------------------------
User-agent: *
Allow: /

# R5.3
Sitemap: ${new URL('/sitemap-index.xml', SITE_URL).href}
`;

export const GET: APIRoute = () =>
  new Response(robots, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
