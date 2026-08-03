/**
 * JSON-LD graph builders (R3).
 *
 * Scope is deliberately narrow. Only types that describe what the content
 * *is* appear here — Person, WebSite, Article/BlogPosting, BreadcrumbList
 * (R3.3). Notably absent: FAQPage. Google retired the FAQ rich result on
 * 2026-05-07, so that markup now describes a SERP feature that no longer
 * exists; Q&A content on this site lives as ordinary headings and prose
 * instead (R2.3).
 *
 * Every page emits the Person and WebSite nodes, not just the home page.
 * That costs a few hundred bytes and means an `author: {'@id': ...}`
 * reference on a post always resolves within the same document rather than
 * relying on a crawler having already parsed the home page (R3.2).
 */

import {
  AUTHOR_EMAIL,
  AUTHOR_LOCATION,
  AUTHOR_NAME,
  PERSON_ID,
  SITE_DESCRIPTION,
  SITE_TITLE,
  SITE_URL,
  SOCIAL,
  WEBSITE_ID,
} from '../consts';

export type JsonLdNode = Record<string, unknown>;

const [city, region] = AUTHOR_LOCATION.split(',').map((part) => part.trim());

export function personNode(): JsonLdNode {
  return {
    '@type': 'Person',
    '@id': PERSON_ID,
    name: AUTHOR_NAME,
    url: `${SITE_URL}/`,
    email: `mailto:${AUTHOR_EMAIL}`,
    description:
      'Start-up founder, software engineer, and information security professional.',
    homeLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: city,
        addressRegion: region,
        addressCountry: 'US',
      },
    },
    sameAs: [SOCIAL.github, SOCIAL.linkedin, SOCIAL.x],
  };
}

export function webSiteNode(): JsonLdNode {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: `${SITE_URL}/`,
    name: SITE_TITLE,
    description: SITE_DESCRIPTION,
    inLanguage: 'en-US',
    publisher: { '@id': PERSON_ID },
    author: { '@id': PERSON_ID },
  };
}

interface BlogPostingInput {
  title: string;
  description: string;
  canonical: string;
  pubDate: Date;
  updatedDate?: Date;
  tags?: string[];
}

export function blogPostingNode(post: BlogPostingInput): JsonLdNode {
  return {
    '@type': 'BlogPosting',
    '@id': `${post.canonical}#article`,
    headline: post.title,
    description: post.description,
    url: post.canonical,
    datePublished: post.pubDate.toISOString(),
    dateModified: (post.updatedDate ?? post.pubDate).toISOString(),
    // R3.2 — resolves to the Person node emitted alongside it.
    author: { '@id': PERSON_ID },
    publisher: { '@id': PERSON_ID },
    isPartOf: { '@id': WEBSITE_ID },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': post.canonical,
    },
    inLanguage: 'en-US',
    ...(post.tags?.length ? { keywords: post.tags.join(', ') } : {}),
  };
}

export function breadcrumbNode(
  trail: Array<{ name: string; url: string }>,
): JsonLdNode {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  };
}

/** Wraps nodes in a single @graph so cross-references resolve by @id. */
export function buildGraph(extra: JsonLdNode[] = []): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [personNode(), webSiteNode(), ...extra],
  });
}
