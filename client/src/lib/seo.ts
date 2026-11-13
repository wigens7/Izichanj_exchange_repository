export type SeoMetadata = {
  title: string;
  description: string;
  path: string;
  image?: string;
  schema?: Record<string, unknown>;
};

function upsertMeta(attribute: "name" | "property", name: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${name}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attribute, name);
    document.head.appendChild(tag);
  }
  tag.content = content;
}

export function setPageMetadata({
  title,
  description,
  path,
  image = "https://www.izichanj.com/og/izichanj-exchange.png",
  schema,
}: SeoMetadata) {
  const canonicalUrl = `https://www.izichanj.com${path}`;
  document.title = title;
  document.documentElement.lang = "en";

  upsertMeta("name", "description", description);
  upsertMeta("name", "robots", "index,follow,max-image-preview:large");
  upsertMeta("property", "og:type", "website");
  upsertMeta("property", "og:site_name", "Izichanj");
  upsertMeta("property", "og:url", canonicalUrl);
  upsertMeta("property", "og:title", title);
  upsertMeta("property", "og:description", description);
  upsertMeta("property", "og:image", image);
  upsertMeta("property", "og:image:width", "1200");
  upsertMeta("property", "og:image:height", "630");
  upsertMeta("property", "og:locale", "en_US");
  upsertMeta("name", "twitter:card", "summary_large_image");
  upsertMeta("name", "twitter:title", title);
  upsertMeta("name", "twitter:description", description);
  upsertMeta("name", "twitter:image", image);

  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }
  canonical.href = canonicalUrl;

  let jsonLd = document.head.querySelector<HTMLScriptElement>('script[type="application/ld+json"][data-seo-schema]');
  if (schema) {
    if (!jsonLd) {
      jsonLd = document.createElement("script");
      jsonLd.type = "application/ld+json";
      jsonLd.dataset.seoSchema = "true";
      document.head.appendChild(jsonLd);
    }
    jsonLd.textContent = JSON.stringify(schema);
  } else {
    jsonLd?.remove();
  }
}
