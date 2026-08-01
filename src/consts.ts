/**
 * Single source of truth for site identity.
 *
 * Both `astro.config.mjs` and the page/schema layer import from here so the
 * canonical origin (R1.4) and the JSON-LD `@id` values (R3.2) can never drift
 * apart.
 */

export const SITE_URL = 'https://neverenough.info';

export const SITE_TITLE = 'never enough info';
export const SITE_TAGLINE = 'russell sherman';
export const SITE_DESCRIPTION =
  'Writing on software engineering, security, and building startups — by Russell Sherman, a founder and engineer in Boulder, Colorado.';

export const AUTHOR_NAME = 'Russell Sherman';
export const AUTHOR_EMAIL = 'russ@neverenough.info';
export const AUTHOR_LOCATION = 'Boulder, Colorado';

/**
 * Stable JSON-LD node identifiers. These are URI fragments on the home page,
 * which is what lets a BlogPosting's `author` reference resolve to the same
 * Person node the home page defines (R3.2).
 */
export const PERSON_ID = `${SITE_URL}/#person`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

/** Profiles used for JSON-LD `sameAs` and the header social links. */
export const SOCIAL = {
  github: 'https://github.com/russellsherman',
  linkedin: 'https://www.linkedin.com/in/neverenoughinfo',
  x: 'https://x.com/russellsherman',
} as const;

export const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

export function formatDate(date: Date): string {
  return DATE_FORMAT.format(date);
}
