#!/usr/bin/env node
/**
 * Acceptance checks for the agent-legible-site requirements, run against
 * `dist/` after a build.
 *
 * The point of this file is that the requirements are executable. Every check
 * below names the requirement it enforces, so a regression fails CI with the
 * ID rather than being noticed six months later in a Search Console report.
 *
 * Deliberately operates on the built files rather than a running browser: the
 * whole R1 family is about content existing in static HTML, so reading bytes
 * off disk is the more honest test. (Lighthouse covers R7.2 separately — it
 * needs a real browser and lives in lighthouserc.json.)
 *
 * Usage: node scripts/verify.mjs
 */

import { readFile, readdir } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as cheerio from 'cheerio';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const ORIGIN = 'https://neverenough.info';

/* ------------------------------------------------------------- harness */

const failures = [];
const passes = [];

function check(id, description, fn) {
  try {
    const detail = fn();
    passes.push({ id, description, detail });
  } catch (error) {
    failures.push({ id, description, message: error.message });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/**
 * Normalize text before comparing it.
 *
 * Markdown rendering applies smartypants, so a straight apostrophe in the
 * source becomes ’ in the HTML. That is the same text, and an acceptance
 * check shouldn't force whoever writes it to know about typographic
 * substitution. Entities and curly punctuation are folded; nothing that
 * would let genuinely missing content pass is touched.
 */
function normalizeText(input) {
  return input
    .replace(/&nbsp;/g, ' ')
    .replace(/&#3[49];|&apos;|&quot;/g, (m) => (m === '&quot;' ? '"' : "'"))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ');
}

function includesText(haystack, needle) {
  return normalizeText(haystack).includes(normalizeText(needle));
}

/* --------------------------------------------------------- collect pages */

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

if (!existsSync(DIST)) {
  console.error('dist/ not found — run `npm run build` first.');
  process.exit(1);
}

const allFiles = await walk(DIST);

const htmlFiles = allFiles.filter((f) => f.endsWith('.html'));

/** dist-relative URL path for an HTML file: dist/blog/index.html -> /blog/ */
function urlPathFor(file) {
  const rel = path.relative(DIST, file).split(path.sep).join('/');
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return `/${rel.slice(0, -'index.html'.length)}`;
  return `/${rel}`;
}

const allPages = htmlFiles.map((file) => {
  const html = null;
  return { file, urlPath: urlPathFor(file), html };
});

for (const page of allPages) {
  page.html = await readFile(page.file, 'utf8');
  page.$ = cheerio.load(page.html);
}

/**
 * Redirect stubs are the meta-refresh pages Astro emits for `redirects` in a
 * static build. They are navigation, not content: no h1, no canonical, no
 * <main> — so holding them to the page checks below would fail every one of
 * them for no reason. They get their own check instead (see "redirects").
 */
const isRedirectStub = (page) => page.$('meta[http-equiv="refresh"]').length > 0;

const redirectPages = allPages.filter(isRedirectStub);

/** Real pages — everything the reader can actually land on and read. */
const pages = allPages.filter((p) => !isRedirectStub(p));

/** Content pages, i.e. everything except the 404. */
const contentPages = pages.filter((p) => p.urlPath !== '/404.html');

const EXPECTED_ROUTES = ['/', '/posts/site-released/', '/resume/'];

/** Legacy URL -> where it must now land. */
const EXPECTED_REDIRECTS = { '/blog/': '/' };

/* ---------------------------------------------------------------- R1 */

check('R1.3', 'static HTML emitted for every content route', () => {
  const got = pages.map((p) => p.urlPath);
  for (const route of EXPECTED_ROUTES) {
    assert(got.includes(route), `missing built page for ${route} (got ${got.join(', ')})`);
  }
  assert(got.includes('/404.html'), 'missing 404.html');
  return `${pages.length} pages`;
});

check('R1.1', 'primary content present in static HTML, no JS required', () => {
  // Known body phrases that must appear in the raw bytes. If a framework
  // change ever moves rendering client-side, these disappear.
  const expectations = [
    ['/', 'hello, world'],
    ['/posts/site-released/', "I've decided to boot up this site"],
  ];
  for (const [route, phrase] of expectations) {
    const page = pages.find((p) => p.urlPath === route);
    assert(page, `no page built for ${route}`);
    assert(
      includesText(page.html, phrase),
      `${route} static HTML is missing the phrase "${phrase}"`,
    );
  }
  return `${expectations.length} routes contain their body text`;
});

check('R1.1', 'every page has substantive text inside <main>', () => {
  for (const page of pages) {
    const text = page.$('main').text().replace(/\s+/g, ' ').trim();
    assert(text.length > 80, `${page.urlPath} has only ${text.length} chars in <main>`);
  }
  return 'all pages have a populated <main>';
});

check('R1.2 / R7.1', 'content pages ship no client JavaScript', () => {
  for (const page of pages) {
    const scripts = page
      .$('script')
      .toArray()
      .filter((el) => (page.$(el).attr('type') || '') !== 'application/ld+json');
    assert(
      scripts.length === 0,
      `${page.urlPath} ships ${scripts.length} script tag(s); core content must not depend on hydration`,
    );
  }
  const jsAssets = allFiles.filter((f) => f.endsWith('.js') || f.endsWith('.mjs'));
  assert(jsAssets.length === 0, `dist contains JS bundles: ${jsAssets.join(', ')}`);
  return '0 KB JS on every page';
});

check('R1.4', 'exactly one absolute canonical per page', () => {
  for (const page of pages) {
    const links = page.$('link[rel="canonical"]');
    assert(links.length === 1, `${page.urlPath} has ${links.length} canonical tags`);
    const href = links.attr('href');
    assert(
      href?.startsWith('https://'),
      `${page.urlPath} canonical is not absolute: ${href}`,
    );
    // 404 is not a canonical-able route; every other page must self-canonical.
    if (page.urlPath !== '/404.html') {
      assert(
        href === new URL(page.urlPath, ORIGIN).href,
        `${page.urlPath} canonical points elsewhere: ${href}`,
      );
    }
  }
  return `${pages.length} canonicals verified`;
});

/* ---------------------------------------------------------------- R2 */

check('R2.1', 'exactly one <h1> per page', () => {
  for (const page of pages) {
    const count = page.$('h1').length;
    assert(count === 1, `${page.urlPath} has ${count} <h1> elements`);
  }
  return 'one h1 everywhere';
});

check('R2.1', 'heading levels nest without skipping', () => {
  for (const page of pages) {
    const levels = page
      .$('h1, h2, h3, h4, h5, h6')
      .toArray()
      .map((el) => Number(el.tagName[1]));
    assert(levels[0] === 1, `${page.urlPath} first heading is h${levels[0]}, not h1`);
    for (let i = 1; i < levels.length; i += 1) {
      assert(
        levels[i] <= levels[i - 1] + 1,
        `${page.urlPath} skips from h${levels[i - 1]} to h${levels[i]}`,
      );
    }
  }
  return 'no heading-order violations';
});

check('R2.2', 'landmark elements present', () => {
  // <nav> is deliberately absent site-wide: a blog index plus its posts has
  // nowhere to navigate to that isn't already a link in the content. If a
  // navbar ever returns, add 'nav' back here and require its accessible name.
  for (const page of pages) {
    for (const landmark of ['header', 'main', 'footer']) {
      assert(page.$(landmark).length > 0, `${page.urlPath} has no <${landmark}>`);
    }
    // Any <nav> that does exist must still be named, or it is a bare landmark.
    for (const nav of page.$('nav').toArray()) {
      assert(
        page.$(nav).attr('aria-label') || page.$(nav).attr('aria-labelledby'),
        `${page.urlPath} has a <nav> with no accessible name`,
      );
    }
  }
  return 'header/main/footer on every page';
});

check('R2.2', 'a skip link targets the main landmark', () => {
  // With no navbar this is the only bypass mechanism, so it has to be right:
  // the target must exist on the page it links to.
  for (const page of pages) {
    const href = page.$('a.skip-link').attr('href');
    assert(href, `${page.urlPath} has no skip link`);
    assert(href.startsWith('#'), `${page.urlPath} skip link is not a fragment: ${href}`);
    assert(
      page.$(href).length === 1,
      `${page.urlPath} skip link points at ${href}, which does not exist`,
    );
  }
  return 'skip link resolves on every page';
});

check('R2.3', 'no FAQPage schema anywhere in the output', () => {
  // Google retired the FAQ rich result 2026-05-07; this markup would now
  // describe a feature that no longer exists.
  for (const page of pages) {
    assert(!page.html.includes('FAQPage'), `${page.urlPath} contains FAQPage schema`);
    assert(!page.html.includes('QAPage'), `${page.urlPath} contains QAPage schema`);
  }
  return 'clean';
});

check('R2.4', 'titles and descriptions are unique across the site', () => {
  const titles = new Map();
  const descriptions = new Map();
  for (const page of contentPages) {
    const title = page.$('title').text().trim();
    const description = page.$('meta[name="description"]').attr('content')?.trim();
    assert(title.length > 0, `${page.urlPath} has an empty <title>`);
    assert(description, `${page.urlPath} has no meta description`);
    assert(
      !titles.has(title),
      `duplicate <title> "${title}" on ${page.urlPath} and ${titles.get(title)}`,
    );
    assert(
      !descriptions.has(description),
      `duplicate description on ${page.urlPath} and ${descriptions.get(description)}`,
    );
    titles.set(title, page.urlPath);
    descriptions.set(description, page.urlPath);
  }
  return `${titles.size} unique titles / descriptions`;
});

check('R2.5', 'every <img> carries an alt attribute', () => {
  for (const page of pages) {
    for (const img of page.$('img').toArray()) {
      const alt = page.$(img).attr('alt');
      assert(
        alt !== undefined,
        `${page.urlPath} has an <img> with no alt attribute (src=${page.$(img).attr('src')})`,
      );
    }
  }
  return 'no missing-alt violations';
});

/* ---------------------------------------------------------------- R3 */

/** Durable types only (R3.3) — nothing here chases a SERP feature. */
const ALLOWED_TYPES = new Set([
  'Person',
  'WebSite',
  'WebPage',
  'BlogPosting',
  'Article',
  'ProfilePage',
  'BreadcrumbList',
  'ListItem',
  'CreativeWork',
  'Place',
  'PostalAddress',
]);

function graphOf(page) {
  const blocks = page
    .$('script[type="application/ld+json"]')
    .toArray()
    .map((el) => page.$(el).text());
  assert(blocks.length > 0, `${page.urlPath} emits no JSON-LD`);
  return blocks.map((block) => JSON.parse(block));
}

check('R3.4', 'JSON-LD is server-rendered and parses', () => {
  for (const page of pages) {
    const parsed = graphOf(page);
    for (const doc of parsed) {
      assert(doc['@context'] === 'https://schema.org', `${page.urlPath} bad @context`);
      assert(Array.isArray(doc['@graph']), `${page.urlPath} has no @graph`);
    }
  }
  return 'present in the built HTML on every page';
});

check('R3.1', 'home page emits Person and WebSite', () => {
  const home = pages.find((p) => p.urlPath === '/');
  const nodes = graphOf(home).flatMap((doc) => doc['@graph']);
  const types = nodes.map((n) => n['@type']);
  assert(types.includes('Person'), 'no Person node');
  assert(types.includes('WebSite'), 'no WebSite node');

  const person = nodes.find((n) => n['@type'] === 'Person');
  for (const field of ['@id', 'name', 'url']) {
    assert(person[field], `Person node missing ${field}`);
  }
  return `Person + WebSite (@id ${person['@id']})`;
});

check('R3.2', 'each post emits BlogPosting with a resolvable author', () => {
  const posts = pages.filter((p) => p.urlPath.startsWith('/posts/'));
  assert(posts.length > 0, 'no post pages found');
  for (const post of posts) {
    const nodes = graphOf(post).flatMap((doc) => doc['@graph']);
    const article = nodes.find((n) => n['@type'] === 'BlogPosting');
    assert(article, `${post.urlPath} has no BlogPosting node`);
    for (const field of ['headline', 'datePublished', 'author', 'mainEntityOfPage']) {
      assert(article[field], `${post.urlPath} BlogPosting missing ${field}`);
    }
    // The acceptance check: author's @id must resolve to a Person node that is
    // actually present in the same document.
    const authorId = article.author['@id'];
    assert(authorId, `${post.urlPath} author is not an @id reference`);
    const person = nodes.find((n) => n['@id'] === authorId && n['@type'] === 'Person');
    assert(
      person,
      `${post.urlPath} author @id ${authorId} does not resolve to a Person node`,
    );
    assert(
      !Number.isNaN(Date.parse(article.datePublished)),
      `${post.urlPath} datePublished is not a valid date`,
    );
  }
  return `${posts.length} post(s) validated`;
});

check('R3.3', 'only durable schema types are used', () => {
  const seen = new Set();
  const collect = (node) => {
    if (Array.isArray(node)) return node.forEach(collect);
    if (node && typeof node === 'object') {
      if (typeof node['@type'] === 'string') seen.add(node['@type']);
      Object.values(node).forEach(collect);
    }
  };
  for (const page of pages) collect(graphOf(page));
  for (const type of seen) {
    assert(ALLOWED_TYPES.has(type), `unexpected schema type "${type}"`);
  }
  return [...seen].sort().join(', ');
});

/* ---------------------------------------------------------------- R4 */

const llms = await readFile(path.join(DIST, 'llms.txt'), 'utf8').catch(() => null);
const llmsFull = await readFile(path.join(DIST, 'llms-full.txt'), 'utf8').catch(() => null);

/** Map an absolute or root-relative URL to a file in dist, or null. */
function resolveToDist(url) {
  let pathname;
  try {
    pathname = url.startsWith('http')
      ? new URL(url).pathname
      : new URL(url, ORIGIN).pathname;
  } catch {
    return null;
  }
  const candidates = [
    path.join(DIST, pathname, 'index.html'),
    path.join(DIST, pathname),
    path.join(DIST, `${pathname}.html`),
  ];
  return (
    candidates.find((c) => existsSync(c) && statSync(c).isFile()) ?? null
  );
}

/** Sitemap bodies, keyed by absolute file path. */
const allSitemapText = Object.fromEntries(
  await Promise.all(
    allFiles
      .filter((f) => path.basename(f).startsWith('sitemap'))
      .map(async (f) => [f, await readFile(f, 'utf8')]),
  ),
);

check('R4.1', 'llms.txt exists, is Markdown, and every link is absolute + resolves', () => {
  assert(llms, 'dist/llms.txt not found');
  assert(llms.startsWith('# '), 'llms.txt does not begin with a Markdown H1');
  assert(llms.includes('\n> '), 'llms.txt has no one-line blockquote description');

  const links = [...llms.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((m) => m[1]);
  assert(links.length > 0, 'llms.txt contains no links');
  for (const link of links) {
    assert(link.startsWith('https://'), `llms.txt link is not absolute: ${link}`);
    assert(link.startsWith(ORIGIN), `llms.txt link is off-origin: ${link}`);
    assert(resolveToDist(link), `llms.txt link does not resolve in dist: ${link}`);
  }
  // "Keep it lean" is a requirement, so hold it to a budget.
  const kb = Buffer.byteLength(llms) / 1024;
  assert(kb < 8, `llms.txt is ${kb.toFixed(1)}KB — should stay lean (<8KB)`);
  return `${links.length} links, ${kb.toFixed(1)}KB`;
});

check('R4.2', 'llms-full.txt exists and its content matches canonical pages', () => {
  assert(llmsFull, 'dist/llms-full.txt not found');
  // Body text of the real post must appear verbatim.
  const phrase = "I've decided to boot up this site";
  assert(
    includesText(llmsFull, phrase),
    `llms-full.txt is missing post body text: "${phrase}"`,
  );
  // The home page is the post index, so "matches canonical pages" means every
  // post it lists has its full text here.
  const home = pages.find((p) => p.urlPath === '/');
  const listed = home
    .$('.post-title')
    .toArray()
    .map((el) => home.$(el).text().trim())
    .filter(Boolean);
  assert(listed.length > 0, 'home page lists no posts');
  for (const title of listed) {
    assert(
      includesText(llmsFull, title),
      `llms-full.txt is missing "${title}", which the home page links to`,
    );
  }
  return `${listed.length} post(s), ${(Buffer.byteLength(llmsFull) / 1024).toFixed(1)}KB`;
});

check('R4.3', 'llms.txt is in the sitemap and linked from a rendered page', () => {
  const sitemaps = allFiles.filter((f) => path.basename(f).startsWith('sitemap'));
  assert(sitemaps.length > 0, 'no sitemap files in dist');
  const combined = sitemaps.map((f) => path.basename(f)).join(', ');

  const bodies = sitemaps.map((f) => allSitemapText[f]).join('\n');
  assert(bodies.includes('/llms.txt'), `llms.txt URL not found in sitemap (${combined})`);

  const linking = pages.filter((p) => p.$('a[href="/llms.txt"]').length > 0);
  assert(linking.length > 0, 'no rendered page links to /llms.txt');
  return `in sitemap; linked from ${linking.length} page(s)`;
});

/* ---------------------------------------------------------------- R5 */

const robots = await readFile(path.join(DIST, 'robots.txt'), 'utf8').catch(() => null);
const aiTxt = await readFile(path.join(DIST, 'ai.txt'), 'utf8').catch(() => null);

check('R5.1', 'robots.txt documents its policy inline and names each agent', () => {
  assert(robots, 'dist/robots.txt not found');
  assert(robots.includes('#'), 'robots.txt has no explanatory comments');
  for (const agent of ['OAI-SearchBot', 'Claude-SearchBot', 'PerplexityBot', 'GPTBot', 'ClaudeBot', 'Google-Extended']) {
    assert(
      new RegExp(`^User-agent:\\s*${agent}$`, 'im').test(robots),
      `robots.txt has no rule for ${agent}`,
    );
  }
  return 'answer bots and training crawlers both addressed explicitly';
});

check('R5.2', 'no answer/search agent is disallowed', () => {
  // Parse robots.txt into groups and assert the citation bots are not blocked.
  const groups = [];
  let current = null;
  for (const raw of robots.split('\n')) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const [key, ...rest] = line.split(':');
    const value = rest.join(':').trim();
    const field = key.trim().toLowerCase();
    if (field === 'user-agent') {
      if (!current || current.rules.length > 0) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value);
    } else if (current && (field === 'allow' || field === 'disallow')) {
      current.rules.push({ field, value });
    }
  }

  const SEARCH_BOTS = [
    'OAI-SearchBot',
    'Claude-SearchBot',
    'PerplexityBot',
    'Googlebot',
    'Bingbot',
  ];
  for (const bot of SEARCH_BOTS) {
    const group = groups.find((g) =>
      g.agents.some((a) => a.toLowerCase() === bot.toLowerCase()),
    );
    assert(group, `no robots.txt group for ${bot}`);
    const blocked = group.rules.some((r) => r.field === 'disallow' && r.value === '/');
    assert(!blocked, `${bot} is disallowed — this removes the site from AI answers`);
  }

  const wildcard = groups.find((g) => g.agents.includes('*'));
  if (wildcard) {
    assert(
      !wildcard.rules.some((r) => r.field === 'disallow' && r.value === '/'),
      'robots.txt blanket-blocks all agents with `User-agent: * / Disallow: /`',
    );
  }
  return `${SEARCH_BOTS.length} answer/search agents confirmed allowed`;
});

check('R5.3', 'sitemap emitted and referenced from robots.txt', () => {
  const line = robots.split('\n').find((l) => /^Sitemap:/i.test(l.trim()));
  assert(line, 'robots.txt has no Sitemap: line');
  const url = line.split(/:\s*/).slice(1).join(':').trim();
  assert(url.startsWith('https://'), `Sitemap URL is not absolute: ${url}`);
  assert(resolveToDist(url), `Sitemap URL does not resolve in dist: ${url}`);

  // Every <loc> in every sitemap must resolve to something we actually built.
  for (const [file, body] of Object.entries(allSitemapText)) {
    const locs = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    assert(locs.length > 0, `${path.basename(file)} contains no <loc> entries`);
    for (const loc of locs) {
      if (path.basename(file) === 'sitemap-index.xml') continue; // points at sub-sitemaps
      assert(resolveToDist(loc), `sitemap <loc> does not resolve: ${loc}`);
    }
  }
  return Object.keys(allSitemapText).map((f) => path.basename(f)).join(', ');
});

check('R5.4', 'ai.txt resolves and expresses a real decision', () => {
  assert(aiTxt, 'dist/ai.txt not found');
  const tags = ['Allow-RAG', 'Allow-Training', 'Attribution-Required'];
  for (const tag of tags) {
    assert(new RegExp(`^${tag}:`, 'im').test(aiTxt), `ai.txt has no ${tag} tag`);
  }
  assert(
    /training on this content/i.test(aiTxt),
    'ai.txt does not explain its training decision — tags should not be cargo-culted',
  );
  return tags.join(', ');
});

/* ------------------------------------------------------------ resume */

/*
 * The resume ships as three files built from one source. The failure mode
 * worth guarding against is not any one of them being broken — it is the
 * three of them silently disagreeing, which is exactly what happens the first
 * time someone edits the PDF or the Markdown directly instead of
 * src/content/resume/resume.md. These checks assert they still agree.
 */

const resumePage = pages.find((p) => p.urlPath === '/resume/');
const resumeMd = await readFile(path.join(DIST, 'resume.md'), 'utf8').catch(() => null);
const resumePdf = path.join(DIST, 'resume.pdf');
/** Magic bytes, read up front so the check below can stay synchronous. */
const resumePdfMagic = existsSync(resumePdf)
  ? (await readFile(resumePdf)).subarray(0, 5).toString('latin1')
  : null;

/** Tailored variants: every /resume/<slug>/ page, with its .md and .pdf. */
const variantPages = pages.filter((p) => /^\/resume\/[^/]+\/$/.test(p.urlPath));
const variants = await Promise.all(
  variantPages.map(async (page) => {
    const slug = page.urlPath.split('/')[2];
    return {
      slug,
      page,
      mdPath: `/resume/${slug}.md`,
      pdfPath: `/resume/${slug}.pdf`,
      md: await readFile(path.join(DIST, 'resume', `${slug}.md`), 'utf8').catch(() => null),
      pdf: path.join(DIST, 'resume', `${slug}.pdf`),
    };
  }),
);

/** Every published resume Markdown file, base and variants alike. */
const allResumeMd = [
  { label: 'resume.md', body: resumeMd },
  ...variants.map((v) => ({ label: `resume/${v.slug}.md`, body: v.md })),
].filter((r) => r.body);

check('resume', 'all three representations are built', () => {
  assert(resumePage, 'no page built for /resume/');
  assert(resumeMd, 'dist/resume.md not found');
  assert(existsSync(resumePdf), 'dist/resume.pdf not found — did build:resume-pdf run?');

  const pdf = statSync(resumePdf);
  assert(resumePdfMagic === '%PDF-', 'dist/resume.pdf is not a PDF (bad magic bytes)');
  assert(pdf.size > 4096, `dist/resume.pdf is only ${pdf.size} bytes — likely a blank page`);
  return `/resume/, resume.md (${(Buffer.byteLength(resumeMd) / 1024).toFixed(1)}KB), resume.pdf (${(pdf.size / 1024).toFixed(0)}KB)`;
});

check('resume', 'each Markdown file and its HTML page carry the same content', () => {
  const docs = [
    { label: 'resume.md', md: resumeMd, page: resumePage },
    ...variants.map((v) => ({ label: `resume/${v.slug}.md`, md: v.md, page: v.page })),
  ];

  let sectionCount = 0;
  for (const { label, md, page } of docs) {
    assert(md.startsWith('# '), `${label} does not begin with a Markdown H1`);

    /*
     * Contact details are generated into both outputs from src/consts.ts plus
     * the entry's frontmatter overrides. Assert the two agree rather than
     * hardcoding an address here — an entry is allowed to override the site
     * email, and a check that pins one literal would just be re-stating the
     * frontmatter. What must not happen is the page and the .md disagreeing.
     */
    for (const field of ['Location', 'Email']) {
      const value = md.match(new RegExp(`^- ${field}: (.+)$`, 'm'))?.[1]?.trim();
      assert(value, `${label} has no "- ${field}:" line`);
      assert(
        includesText(page.html, value),
        `${page.urlPath} is missing the ${field.toLowerCase()} "${value}" that ${label} advertises`,
      );
    }

    // Every section heading rendered on the page must exist in the Markdown.
    const sections = page
      .$('.resume h2')
      .toArray()
      .map((el) => page.$(el).text().trim())
      .filter(Boolean);
    assert(sections.length > 0, `${page.urlPath} renders no sections`);
    for (const section of sections) {
      assert(
        includesText(md, `## ${section}`),
        `${label} has no "## ${section}" section, but ${page.urlPath} renders one`,
      );
    }
    sectionCount += sections.length;
  }
  return `${docs.length} resume(s), ${sectionCount} sections`;
});

check('resume', 'the HTML page advertises its Markdown and PDF alternates', () => {
  // Two audiences: `rel="alternate"` for an agent reading the head, visible
  // anchors for a person reading the page. A static host cannot do content
  // negotiation, so these links are the only discovery mechanism there is.
  const md = resumePage.$('link[rel="alternate"][type="text/markdown"]').attr('href');
  const pdf = resumePage.$('link[rel="alternate"][type="application/pdf"]').attr('href');
  assert(md === '/resume.md', `rel=alternate text/markdown is "${md}", expected /resume.md`);
  assert(pdf === '/resume.pdf', `rel=alternate application/pdf is "${pdf}", expected /resume.pdf`);

  assert(
    resumePage.$('a[href="/resume.pdf"]').length > 0,
    '/resume/ has no visible link to the PDF',
  );
  assert(
    resumePage.$('a[href="/resume.md"]').length > 0,
    '/resume/ has no visible link to the Markdown',
  );
  return 'rel=alternate + visible links for both';
});

check('resume', 'ProfilePage schema resolves to the site Person', () => {
  const nodes = graphOf(resumePage).flatMap((doc) => doc['@graph']);
  const profile = nodes.find((n) => n['@type'] === 'ProfilePage');
  assert(profile, '/resume/ has no ProfilePage node');
  const subjectId = profile.mainEntity?.['@id'];
  assert(subjectId, 'ProfilePage has no mainEntity @id — nothing says who it is about');
  assert(
    nodes.some((n) => n['@id'] === subjectId && n['@type'] === 'Person'),
    `ProfilePage mainEntity ${subjectId} does not resolve to a Person node`,
  );
  assert(
    !Number.isNaN(Date.parse(profile.dateModified)),
    'ProfilePage dateModified is not a valid date',
  );
  return `mainEntity -> ${subjectId}`;
});

check('resume', 'the resume is reachable from every page and from the agent files', () => {
  const linking = pages.filter((p) => p.$('a[href="/resume/"]').length > 0);
  assert(
    linking.length === pages.length,
    `only ${linking.length}/${pages.length} pages link to /resume/`,
  );
  for (const url of ['/resume/', '/resume.md', '/resume.pdf']) {
    assert(llms.includes(url), `llms.txt does not list ${url}`);
    const bodies = Object.values(allSitemapText).join('\n');
    assert(bodies.includes(url), `sitemap does not list ${url}`);
  }
  // The full text, not just a link — llms-full.txt is the RAG surface.
  const sections = resumePage
    .$('.resume h2')
    .toArray()
    .map((el) => resumePage.$(el).text().trim());
  for (const section of sections) {
    assert(
      includesText(llmsFull, section),
      `llms-full.txt is missing the resume's "${section}" section`,
    );
  }
  return 'linked site-wide, in llms.txt, in the sitemap, full text in llms-full.txt';
});

check('resume', 'no scaffold text survives in any published resume', () => {
  // variants/_template.md is a structural scaffold. Publishing a copy that
  // still says "Placeholder achievement" under a real name is worse than
  // publishing nothing, so it fails the build rather than warning.
  const marks = ['Placeholder', 'Job Title —', 'Mon YYYY', 'Start from the base resume'];
  for (const { label, body } of allResumeMd) {
    const found = marks.filter((m) => body.includes(m));
    assert(
      found.length === 0,
      `${label} still contains template text (${found.join(', ')}) — finish it or set draft: true`,
    );
  }
  return `${allResumeMd.length} resume(s) clean`;
});

/*
 * The variant checks below are the load-bearing half of "published but
 * unlisted". Each one covers a distinct way a tailored resume could leak: the
 * index, the sitemap, the agent files, and an accidental inbound link. They
 * pass vacuously when no variant exists, which is the normal state — the point
 * is that the first variant added is checked without anyone remembering to.
 */

check('resume', 'every variant is built as page + Markdown + PDF', () => {
  for (const v of variants) {
    assert(v.md, `${v.mdPath} was not built for the /resume/${v.slug}/ page`);
    assert(existsSync(v.pdf), `${v.pdfPath} was not built — did build:resume-pdf run?`);
    assert(
      v.page.$(`a[href="${v.pdfPath}"]`).length > 0,
      `/resume/${v.slug}/ does not link its own PDF`,
    );
    assert(
      v.page.$(`link[rel="alternate"][type="text/markdown"]`).attr('href') === v.mdPath,
      `/resume/${v.slug}/ advertises the wrong Markdown alternate`,
    );
  }
  return variants.length === 0 ? 'no variants' : variants.map((v) => v.slug).join(', ');
});

check('resume', 'variants are noindex and the base is not', () => {
  const baseRobots = resumePage.$('meta[name="robots"]').attr('content') ?? '';
  assert(
    !/noindex/i.test(baseRobots),
    `/resume/ is marked "${baseRobots}" — the public resume must stay indexable`,
  );

  for (const v of variants) {
    const content = v.page.$('meta[name="robots"]').attr('content') ?? '';
    assert(/noindex/i.test(content), `/resume/${v.slug}/ has no noindex (robots="${content}")`);
    // Without noarchive a search engine that already fetched the page can keep
    // serving a cached copy after it drops out of the index.
    assert(
      /noarchive/i.test(content),
      `/resume/${v.slug}/ is noindex but not noarchive (robots="${content}")`,
    );
  }
  return variants.length === 0 ? 'no variants; base indexable' : `${variants.length} noindex`;
});

check('resume', 'no variant appears in the sitemap, the agent files, or any link', () => {
  const sitemapBodies = Object.values(allSitemapText).join('\n');
  for (const v of variants) {
    for (const url of [v.page.urlPath, v.mdPath, v.pdfPath]) {
      assert(!sitemapBodies.includes(url), `sitemap lists the unlisted variant ${url}`);
      assert(!llms.includes(url), `llms.txt lists the unlisted variant ${url}`);
    }
    // Body text, not just the URL — llms-full.txt is the RAG surface, and a
    // variant reproduced there is readable by every crawler regardless of
    // whether anything links to it.
    const heading = v.md.split('\n').find((l) => l.startsWith('# '));
    assert(
      heading && !includesText(llmsFull, heading.slice(2)),
      `llms-full.txt contains the unlisted variant "${v.slug}"`,
    );

    // Inbound links, from anywhere except the variant's own page.
    const linking = pages
      .filter((p) => p.urlPath !== v.page.urlPath)
      .filter((p) => p.$(`a[href^="/resume/${v.slug}"]`).length > 0)
      .map((p) => p.urlPath);
    assert(
      linking.length === 0,
      `${linking.join(', ')} links to the unlisted variant /resume/${v.slug}/`,
    );
  }
  return variants.length === 0 ? 'no variants' : `${variants.length} variant(s) unlisted`;
});

/* -------------------------------------------------------- integrity */

check('links', 'every internal link resolves to a built file', () => {
  const broken = [];
  for (const page of pages) {
    for (const el of page.$('a[href]').toArray()) {
      const href = page.$(el).attr('href');
      if (!href || /^(mailto:|tel:|#)/.test(href)) continue;
      if (/^https?:\/\//.test(href) && !href.startsWith(ORIGIN)) continue;
      const target = href.split('#')[0];
      if (!target) continue;
      if (!resolveToDist(target)) broken.push(`${page.urlPath} -> ${href}`);
    }
  }
  assert(broken.length === 0, `broken internal links:\n    ${broken.join('\n    ')}`);
  return 'no broken internal links';
});

check('redirects', 'legacy URLs still resolve and point at the right page', () => {
  for (const [from, to] of Object.entries(EXPECTED_REDIRECTS)) {
    const stub = redirectPages.find((p) => p.urlPath === from);
    assert(stub, `no redirect emitted for ${from} — that URL would now 404`);

    // Astro writes `content="0;url=/"`. Accept any delay, require the target.
    const content = stub.$('meta[http-equiv="refresh"]').attr('content') ?? '';
    const target = content.match(/url=(.+)$/i)?.[1]?.trim();
    assert(target, `${from} has a refresh meta with no url: "${content}"`);

    const targetPath = target.startsWith('http') ? new URL(target).pathname : target;
    assert(
      targetPath === to,
      `${from} redirects to ${targetPath}, expected ${to}`,
    );
    assert(resolveToDist(targetPath), `${from} redirects to ${to}, which is not built`);
  }
  return Object.entries(EXPECTED_REDIRECTS)
    .map(([from, to]) => `${from} -> ${to}`)
    .join(', ');
});

check('redirects', 'redirect stubs stay out of the sitemap', () => {
  // A sitemap that advertises a redirect wastes crawl budget and invites the
  // "alternate page with proper canonical tag" report in Search Console.
  const bodies = Object.values(allSitemapText).join('\n');
  for (const stub of redirectPages) {
    const url = new URL(stub.urlPath, ORIGIN).href;
    assert(!bodies.includes(url), `sitemap lists the redirect stub ${stub.urlPath}`);
  }
  return `${redirectPages.length} stub(s) excluded`;
});

check('drafts', 'no draft or template content reached the build', () => {
  for (const page of pages) {
    assert(
      !page.urlPath.includes('_template'),
      `template file was published at ${page.urlPath}`,
    );
  }
  const leaked = [llms, llmsFull, ...pages.map((p) => p.html)].filter(
    (body) => body && body.includes('Authoring template'),
  );
  assert(leaked.length === 0, 'template placeholder text leaked into the output');
  return 'clean';
});

check('R7.3', 'images are optimized and responsive', () => {
  const home = pages.find((p) => p.urlPath === '/');
  const hero = home.$('img.site-header__bg');
  assert(hero.length === 1, 'hero image not found on the home page');
  assert(hero.attr('srcset'), 'hero image has no srcset');
  assert(hero.attr('sizes'), 'hero image has no sizes attribute');
  assert(/\.webp/.test(hero.attr('srcset')), 'hero srcset does not use a modern format');

  // Nothing oversized should ship. The source hero is a 282KB JPEG; if it
  // ever gets copied through unprocessed (e.g. moved into public/), this
  // catches it. Favicons are excluded — they are fixed-path and already small.
  const BUDGET_KB = 200;
  const heavy = allFiles
    .filter((f) => /\.(jpe?g|png|webp|avif|gif)$/i.test(f))
    .filter((f) => !f.includes(`${path.sep}assets${path.sep}img${path.sep}`))
    .map((f) => ({ f, kb: statSync(f).size / 1024 }))
    .filter(({ kb }) => kb > BUDGET_KB);
  assert(
    heavy.length === 0,
    `images over ${BUDGET_KB}KB in dist: ${heavy
      .map(({ f, kb }) => `${path.relative(DIST, f)} (${kb.toFixed(0)}KB)`)
      .join(', ')}`,
  );
  return `hero: ${hero.attr('srcset').split(',').length} variants, webp`;
});

/* ------------------------------------------------------------- report */

for (const pass of passes) {
  console.log(`  ✓ ${pass.id.padEnd(12)} ${pass.description}${pass.detail ? ` — ${pass.detail}` : ''}`);
}

if (failures.length > 0) {
  console.error('');
  for (const failure of failures) {
    console.error(`  ✗ ${failure.id.padEnd(12)} ${failure.description}\n      ${failure.message}`);
  }
  console.error(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}

console.log(`\nAll ${passes.length} checks passed.`);
