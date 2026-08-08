import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

import { SITE_URL } from './src/consts.ts';

// https://astro.build/config
export default defineConfig({
  // R1.4 — absolute canonical URLs depend on `site` being set.
  site: SITE_URL,

  // R1.3 — static by default. No route on this site needs on-demand
  // rendering; if one ever does, add an adapter and mark that single
  // route `export const prerender = false` rather than flipping the site.
  output: 'static',

  trailingSlash: 'always',

  // The writing index moved from /blog/ to /. That URL was live under Jekyll
  // and is already indexed, so it keeps working: in a static build Astro emits
  // a meta-refresh stub at /blog/index.html pointing here. Redirect stubs are
  // excluded from the sitemap below and from scripts/verify.mjs's content
  // checks — they are navigation, not pages.
  redirects: {
    '/blog': '/',
  },

  integrations: [
    // R5.3 — XML sitemap, referenced from robots.txt.
    sitemap({
      // Tailored resume variants at /resume/<slug>/ are published but
      // unlisted — the sitemap is the one place they would otherwise announce
      // themselves to every crawler at once. The base /resume/ is unaffected;
      // the pattern requires a segment after it. See src/lib/resume.ts.
      filter: (page) => !/^\/resume\/[^/]+\/$/.test(new URL(page).pathname),
      // R4.3 — llms.txt is a plain-text entry file, not an HTML page, so
      // Astro's sitemap integration does not pick it up on its own. It is
      // appended here so answer engines crawling the sitemap can find it.
      //
      // /resume.md and /resume.pdf are here for the same reason: the HTML
      // page at /resume/ is picked up automatically, but its two alternate
      // representations are not HTML routes and would otherwise be reachable
      // only by following a link.
      customPages: [
        new URL('/llms.txt', SITE_URL).href,
        new URL('/llms-full.txt', SITE_URL).href,
        new URL('/resume.md', SITE_URL).href,
        new URL('/resume.pdf', SITE_URL).href,
      ],
    }),
  ],

  build: {
    // Emit `about/index.html` style output so clean URLs work on GitHub Pages.
    format: 'directory',
  },

  image: {
    // R7.3 — `responsiveStyles` only takes effect when a default `layout`
    // is set, so both are needed for <Image> to emit srcset + sizes.
    layout: 'constrained',
    responsiveStyles: true,
  },

  markdown: {
    shikiConfig: {
      /*
       * Was `solarized-light`, which is unreadable on a black page. Of the
       * bundled dark themes this is the most neutral — a #121212 background
       * with no blue or green cast, so a code block reads as the same surface
       * as the rest of the site rather than as a pasted-in screenshot.
       * `--color-code-bg` in global.css is kept in step with it.
       */
      theme: 'vitesse-dark',
      wrap: true,
    },
  },
});
