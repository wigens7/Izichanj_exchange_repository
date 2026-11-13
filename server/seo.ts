import type { Request } from "express";
import { seoFaqs, seoHome } from "../shared/seo-content";

const SITE_URL = "https://www.izichanj.com";
const OG_IMAGE = `${SITE_URL}/og/izichanj-exchange.png`;

type PublicPage = {
  title: string;
  description: string;
  path: string;
  content: string;
  schema?: Record<string, unknown>;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function brandMarkup() {
  return `<a class="seo-brand" href="/about" aria-label="Izichanj Exchange home"><span class="seo-brand-mark">I</span><span><strong>IZICHANJ</strong><small>EXCHANGE</small></span></a>`;
}

function homeMarkup() {
  const steps = seoHome.steps.map((step, index) => `
    <article class="seo-step">
      <span class="seo-step-number">0${index + 1}</span>
      <h3>${escapeHtml(step.title)}</h3>
      <p>${escapeHtml(step.description)}</p>
    </article>`).join("");
  return `<main class="seo-site">
    <header class="seo-container seo-nav">${brandMarkup()}
      <nav class="seo-nav-links" aria-label="Main navigation">
        <a href="/faq">FAQ</a><a href="/developers">Developers</a><a href="/login">Sign in</a>
        <a class="seo-button seo-button--small" href="/register">Create account <span aria-hidden="true">↗</span></a>
      </nav>
    </header>
    <section class="seo-container seo-hero">
      <div class="seo-hero-copy">
        <p class="seo-eyebrow"><span></span>${escapeHtml(seoHome.eyebrow)}</p>
        <h1>${escapeHtml(seoHome.heading)}</h1>
        <p class="seo-lede">${escapeHtml(seoHome.intro)}</p>
        <div class="seo-actions">
          <a class="seo-button" href="/register">${escapeHtml(seoHome.cta)} <span aria-hidden="true">→</span></a>
          <a class="seo-button seo-button--quiet" href="/login">${escapeHtml(seoHome.signIn)}</a>
        </div>
        <p class="seo-trust-note"><span aria-hidden="true">✓</span> Review the transaction details before confirming.</p>
      </div>
      <aside class="seo-hero-card" aria-label="Supported exchange overview">
        <div class="seo-card-kicker"><span></span> EXCHANGE OVERVIEW <span class="seo-country">HAITI</span></div>
        <div class="seo-flow">
          <div class="seo-flow-item"><span>YOU SEND</span><strong>USDT</strong><small>TRC20 · BEP20</small></div>
          <div class="seo-flow-arrow" aria-hidden="true">→</div>
          <div class="seo-flow-item seo-flow-item--accent"><span>LOCAL PAYOUT</span><strong>HTG</strong><small>MonCash · NatCash</small></div>
        </div>
        <div class="seo-card-foot"><span aria-hidden="true">✓</span> Options and current fees shown in your account</div>
      </aside>
    </section>
    <section class="seo-container seo-section">
      <div class="seo-section-heading"><p class="seo-eyebrow">HOW TO GET STARTED</p><h2>${escapeHtml(seoHome.howItWorks)}</h2></div>
      <div class="seo-steps">${steps}
      </div>
    </section>
    <section class="seo-container seo-section seo-services">
      <div class="seo-section-heading"><p class="seo-eyebrow">IZICHANJ PLATFORM</p><h2>${escapeHtml(seoHome.servicesTitle)}</h2></div>
      <div class="seo-service-grid">
        <article class="seo-service-card"><span class="seo-service-index">01 / EXCHANGE</span><h3>${escapeHtml(seoHome.exchangeTitle)}</h3><p>${escapeHtml(seoHome.exchangeDescription)}</p><a href="/faq">${escapeHtml(seoHome.faqLink)} <span aria-hidden="true">→</span></a></article>
        <article class="seo-service-card"><span class="seo-service-index">02 / VIRTUAL CARD</span><h3>${escapeHtml(seoHome.visaTitle)}</h3><p>${escapeHtml(seoHome.visaDescription)}</p><a href="/login">Sign in to review details <span aria-hidden="true">→</span></a></article>
        <article class="seo-service-card"><span class="seo-service-index">03 / MERCHANTS</span><h3>${escapeHtml(seoHome.merchantTitle)}</h3><p>${escapeHtml(seoHome.merchantDescription)}</p><a href="/developers">${escapeHtml(seoHome.developersLink)} <span aria-hidden="true">→</span></a></article>
      </div>
    </section>
    <footer class="seo-container seo-footer"><span>Izichanj Exchange</span><p>${escapeHtml(seoHome.footer)}</p></footer>
  </main>`;
}

function faqMarkup() {
  const questions = seoFaqs.map((item) => `
    <details class="seo-faq-item">
      <summary>${escapeHtml(item.question)}</summary>
      <p>${escapeHtml(item.answer)}</p>
    </details>`).join("");
  return `<main class="seo-site">
    <header class="seo-container seo-nav">${brandMarkup()}
      <nav class="seo-nav-links" aria-label="Main navigation">
        <a href="/developers">Developers</a><a href="/login">Sign in</a>
        <a class="seo-button seo-button--small" href="/register">Create account <span aria-hidden="true">↗</span></a>
      </nav>
    </header>
    <section class="seo-container seo-faq">
      <a class="seo-back-link" href="/about">← Back to Izichanj</a>
      <p class="seo-eyebrow"><span></span> HELP CENTER</p>
      <h1>Frequently asked questions</h1>
      <p class="seo-lede">Clear information about Izichanj services and where to verify current terms.</p>
      <div class="seo-faq-list">${questions}</div>
    </section>
    <footer class="seo-container seo-footer"><span>Izichanj Exchange</span><p>Always review the current details in your account before confirming a transaction.</p></footer>
  </main>`;
}

function developersMarkup() {
  return `<main class="seo-site">
    <header class="seo-container seo-nav">${brandMarkup()}
      <nav class="seo-nav-links" aria-label="Main navigation"><a href="/about">Exchange</a><a href="/faq">FAQ</a><a href="/login">Sign in</a></nav>
    </header>
    <section class="seo-container seo-faq">
      <a class="seo-back-link" href="/about">← Back to Izichanj</a>
      <p class="seo-eyebrow"><span></span> IZICHANJ PAY · API DOCUMENTATION</p>
      <h1>Build payments into your flow.</h1>
      <p class="seo-lede">Integrate Izichanj Pay to accept HTG and USDT payments. Review server-side examples, test-mode guidance, webhook verification, and merchant approval requirements.</p>
      <p class="seo-actions"><a class="seo-button" href="/developers#quickstart">Read the integration guide <span aria-hidden="true">→</span></a></p>
    </section>
  </main>`;
}

const publicPages: Record<string, PublicPage> = {
  "/about": {
    title: seoHome.title,
    description: seoHome.description,
    path: "/about",
    content: homeMarkup(),
    schema: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": `${SITE_URL}/#organization`,
          name: "Izichanj Exchange",
          url: `${SITE_URL}/`,
        },
        {
          "@type": "WebSite",
          "@id": `${SITE_URL}/#website`,
          name: "Izichanj Exchange",
          url: `${SITE_URL}/`,
          publisher: { "@id": `${SITE_URL}/#organization` },
          inLanguage: "en",
        },
        {
          "@type": "Service",
          "@id": `${SITE_URL}/#usdt-mobile-money-service`,
          name: "USDT to local mobile-money exchange",
          description: seoHome.description,
          serviceType: "USDT to local mobile money",
          provider: { "@id": `${SITE_URL}/#organization` },
          areaServed: { "@type": "Country", name: "Haiti" },
        },
      ],
    },
  },
  "/faq": {
    title: "Frequently Asked Questions | Izichanj Exchange",
    description:
      "Answers about exchanging USDT for MonCash or NatCash in Haiti, supported networks, virtual Visa cards, and Izichanj Pay.",
    path: "/faq",
    content: faqMarkup(),
    schema: {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: seoFaqs.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    },
  },
  "/developers": {
    title: "Developer documentation · Izichanj Pay",
    description:
      "Integrate Izichanj Pay with server-side API examples for HTG and USDT payments. Live use requires merchant approval.",
    path: "/developers",
    content: developersMarkup(),
  },
};

function replaceMeta(html: string, attribute: "name" | "property", key: string, value: string) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<meta\\b(?=[^>]*\\b${attribute}=["']${escapedKey}["'])[^>]*>`, "i");
  const tag = `<meta ${attribute}="${escapeHtml(key)}" content="${escapeHtml(value)}" />`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace("</head>", `    ${tag}\n  </head>`);
}

function replaceCanonical(html: string, url?: string) {
  const pattern = /<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/i;
  if (!url) return html.replace(pattern, "");
  const tag = `<link rel="canonical" href="${escapeHtml(url)}" />`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace("</head>", `    ${tag}\n  </head>`);
}

function withMetadata(indexHtml: string, page: PublicPage | null, route: string) {
  const isPrivate = !page;
  const title = page?.title ?? (route === "/register" ? "Create an account | Izichanj" : route === "/login" || route === "/" ? "Sign in | Izichanj" : "Izichanj account");
  const description = page?.description ?? "Sign in to access your Izichanj account.";
  let html = indexHtml.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = replaceMeta(html, "name", "description", description);
  html = replaceMeta(html, "name", "robots", isPrivate ? "noindex,nofollow" : "index,follow,max-image-preview:large");
  html = replaceCanonical(html, page ? `${SITE_URL}${page.path}` : undefined);

  const social = [
    ["og:type", "website"],
    ["og:site_name", "Izichanj"],
    ["og:url", page ? `${SITE_URL}${page.path}` : ""],
    ["og:title", page?.title ?? ""],
    ["og:description", page?.description ?? ""],
    ["og:image", page ? OG_IMAGE : ""],
    ["og:image:width", page ? "1200" : ""],
    ["og:image:height", page ? "630" : ""],
    ["og:locale", page ? "en_US" : ""],
  ] as const;
  for (const [key, value] of social) {
    html = value ? replaceMeta(html, "property", key, value) : html.replace(new RegExp(`<meta\\b(?=[^>]*\\bproperty=["']${key}["'])[^>]*>`, "i"), "");
  }

  const twitter = [
    ["twitter:card", page ? "summary_large_image" : ""],
    ["twitter:title", page?.title ?? ""],
    ["twitter:description", page?.description ?? ""],
    ["twitter:image", page ? OG_IMAGE : ""],
  ] as const;
  for (const [key, value] of twitter) {
    html = value ? replaceMeta(html, "name", key, value) : html.replace(new RegExp(`<meta\\b(?=[^>]*\\bname=["']${key}["'])[^>]*>`, "i"), "");
  }

  html = html.replace(/<meta\b(?=[^>]*\bproperty=["']og:locale:alternate["'])[^>]*>\s*/gi, "");
  html = html.replace(/<meta\b(?=[^>]*\bname=["']keywords["'])[^>]*>\s*/gi, "");
  html = html.replace(/<script\b(?=[^>]*\btype=["']application\/ld\+json["'])[^>]*>[\s\S]*?<\/script>\s*/gi, "");
  if (page?.schema) {
    const jsonLd = JSON.stringify(page.schema).replace(/</g, "\\u003c");
    html = html.replace("</head>", `    <script type="application/ld+json" data-seo-schema="true">${jsonLd}</script>\n  </head>`);
  }
  if (page) {
    html = html.replace(/<div id="root"><\/div>/i, `<div id="root">${page.content}</div>`);
  }
  return html;
}

const knownRoutes = new Set([
  "/", "/about", "/login", "/register", "/verify-email", "/forgot-password", "/faq", "/developers",
  "/deposit", "/withdraw", "/profile", "/security", "/admin", "/p2p", "/send-funds",
  "/virtual-cards", "/top-up", "/report", "/canal-plus", "/merchant",
]);

export function normalizeRequestPath(req: Request) {
  if (req.path === "/index.html") return "/";
  if (req.path.length > 1) return req.path.replace(/\/+$/, "");
  return req.path;
}

export function isKnownClientRoute(route: string) {
  return knownRoutes.has(route) || /^\/(?:checkout|verify)\/[^/]+$/.test(route);
}

export function isNoIndexClientRoute(route: string) {
  return isKnownClientRoute(route) && !publicPages[route];
}

export function renderSeoDocument(indexHtml: string, route: string) {
  return withMetadata(indexHtml, publicPages[route] ?? null, route);
}

export function renderNotFoundDocument() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Page not found | Izichanj</title></head><body style="margin:0;background:#0b0e13;color:#f4f5f6;font:16px system-ui,sans-serif"><main style="max-width:680px;margin:12vh auto;padding:32px"><p style="color:#f7a600;font-size:12px;letter-spacing:.16em">IZICHANJ EXCHANGE</p><h1>Page not found</h1><p style="color:#a5abb5;line-height:1.7">This address does not match a public page. Return to the Izichanj homepage.</p><a href="/about" style="color:#f7a600">Go to homepage</a></main></body></html>`;
}
