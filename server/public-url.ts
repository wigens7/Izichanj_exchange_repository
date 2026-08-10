/**
 * The single public URL used in links sent to users and external providers.
 *
 * Keep this configurable for Railway previews, but use the canonical www
 * domain in production so links do not send users back to the old host.
 */
export const PUBLIC_APP_URL = (
  process.env.PUBLIC_APP_URL || "https://www.izichanj.com"
).replace(/\/+$/, "");