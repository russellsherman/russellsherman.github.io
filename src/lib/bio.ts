/**
 * The home page bio, in one place.
 *
 * The home page renders these paragraphs and /llms-full.txt emits them, so
 * the curated agent-facing text cannot silently drift from what a human
 * reader sees (R4.2 — "content matches canonical pages").
 */
export const BIO_PARAGRAPHS = [
  "I'm a start-up founder, software engineer, information security professional, and serial hobbyist living in Boulder, Colorado.",
  'This is where I write things down — mostly about building software, securing it, and the tradeoffs that show up in between.',
] as const;

export const BIO_HEADING = "Hello! I'm Russell Sherman.";
