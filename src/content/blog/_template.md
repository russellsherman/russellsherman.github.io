---
# Authoring template. The leading underscore keeps this file out of the build
# (see the glob pattern in src/content.config.ts), so it is never published.
# Copy it to a new file named for the URL slug you want: a file called
# `my-post.md` is served at /posts/my-post/.
title: 'Post title'
# R2.4 — required by the schema, because a unique meta description per page is
# a requirement and a forgotten one should fail the build, not fall back to a
# site-wide default.
description: 'One or two sentences. This becomes the meta description and the lede.'
pubDate: 2026-01-01
# updatedDate: 2026-02-01
tags: []
draft: true
---

Open with the point, not with preamble.

R6.3 — write so a paragraph can be lifted and still make sense. If a claim depends on
context established three pages ago, restate the context in a clause. That is the same
discipline that makes a post quotable by a person and by an answer engine.

## Use headings to carry the structure

R2.1 — start at `##` here. The page `<h1>` is the post title, rendered by the layout, so
body headings begin one level down and must not skip a level.

Q&A belongs here, as ordinary headings and prose (R2.3) — not as `FAQPage` JSON-LD.
