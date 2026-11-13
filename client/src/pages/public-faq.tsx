import { useEffect } from "react";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { seoFaqs } from "@shared/seo-content";
import { setPageMetadata } from "@/lib/seo";

const title = "Frequently Asked Questions | Izichanj Exchange";
const description =
  "Answers about exchanging USDT for MonCash or NatCash in Haiti, supported networks, virtual Visa cards, and Izichanj Pay.";
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: seoFaqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  })),
};

export default function PublicFAQPage() {
  useEffect(() => {
    setPageMetadata({ title, description, path: "/faq", schema: faqSchema });
  }, []);

  return (
    <main className="seo-site">
      <header className="seo-container seo-nav">
        <a className="seo-brand" href="/" aria-label="Izichanj Exchange home">
          <span className="seo-brand-mark">I</span>
          <span><strong>IZICHANJ</strong><small>EXCHANGE</small></span>
        </a>
        <nav className="seo-nav-links" aria-label="Main navigation">
          <a href="/developers">Developers</a>
          <a href="/login">Sign in</a>
          <a className="seo-button seo-button--small" href="/register">Create account <ArrowUpRight size={15} aria-hidden="true" /></a>
        </nav>
      </header>
      <section className="seo-container seo-faq">
        <a className="seo-back-link" href="/"><ArrowLeft size={15} aria-hidden="true" /> Back to Izichanj</a>
        <p className="seo-eyebrow"><span /> HELP CENTER</p>
        <h1>Frequently asked questions</h1>
        <p className="seo-lede">Clear information about Izichanj services and where to verify current terms.</p>
        <div className="seo-faq-list">
          {seoFaqs.map((faq) => (
            <details className="seo-faq-item" key={faq.question}>
              <summary>{faq.question}</summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>
      <footer className="seo-container seo-footer">
        <span>© {new Date().getFullYear()} Izichanj Exchange</span>
        <p>Always review the current details in your account before confirming a transaction.</p>
      </footer>
    </main>
  );
}
