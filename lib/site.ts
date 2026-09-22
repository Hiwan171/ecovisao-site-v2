/**
 * Where the site lives. Set NEXT_PUBLIC_SITE_URL to the real address (no trailing slash)
 * before publishing: canonical links, the share image and the sitemap are built from it.
 * Until it is set they point at the local server.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** True only when a real address has been configured. */
export const SITE_IS_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_SITE_URL);
