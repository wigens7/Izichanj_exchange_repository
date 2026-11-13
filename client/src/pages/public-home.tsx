import { useEffect } from "react";
import { ArrowRight, ArrowUpRight, Check, ShieldCheck } from "lucide-react";
import { seoHome } from "@shared/seo-content";
import { setPageMetadata } from "@/lib/seo";

const organizationSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://www.izichanj.com/#organization",
      name: "Izichanj Exchange",
      url: "https://www.izichanj.com/",
    },
    {
      "@type": "WebSite",
      "@id": "https://www.izichanj.com/#website",
      name: "Izichanj Exchange",
      url: "https://www.izichanj.com/",
      publisher: { "@id": "https://www.izichanj.com/#organization" },
      inLanguage: "en",
    },
    {
      "@type": "Service",
      "@id": "https://www.izichanj.com/#usdt-mobile-money-service",
      name: "USDT to local mobile-money exchange",
      description: seoHome.description,
      serviceType: "USDT to local mobile money",
      provider: { "@id": "https://www.izichanj.com/#organization" },
      areaServed: { "@type": "Country", name: "Haiti" },
    },
  ],
};

export default function PublicHomePage() {
  useEffect(() => {
    setPageMetadata({
      title: seoHome.title,
      description: seoHome.description,
      path: "/",
      schema: organizationSchema,
    });
  }, []);

  return (
    <main className="seo-site">
      <header className="seo-container seo-nav">
        <a className="seo-brand" href="/" aria-label="Izichanj Exchange home">
          <span className="seo-brand-mark">I</span>
          <span>
            <strong>IZICHANJ</strong>
            <small>EXCHANGE</small>
          </span>
        </a>
        <nav className="seo-nav-links" aria-label="Main navigation">
          <a href="/faq">FAQ</a>
          <a href="/developers">Developers</a>
          <a href="/login">Sign in</a>
          <a className="seo-button seo-button--small" href="/register">
            Create account <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        </nav>
      </header>

      <section className="seo-container seo-hero">
        <div className="seo-hero-copy">
          <p className="seo-eyebrow"><span />{seoHome.eyebrow}</p>
          <h1>{seoHome.heading}</h1>
          <p className="seo-lede">{seoHome.intro}</p>
          <div className="seo-actions">
            <a className="seo-button" href="/register">
              {seoHome.cta} <ArrowRight size={17} aria-hidden="true" />
            </a>
            <a className="seo-button seo-button--quiet" href="/login">{seoHome.signIn}</a>
          </div>
          <p className="seo-trust-note"><ShieldCheck size={16} aria-hidden="true" /> Review the transaction details before confirming.</p>
        </div>
        <aside className="seo-hero-card" aria-label="Supported exchange overview">
          <div className="seo-card-kicker"><span /> EXCHANGE OVERVIEW <span className="seo-country">HAITI</span></div>
          <div className="seo-flow">
            <div className="seo-flow-item"><span>YOU SEND</span><strong>USDT</strong><small>TRC20 · BEP20</small></div>
            <div className="seo-flow-arrow"><ArrowRight size={18} aria-hidden="true" /></div>
            <div className="seo-flow-item seo-flow-item--accent"><span>LOCAL PAYOUT</span><strong>HTG</strong><small>MonCash · NatCash</small></div>
          </div>
          <div className="seo-card-foot"><Check size={15} aria-hidden="true" /> Options and current fees shown in your account</div>
        </aside>
      </section>

      <section className="seo-container seo-section">
        <div className="seo-section-heading">
          <p className="seo-eyebrow">HOW TO GET STARTED</p>
          <h2>{seoHome.howItWorks}</h2>
        </div>
        <div className="seo-steps">
          {seoHome.steps.map((step, index) => (
            <article className="seo-step" key={step.title}>
              <span className="seo-step-number">0{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="seo-container seo-section seo-services">
        <div className="seo-section-heading">
          <p className="seo-eyebrow">IZICHANJ PLATFORM</p>
          <h2>{seoHome.servicesTitle}</h2>
        </div>
        <div className="seo-service-grid">
          <article className="seo-service-card">
            <span className="seo-service-index">01 / EXCHANGE</span>
            <h3>{seoHome.exchangeTitle}</h3>
            <p>{seoHome.exchangeDescription}</p>
            <a href="/faq">{seoHome.faqLink} <ArrowRight size={15} aria-hidden="true" /></a>
          </article>
          <article className="seo-service-card">
            <span className="seo-service-index">02 / VIRTUAL CARD</span>
            <h3>{seoHome.visaTitle}</h3>
            <p>{seoHome.visaDescription}</p>
            <a href="/login">Sign in to review details <ArrowRight size={15} aria-hidden="true" /></a>
          </article>
          <article className="seo-service-card">
            <span className="seo-service-index">03 / MERCHANTS</span>
            <h3>{seoHome.merchantTitle}</h3>
            <p>{seoHome.merchantDescription}</p>
            <a href="/developers">{seoHome.developersLink} <ArrowRight size={15} aria-hidden="true" /></a>
          </article>
        </div>
      </section>

      <footer className="seo-container seo-footer">
        <span>© {new Date().getFullYear()} Izichanj Exchange</span>
        <p>{seoHome.footer}</p>
      </footer>
    </main>
  );
}
