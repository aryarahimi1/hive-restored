/**
 * src/server/federation/wikiBroker.ts
 *
 * Shared constants for the wiki-based federation transport.
 * The full publisher/subscriber implementations live in
 * wikiPublisher.ts and wikiSubscriber.ts respectively.
 */

/** The canonical wiki page name where each sub publishes its threat feed. */
export const HIVE_WIKI_PAGE = 'hive-threats' as const;

/**
 * Maximum size (in serialised JSON characters) for a single wiki page
 * before rotating. Conservative under Reddit's ~500KB raw limit.
 */
export const WIKI_PAGE_MAX_CHARS = 400_000;

/**
 * Minimum gap between successive writes to the same wiki page, in ms.
 * Reddit rate-limits wiki edits at roughly one per minute per page.
 */
export const WIKI_WRITE_COOLDOWN_MS = 60_000;
