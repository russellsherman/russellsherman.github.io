# neverenough.info

Personal site for Russell Sherman. Astro 7, static output, zero client JavaScript.

Built to serve three audiences from one source: human readers, traditional search, and
AI agents (answer engines, training crawlers, agentic browsers). The high-value work —
real HTML, clean semantics, good writing — serves all three at once. The agent-specific
files (`llms.txt`, `ai.txt`) are a thin layer on top of that, not a substitute for it.

## Commands

| Command            | Does                                                       |
| ------------------ | ---------------------------------------------------------- |
| `npm run dev`      | Dev server on <http://localhost:4321>                      |
| `npm run build`    | Static build to `dist/`                                    |
| `npm run preview`  | Serve `dist/` locally                                      |
| `npm run check`    | `astro check` — TypeScript + template diagnostics           |
| `npm run verify`   | Requirement acceptance checks against `dist/`              |
| `npm test`         | `build` + `verify`                                          |
| `npm run lhci`     | Lighthouse CI — Core Web Vitals budgets (needs Chromium)   |

`npm run verify` is the interesting one: the requirements this site was built against are
executable, and a regression fails with the requirement ID rather than being noticed six
months later in a Search Console report. It currently runs 25 checks. See
[`scripts/verify.mjs`](scripts/verify.mjs).

## Writing

Posts live in `src/content/blog/`, projects in `src/content/projects/`. Copy the
`_template.md` in either directory — the leading underscore plus `draft: true` keeps
templates out of the build, and `verify.mjs` asserts none ever leak.

The filename is the URL slug: `src/content/blog/my-post.md` serves at `/posts/my-post/`.

Frontmatter is validated by [`src/content.config.ts`](src/content.config.ts), which is
where content requirements are enforced structurally instead of by remembering them:

- `description` is **required** on every post — a unique meta description per page is a
  requirement, so a forgotten one should fail the build, not silently fall back to a
  site-wide default.
- A project cannot be published without a `problem`, a `stack`, and (optionally but
  encouraged) `repo`/`demo` links. Lead with the problem you solved and how you thought
  about it; that reasoning is the half a resume bullet can't carry, and it's also what
  answer engines quote.

Write so a paragraph can be lifted and still make sense on its own. That's the same
discipline that makes a post quotable by a person and by a model.

Q&A content goes in as ordinary headings and prose — **not** `FAQPage` JSON-LD. Google
retired the FAQ rich result on 2026-05-07, so that markup now chases a feature that no
longer exists.

## How it's put together

```
src/
  consts.ts            Site identity — one source of truth for the canonical origin
                       and JSON-LD @ids, imported by astro.config.mjs too so they
                       can never drift apart
  content.config.ts    Collection schemas (see above)
  lib/schema.ts        JSON-LD graph builders — durable types only
  lib/bio.ts           Home page prose, shared with llms-full.txt so the agent-facing
                       text can't drift from what a human reader sees
  layouts/             BaseLayout (head, hero, landmarks), PostLayout
  pages/
    robots.txt.ts      Crawler policy, with the reasoning inline
    llms.txt.ts        Curated index, generated from the collections
    llms-full.txt.ts   Full text of every page, generated from the collections
    ai.txt.ts          Purpose-based permissions (training vs. citation)
    feed.xml.ts        RSS, at the URL jekyll-feed used
```

Every page emits `Person` and `WebSite` JSON-LD, not just the home page. It costs a few
hundred bytes and means a post's `author: {"@id": ...}` always resolves inside the same
document instead of depending on a crawler having already parsed the home page.

### Crawler policy

The distinction that matters is **citation vs. training**, and different user-agents serve
each. Answer bots (`OAI-SearchBot`, `Claude-SearchBot`, `PerplexityBot`) fetch a page in
order to cite it — blocking those removes the site from AI answers, the opposite of the
point. Training crawlers (`GPTBot`, `ClaudeBot`, `Google-Extended`) have no citation
upside and no traffic attached, so that's a real decision.

Both are currently allowed, deliberately, with attribution required via `/ai.txt`. The
reasoning is written inline in [`src/pages/robots.txt.ts`](src/pages/robots.txt.ts) — if
you revisit it, change the per-agent groups. Never a blanket
`User-agent: * / Disallow: /`; `verify.mjs` fails the build if an answer bot gets blocked.

Treat `llms.txt` as low-cost positioning, not a today-signal. Don't expect it to drive
traffic yet — most agents still hit rendered HTML, not a curated entry file.

## Migration notes (Jekyll → Astro)

URLs were preserved deliberately, so no inbound link or indexed canonical broke:

| URL              | Status                            |
| ---------------- | --------------------------------- |
| `/blog/`         | unchanged                         |
| `/posts/:slug/`  | unchanged (old `permalink` config) |
| `/feed.xml`      | unchanged (was `jekyll-feed`)     |
| `/keybase.txt`   | unchanged                         |
| `CNAME`          | moved to `public/`, still applied |

Deliberate changes from the original theme:

- The **fontello icon font** (5 files, ~24 KB, for 4 glyphs) is gone, replaced by inline
  SVG. Five fewer requests and no FOIT, plus each icon gets a real accessible name.
- The **`fluidType` Sass mixin** became `clamp()`. Each clamp reproduces the original
  320px→1280px interpolation line, so rendered sizes are unchanged — and there's no Sass
  dependency.
- The **hero photo** was a CSS `background-image` (a 282 KB JPEG, no responsive variants).
  It's now a real `<img>` through Astro's image pipeline: 3 WebP widths, 36–156 KB.
- **Muted text/links moved from `#999` to `#767676`.** `#999` on white is 2.84:1, under
  the 4.5:1 WCAG AA floor; Lighthouse flagged it on every page. `#767676` is the darkest
  gray that still reads as muted while clearing AA.
- The theme's **texture picker** JS and its five unused texture JPEGs were dropped
  (`showPicker` was already `false`).

## Deployment

GitHub Pages, via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) — the
built-in Pages Jekyll pipeline can't build an Astro site.

**One-time setup:** Settings → Pages → Build and deployment → Source → **GitHub Actions**.
While it's still on "Deploy from a branch", this workflow uploads an artifact that nothing
publishes.

The workflow type-checks, builds, and runs `verify` on every push and PR; it deploys only
from `main`. Lighthouse runs as a separate non-blocking job so a perf regression is loud
without stopping a content fix from shipping — flip `continue-on-error: false` to gate on it.

## Node version

Pinned in four places that must move together: `.nvmrc`, `package.json` `engines`,
`.devcontainer/devcontainer.json`, and the workflow (which reads `.nvmrc`).

Currently Node 22. Astro follows Node's LTS policy, so "even-numbered current LTS" is the
durable rule — Node 24 became Active LTS in October 2025, so this is due for a re-pin.

## Devcontainer

Single container, no compose stack — the site is service-light (no database, no queue), so
`docker-compose` would be the wrong weight. Because `.devcontainer/` is committed, every
`git worktree` inherits the same definition automatically: the environment is a property of
the branch, not the machine.

- **One container per worktree.** Nothing shared is stateful, so the only thing that could
  collide is the dev server, and forwarded ports are per-container (VS Code remaps
  4321 → 4322, …). Parallel `astro dev` instances coexist.
- **`npm ci`, not `npm install`** — deterministic installs matter more when N agents are
  each creating an environment.
- **`node_modules` is a named volume**, not on the bind-mounted worktree, so parallel
  worktrees don't fight over one install and a Linux install never clobbers a host macOS
  one. `sharp` ships native binaries; this is not theoretical.
