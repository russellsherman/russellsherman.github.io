#!/usr/bin/env node
/**
 * Prints every built resume page to a PDF beside it.
 *
 *   dist/resume/index.html         -> dist/resume.pdf
 *   dist/resume/<slug>/index.html  -> dist/resume/<slug>.pdf
 *
 * Pages are discovered from dist/ rather than from a list, so adding a variant
 * under src/content/resume/variants/ is enough — there is no second place to
 * register it.
 *
 * Runs after `astro build` (see the `build` script in package.json), which is
 * what makes the PDF a *derived* artifact rather than another copy of the
 * resume. The Markdown source is the only file anyone edits; the HTML page,
 * the .md file and this PDF all fall out of it, so they cannot drift. Nothing
 * is committed — PDFs are built in CI and published with the rest of dist/.
 *
 * The layout is not defined here. It is the `@media print` block in
 * src/styles/global.css, applied to the same page a human sees. This file only
 * decides paper size and margins; everything visual is in the stylesheet.
 *
 * Why a local HTTP server instead of loading the file over file://: Astro
 * links its stylesheet and hero image with absolute paths (`/_astro/…`), which
 * resolve to the filesystem root under file:// and 404. Serving dist/ over
 * loopback makes those paths mean what they mean in production.
 *
 * Usage: node scripts/build-resume-pdf.mjs
 */

import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const RESUME_DIR = path.join(DIST, 'resume');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.xml': 'application/xml',
};

if (!existsSync(path.join(RESUME_DIR, 'index.html'))) {
  console.error(
    'dist/resume/index.html not found — run `astro build` before this script.',
  );
  process.exit(1);
}

/** Every resume page in dist, as `{ url, out }`. Base first, variants after. */
async function findResumePages() {
  const jobs = [{ url: '/resume/', out: path.join(DIST, 'resume.pdf') }];
  for (const entry of await readdir(RESUME_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (!existsSync(path.join(RESUME_DIR, entry.name, 'index.html'))) continue;
    jobs.push({
      url: `/resume/${entry.name}/`,
      out: path.join(RESUME_DIR, `${entry.name}.pdf`),
    });
  }
  return jobs;
}

/* ------------------------------------------------------- static server */

/** Resolve a URL path to a file inside dist, or null. Refuses to escape DIST. */
async function resolve(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const target = path.resolve(DIST, `.${path.posix.normalize(decoded)}`);
  if (target !== DIST && !target.startsWith(DIST + path.sep)) return null;

  for (const candidate of [target, path.join(target, 'index.html')]) {
    const info = await stat(candidate).catch(() => null);
    if (info?.isFile()) return candidate;
  }
  return null;
}

const server = createServer(async (req, res) => {
  const file = await resolve(req.url ?? '/');
  if (!file) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
  });
  createReadStream(file).pipe(res);
});

await new Promise((resolve_, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve_);
});
const { port } = server.address();

/* ------------------------------------------------------------- print */

let browser;
try {
  const { chromium } = await import('playwright');
  browser = await chromium.launch({
    // Matches the flags lighthouserc.json uses — CI containers have no user
    // namespaces for the sandbox and a small default /dev/shm.
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage();

  for (const job of await findResumePages()) {
    const url = `http://127.0.0.1:${port}${job.url}`;

    const response = await page.goto(url, { waitUntil: 'networkidle' });
    if (!response?.ok()) {
      throw new Error(`${url} returned ${response?.status() ?? 'no response'}`);
    }

    // The hero <img> is hidden in print, but fonts are not: the site sets in a
    // system mono stack, and printing before it has resolved gives a PDF laid
    // out in the fallback face.
    await page.evaluate(() => document.fonts.ready);

    await page.pdf({
      path: job.out,
      format: 'Letter',
      // Margins come from `@page` in global.css so the stylesheet stays the
      // single place the printed layout is described. Chromium only honours it
      // when no margin is passed here.
      preferCSSPageSize: true,
      // The palette is redefined for print rather than relying on the browser's
      // "print backgrounds off" default, so backgrounds must actually render —
      // otherwise the rules and code blocks disappear.
      printBackground: true,
      displayHeaderFooter: false,
      tagged: true,
    });

    const { size } = await stat(job.out);
    const rel = path.relative(DIST, job.out);
    console.log(`  ✓ ${rel.padEnd(24)} printed from ${job.url} — ${(size / 1024).toFixed(0)}KB`);
  }
} catch (error) {
  if (error?.message?.includes("Executable doesn't exist")) {
    console.error(
      "Playwright's Chromium is not installed. Run:\n\n  npx playwright install chromium\n",
    );
  }
  throw error;
} finally {
  await browser?.close();
  server.close();
}
