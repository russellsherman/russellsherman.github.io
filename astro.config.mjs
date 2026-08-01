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

  integrations: [
    // R5.3 — XML sitemap, referenced from robots.txt.
    sitemap({
      // R4.3 — llms.txt is a plain-text entry file, not an HTML page, so
      // Astro's sitemap integration does not pick it up on its own. It is
      // appended here so answer engines crawling the sitemap can find it.
      customPages: [
        new URL('/llms.txt', SITE_URL).href,
        new URL('/llms-full.txt', SITE_URL).href,
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
      theme: 'solarized-light',
      wrap: true,
    },
  },
});
