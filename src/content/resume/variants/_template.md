---
# ---------------------------------------------------------------------------
# Authoring template for a tailored resume. Copy it, don't edit it.
#
#   cp src/content/resume/variants/_template.md src/content/resume/variants/backend.md
#
# The filename is the URL slug. A variant publishes at:
#
#   /resume/backend/       HTML page, marked noindex
#   /resume/backend.md     plain Markdown
#   /resume/backend.pdf    printed from the page, same as the base
#
# It is published but *unlisted*: no sitemap entry, no llms.txt entry, no text
# in llms-full.txt, and no link from anywhere on the site. The URL is the only
# way in. Two things follow from that:
#
#   - The slug is part of what you disclose. `/resume/acme-corp/` tells Acme
#     exactly what it is looking at. Prefer a role-shaped slug.
#   - Unlisted is not private. Anyone with the link can read it, and so can
#     anyone they forward it to. For anything you would not want forwarded,
#     send the PDF as an attachment instead of the URL.
#
# `draft: true` below is what keeps this template out of the build. Delete that
# line in the copy — scripts/verify.mjs asserts no template ever ships.
# ---------------------------------------------------------------------------
draft: true
title: Resume — Backend platform
description: 'Resume of Russell Sherman, tailored for backend platform engineering roles.'
headline: CTO and co-founder. Backend platform and applied AI engineering.
updatedDate: 2026-08-07

# Contact overrides, all optional, all falling back to src/consts.ts. A variant
# is the right place for a phone number and a street address: it goes to one
# named recipient rather than onto an indexed page that training crawlers read.
# email: russ.sherman@gmail.com
# phone: '678.301.9014'
# address: '3390 Cayman Pl, Boulder, CO 80301'
---

## Summary

Start from the base resume in `src/content/resume/resume.md` and cut. A tailored
variant is almost always the base with two thirds removed and the remaining third
reordered, not new material.

## Experience

### Job Title — Company

_Mon YYYY – Present · Location_

- Same structure as the base: `### Title — Company`, then a single italic
  `_Dates · Location_` line, then bullets.
