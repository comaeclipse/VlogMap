// Canonical production URL, used for sitemap, robots, and metadata base.
// Override with NEXT_PUBLIC_SITE_URL if needed (e.g. staging); defaults to the
// production domain so crawlers always see canonical links.
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://vlogmap.world"
).replace(/\/$/, "")
