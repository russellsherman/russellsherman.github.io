---
# Authoring template — the leading underscore keeps it out of the build.
# Copy to a new file; the filename becomes the anchor id on /projects/.
#
# The frontmatter fields below are required by src/content.config.ts, which is
# how R6.2 ("lead with the problem, link the source, list the stack") is
# enforced structurally instead of by remembering to do it.
title: 'Project name'
description: 'One sentence — what it is. Becomes the JSON-LD description.'
problem: >-
  What was actually broken or missing, stated concretely. Not "a platform for
  X" but "deploys took 40 minutes and nobody could tell which commit was live."
stack: ['Node', 'Postgres']
# repo: https://github.com/russellsherman/example
# demo: https://example.com
startDate: 2026-01-01
# endDate: 2026-06-01
order: 100
draft: true
---

## How I thought about it

The body is for the reasoning — the constraint that drove the design, the option you
rejected and why, what you'd do differently. This is the half that a resume bullet cannot
carry and the half worth reading (R6.1).

## What it turned into

Outcomes, with numbers where you have them.
