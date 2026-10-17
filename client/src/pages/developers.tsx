import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowDownRight,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Code2,
  Copy,
  KeyRound,
  LockKeyhole,
  Menu,
  ShieldCheck,
  Terminal,
  Webhook,
  X,
} from 'lucide-react';

const checkoutCurl = `curl -X POST https://izichanj.com/api/v1/checkout \\
  -H "Authorization: Bearer izk_test_sk_YOUR_TEST_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"amount": 100, "currency": "USDT", "order_id": "order-123",
       "description": "Order #123",
       "success_url": "https://yourstore.com/success",
       "cancel_url": "https://yourstore.com/cancel"}'`;

const checkoutNode = `const response = await fetch("https://izichanj.com/api/v1/checkout", {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${process.env.IZICHANJ_SECRET_KEY}\`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    amount: 100,
    currency: "USDT",
    order_id: "order-123",
    description: "Order #123",
    success_url: "https://yourstore.com/success",
    cancel_url: "https://yourstore.com/cancel"
  })
});

const checkout = await response.json();
// Send checkout.checkout_url to your customer from your server.`;

const paymentCurl = `curl https://izichanj.com/api/v1/payment/pay_xxx \\
  -H "Authorization: Bearer izk_test_sk_YOUR_TEST_SECRET_KEY"`;

const webhookNode = `const expected = crypto
  .createHmac("sha256", process.env.IZICHANJ_SECRET_KEY)
  .update(rawRequestBody)
  .digest("hex");

if (signature !== expected) return res.sendStatus(401);`;

async function copyText(value: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fall through to the legacy selection-based clipboard path.
  }

  let field: HTMLTextAreaElement | undefined;
  try {
    field = document.createElement('textarea');
    field.value = value;
    field.setAttribute('readonly', '');
    field.setAttribute('aria-hidden', 'true');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    field.style.pointerEvents = 'none';
    document.body.appendChild(field);
    field.select();
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    field?.remove();
  }
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [state, setState] = useState<'idle' | 'success' | 'failure'>('idle');

  async function handleCopy() {
    const copied = await copyText(value);
    setState(copied ? 'success' : 'failure');
    window.setTimeout(() => setState('idle'), 2800);
  }

  const text = state === 'success' ? 'Copied' : state === 'failure' ? 'Copy unavailable' : 'Copy';
  const Icon = state === 'success' ? Check : state === 'failure' ? CircleHelp : Copy;

  return (
    <div className="flex items-center gap-2">
      {state !== 'idle' && (
        <span
          className={`copy-feedback text-[11px] ${state === 'success' ? 'text-emerald-300' : 'text-amber-200'}`}
          role="status"
          aria-live="polite"
          data-testid={`copy-status-${label}`}
        >
          {state === 'success' ? 'Copied to clipboard' : 'Clipboard unavailable. Select and copy the code.'}
        </span>
      )}
      <button
        type="button"
        onClick={handleCopy}
        aria-label={`Copy ${label} code`}
        title={`Copy ${label} code`}
        data-testid={`button-copy-${label}`}
        className="inline-flex min-h-9 items-center gap-2 rounded-md border border-[#414548] bg-[#272a2c] px-3 text-xs font-semibold text-[#e8e7e1] transition-colors hover:border-[#77736a] hover:bg-[#303335] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f7a600]"
      >
        <Icon size={14} aria-hidden="true" />
        <span>{text}</span>
      </button>
    </div>
  );
}

function CodePanel({
  title,
  language,
  code,
  id,
  compact = false,
}: {
  title: string;
  language: string;
  code: string;
  id: string;
  compact?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#383b3d] bg-[#17191b] shadow-[0_12px_32px_rgba(0,0,0,.18)]" data-testid={`code-panel-${id}`}>
      <div className="flex min-h-[52px] items-center justify-between gap-3 border-b border-[#343638] bg-[#1d1f21] px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#3a3d3f] bg-[#25282a] text-[#f3b943]" aria-hidden="true">
            <Terminal size={14} />
          </span>
          <span className="truncate text-[13px] font-medium text-[#e4e2dc]" data-testid={`text-code-title-${id}`}>{title}</span>
          <span className="hidden rounded border border-[#3a3d3f] px-1.5 py-0.5 font-code text-[10px] uppercase tracking-wide text-[#8f9394] sm:inline">{language}</span>
        </div>
        <CopyButton value={code} label={id} />
      </div>
      <pre className={`code-scroll overflow-x-auto px-4 py-4 font-code text-[12px] leading-[1.85] text-[#d5d2c9] sm:px-5 sm:text-[13px] ${compact ? 'max-h-[290px]' : ''}`} tabIndex={0} aria-label={`${title} code sample`}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

const toc = [
  { id: 'quickstart', title: 'Quick start', number: '01' },
  { id: 'create-checkout', title: 'Create a checkout', number: '02' },
  { id: 'verify-payment', title: 'Verify a payment', number: '03' },
  { id: 'webhooks', title: 'Webhooks', number: '04' },
  { id: 'security', title: 'Security', number: '05' },
];

export default function DevelopersPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    document.title = 'Developer documentation · Izichanj Pay';
    let description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!description) {
      description = document.createElement('meta');
      description.name = 'description';
      document.head.appendChild(description);
    }
    description.content = 'Integrate Izichanj Pay into your website. API reference and server-side examples for accepting HTG and USDT payments.';
  }, []);

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  return (
    <div className="doc-shell min-h-[100dvh] text-[#f2f1ed]">
      <a href="#main-content" className="sr-only z-[100] rounded-md bg-[#f7a600] p-3 font-semibold text-black focus:not-sr-only focus:fixed focus:left-4 focus:top-4" data-testid="link-skip-content">
        Skip to documentation
      </a>

      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#111315]/95 backdrop-blur-xl">
        <div className="wide-container mx-auto flex h-[68px] max-w-[1680px] items-center justify-between px-4 sm:px-7 xl:px-10">
          <div className="flex items-center gap-3">
            <a href="#top" className="flex items-center gap-3 rounded-sm" aria-label="Izichanj Pay developer documentation home" data-testid="link-brand-home">
              <span className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-[#f7a600] text-[#171716]">
                <span className="font-display text-[21px] font-extrabold leading-none">i</span>
                <span className="absolute bottom-[8px] right-[8px] h-[4px] w-[4px] rounded-full bg-[#171716]" />
              </span>
              <span className="leading-tight">
                <span className="block font-display text-[16px] font-bold tracking-[-.03em]">izichanj<span className="text-[#f7a600]">.</span></span>
                <span className="block text-[10px] tracking-[.13em] text-[#929596]">DEVELOPER PORTAL</span>
              </span>
            </a>
            <span className="mx-2 hidden h-7 w-px bg-white/10 sm:block" />
            <span className="hidden text-[13px] text-[#a2a5a5] sm:block">Izichanj Pay API</span>
          </div>

          <div className="hidden items-center gap-5 md:flex">
            <a href="#quickstart" className="text-[13px] text-[#b9b9b3] transition-colors hover:text-white" data-testid="link-header-quickstart">Documentation</a>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#3a3c3c] bg-[#1a1c1e] px-3 py-1.5 text-[11px] font-medium text-[#c4c4bd]" data-testid="status-api-reference">
              <span className="h-1.5 w-1.5 rounded-full bg-[#e4aa32]" />
              API reference
            </span>
          </div>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#393c3e] text-[#e8e6e0] md:hidden"
            aria-label={mobileMenuOpen ? 'Close documentation menu' : 'Open documentation menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-doc-menu"
            onClick={() => setMobileMenuOpen((open) => !open)}
            data-testid="button-mobile-menu"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
        {mobileMenuOpen && (
          <nav id="mobile-doc-menu" className="border-t border-white/[0.08] bg-[#151719] px-4 py-3 md:hidden" aria-label="Mobile documentation navigation">
            {toc.map((item) => (
              <a key={item.id} href={`#${item.id}`} onClick={closeMobileMenu} className="flex items-center justify-between border-b border-white/[0.06] py-3 text-sm text-[#c9c8c1] last:border-0" data-testid={`link-mobile-${item.id}`}>
                <span>{item.title}</span><ChevronRight size={15} className="text-[#8c8f90]" />
              </a>
            ))}
          </nav>
        )}
      </header>

      <div className="wide-container wide-grid mx-auto grid max-w-[1680px] grid-cols-1 px-4 sm:px-7 xl:grid-cols-[216px_minmax(0,1fr)_200px] xl:gap-10 xl:px-10 2xl:grid-cols-[240px_minmax(0,1fr)_220px] 2xl:gap-14">
        <aside className="hidden xl:block">
          <div className="sticky top-[100px] pt-10">
            <p className="mb-4 px-3 text-[10px] font-semibold uppercase tracking-[.19em] text-[#74797a]">Getting started</p>
            <nav className="space-y-1" aria-label="Documentation sections">
              {toc.map((item, index) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  data-testid={`link-toc-${item.id}`}
                  className={`group flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] transition-colors hover:bg-white/[0.045] hover:text-white ${index === 0 ? 'text-[#f3bb4b]' : 'text-[#a3a6a6]'}`}
                >
                  <span className="font-code text-[10px] text-[#666b6c] group-hover:text-[#e0a72f]">{item.number}</span>
                  {item.title}
                </a>
              ))}
            </nav>
            <div className="my-7 h-px bg-white/[0.08]" />
            <div className="rounded-xl border border-[#373a3b] bg-[#191c1e] p-4">
              <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-[#f7a600]/10 text-[#f3bb4b]">
                <LockKeyhole size={16} />
              </div>
              <p className="text-[12px] font-semibold text-[#e5e3dc]">Keep keys private</p>
              <p className="mt-1.5 text-[11px] leading-[1.65] text-[#969a9a]">Secret keys belong on your server, never in browser code.</p>
              <a href="#security" className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-[#e4ad3e] hover:text-[#ffd16b]" data-testid="link-sidebar-security">Security notes <ArrowRight size={12} /></a>
            </div>
            <p className="px-3 pt-6 font-code text-[10px] text-[#666b6c]">IZICHANJ PAY · API</p>
          </div>
        </aside>

        <main id="main-content" className="min-w-0 pb-20 pt-8 sm:pt-12 xl:pt-14" data-testid="page-developer-docs">
          <div id="top" className="mb-9">
            <div className="mb-5 flex items-center gap-2 text-[11px] font-medium tracking-[.09em] text-[#919595]">
              <span>DEVELOPERS</span><ChevronRight size={12} /><span className="text-[#e0ad46]">API DOCUMENTATION</span>
            </div>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_215px] lg:items-end">
              <div>
                <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.17em] text-[#e4ad3e]">
                  <span className="h-px w-6 bg-[#e4ad3e]" /> Payments integration
                </p>
                <h1 className="wide-heading font-display max-w-[760px] text-[39px] font-semibold leading-[1.06] tracking-[-.045em] text-[#f2f1ed] sm:text-[52px] lg:text-[58px]" data-testid="text-page-title">
                  Build payments into <span className="text-[#f2b943]">your flow.</span>
                </h1>
                <p className="mt-5 max-w-[640px] text-[14px] leading-7 text-[#a7aaa9] sm:text-[15px]">
                  Accept HTG and USDT on your website with Izichanj Pay. Start with test keys, then use live keys after merchant approval. Verify each payment before fulfilling an order.
                </p>
              </div>
              <div className="hidden border-l border-[#3a3c3d] pl-5 pb-1 lg:block">
                <span className="font-code text-[10px] uppercase tracking-[.14em] text-[#777d7d]">API host</span>
                <p className="mt-2 font-code text-[12px] text-[#e8e5dc]" data-testid="text-api-host">izichanj.com</p>
                <p className="mt-1 text-[11px] text-[#8e9393]">Server-side requests</p>
              </div>
            </div>
          </div>

          <div className="mb-12 grid gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-lg border border-[#36393a] bg-[#191c1e]/80 px-4 py-3.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#f7a600]/10 text-[#f0b341]"><Code2 size={16} /></span>
              <div><p className="text-[12px] font-semibold text-[#e9e7e1]">Server-first</p><p className="mt-0.5 text-[10px] text-[#929696]">Keep secret keys private</p></div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-[#36393a] bg-[#191c1e]/80 px-4 py-3.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#f7a600]/10 text-[#f0b341]"><Webhook size={16} /></span>
              <div><p className="text-[12px] font-semibold text-[#e9e7e1]">Payment events</p><p className="mt-0.5 text-[10px] text-[#929696]">Validate webhook signatures</p></div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-[#36393a] bg-[#191c1e]/80 px-4 py-3.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#f7a600]/10 text-[#f0b341]"><ShieldCheck size={16} /></span>
              <div><p className="text-[12px] font-semibold text-[#e9e7e1]">HTG + USDT</p><p className="mt-0.5 text-[10px] text-[#929696]">Choose a supported currency</p></div>
            </div>
          </div>

          <section id="quickstart" className="scroll-mt-28 pb-12">
            <SectionHeading number="01" title="Quick start" subtitle="A small server-side flow to get your first checkout moving." />
            <div className="mb-5 grid gap-3 sm:grid-cols-3">
              <Step number="1" title="Activate a merchant account" description="Set up your merchant account in Merchant Tools." />
              <Step number="2" title="Create a test key" description="Use a test key first. Live keys require merchant approval and enabled payments." />
              <Step number="3" title="Create a checkout" description="Create the payment from your server and send the customer to checkout_url." />
            </div>
            <CodePanel id="quickstart-curl" title="Create a checkout" language="cURL" code={checkoutCurl} />
            <p className="mt-3 flex items-start gap-2 text-[12px] leading-6 text-[#9da1a0]">
              <ArrowDownRight size={15} className="mt-1 shrink-0 text-[#e2ae40]" />
              The response contains <InlineCode>checkout_url</InlineCode>, <InlineCode>mode</InlineCode> and <InlineCode>livemode</InlineCode>. Test payments are simulations; they never debit balances or send live webhooks. Both modes use this same API host, and the key selects the mode.
            </p>
          </section>

          <section id="create-checkout" className="section-rule scroll-mt-28 py-12">
            <SectionHeading number="02" title="Create a checkout" subtitle="Create a payment session from your server with the fields below." />
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-[#725b2c] bg-[#f7a600]/10 px-2.5 py-1 font-code text-[11px] font-medium text-[#f2c35e]">POST</span>
              <code className="break-all rounded-md border border-[#3a3d3e] bg-[#1a1c1e] px-3 py-1.5 font-code text-[12px] text-[#d8d6cf]" data-testid="text-checkout-endpoint">/api/v1/checkout</code>
            </div>
            <p className="mb-5 text-[13px] leading-6 text-[#a7aaa9]">
              Send a test or live secret key in the <InlineCode>Authorization</InlineCode> header. Test keys start with <InlineCode>izk_test_sk_</InlineCode>; live keys start with <InlineCode>izk_live_sk_</InlineCode> and are available only after approval. Older <InlineCode>izi_sk_</InlineCode> keys remain live keys and follow the same approval checks. Amount is HTG or USDT as specified by <InlineCode>currency</InlineCode>. Both keys use <InlineCode>https://izichanj.com/api/v1</InlineCode>.
            </p>
            <div className="mb-6 overflow-hidden rounded-xl border border-[#36393a] bg-[#191c1e]">
              <div className="grid grid-cols-[minmax(85px,.7fr)_minmax(0,2fr)] border-b border-[#343738] bg-[#202325] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[.12em] text-[#858a8a]">
                <span>Field</span><span>Details</span>
              </div>
              <FieldRow name="amount" description="Positive number; minimum 0.50 USDT equivalent" />
              <FieldRow name="currency" description="HTG or USDT" />
              <FieldRow name="order_id" description="Your unique order reference" />
              <FieldRow name="description" description="Optional" />
              <FieldRow name="success_url" description="Optional" />
              <FieldRow name="cancel_url" description="Optional" last />
            </div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-[13px] font-semibold text-[#e6e4dd]">Node.js server example</p>
              <span className="rounded border border-[#3a3d3e] px-1.5 py-0.5 font-code text-[10px] uppercase text-[#858a8a]">Node.js</span>
            </div>
            <p className="mb-4 text-[12px] leading-6 text-[#999d9c]">Read the key from a server-side environment variable; do not expose it to browser JavaScript.</p>
            <CodePanel id="checkout-node" title="Create and retrieve checkout URL" language="Node.js" code={checkoutNode} compact />
          </section>

          <section id="verify-payment" className="section-rule scroll-mt-28 py-12">
            <SectionHeading number="03" title="Verify a payment" subtitle="Confirm the final status server-to-server before delivering goods or services." />
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-[#596a4d] bg-[#789b59]/10 px-2.5 py-1 font-code text-[11px] font-medium text-[#b7cf9f]">GET</span>
              <code className="break-all rounded-md border border-[#3a3d3e] bg-[#1a1c1e] px-3 py-1.5 font-code text-[12px] text-[#d8d6cf]" data-testid="text-payment-endpoint">/api/v1/payment/:payment_id</code>
            </div>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_250px]">
              <CodePanel id="payment-lookup" title="Look up a payment" language="cURL" code={paymentCurl} />
              <div className="rounded-xl border border-[#36393a] bg-[#191c1e] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[.13em] text-[#858a8a]">Possible statuses</p>
                <div className="mt-3 flex flex-wrap gap-2" data-testid="text-payment-statuses">
                  <StatusTag>pending</StatusTag><StatusTag>completed</StatusTag><StatusTag>expired</StatusTag><StatusTag>failed</StatusTag>
                </div>
                <p className="mt-4 border-t border-white/[0.08] pt-3 text-[11px] leading-5 text-[#969a99]">Check both <InlineCode>status</InlineCode> and <InlineCode>livemode</InlineCode>. Test completions must never fulfill a real order; do not rely on the customer redirect alone.</p>
              </div>
            </div>
          </section>

          <section id="webhooks" className="section-rule scroll-mt-28 py-12">
            <SectionHeading number="04" title="Webhooks" subtitle="Receive payment notifications directly on your server." />
            <p className="mb-5 text-[13px] leading-6 text-[#a7aaa9]">
              Live payments are sent to your webhook URL with <InlineCode>mode: live</InlineCode> and <InlineCode>livemode: true</InlineCode>. Test checkouts do not call the live webhook, so a test cannot accidentally trigger fulfillment:
            </p>
            <div className="mb-5 space-y-2">
              <div className="flex flex-col gap-1 rounded-lg border border-[#36393a] bg-[#191c1e] px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                <code className="w-full shrink-0 font-code text-[11px] text-[#e5bd66] sm:w-[245px]">X-Izichanj-Event</code>
                <span className="font-code text-[12px] text-[#d5d3cb]">payment.completed</span>
              </div>
              <div className="flex flex-col gap-1 rounded-lg border border-[#36393a] bg-[#191c1e] px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                <code className="w-full shrink-0 font-code text-[11px] text-[#e5bd66] sm:w-[245px]">X-Izichanj-Signature</code>
                <span className="text-[12px] leading-5 text-[#b2b4b1]">HMAC-SHA256 of the exact request body using your secret key</span>
              </div>
            </div>
            <div className="mb-4 rounded-lg border border-[#725b2c]/50 bg-[#f7a600]/[0.055] px-4 py-3 text-[12px] leading-6 text-[#d5c9a8]">
              Use the raw request body before JSON parsing when calculating the signature. Return a 2xx response after processing.
            </div>
            <CodePanel id="webhook-signature" title="Verify the webhook signature" language="Node.js" code={webhookNode} compact />
          </section>

          <section id="security" className="section-rule scroll-mt-28 py-12">
            <SectionHeading number="05" title="Security" subtitle="Keep credentials and payment confirmation on the server." />
            <div className="overflow-hidden rounded-xl border border-[#3b3933] bg-[#1c1d1d]">
              <div className="flex items-center gap-3 border-b border-[#3a3935] bg-[#242321] px-4 py-3.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f7a600]/10 text-[#e7b542]"><KeyRound size={16} /></span>
                <div>
                  <h3 className="font-display text-[14px] font-semibold">Credential handling</h3>
                  <p className="mt-0.5 text-[11px] text-[#929593]">A secret key is for server-side use only.</p>
                </div>
              </div>
              <ul className="divide-y divide-white/[0.07] px-4">
                <SecurityRule title="Keep secret keys private" detail={<>Keep <InlineCode>izk_test_sk_...</InlineCode> and <InlineCode>izk_live_sk_...</InlineCode> only on your backend. Never put a secret key in browser JavaScript.</>} />
                <SecurityRule title="Keep test and live separate" detail="Test checkouts simulate completion but do not debit wallets, credit merchant balances, or send live webhooks. Never fulfill a real order from a test payment." />
                <SecurityRule title="Use the right key" detail={<>Use the public key only where a public identifier is required; the checkout API requires the secret key.</>} />
                <SecurityRule title="Verify before fulfilment" detail="Verify payment status server-to-server before delivering goods or services." />
                <SecurityRule title="Rotate with care" detail="Rotating keys immediately invalidates the old keys." />
              </ul>
            </div>
          </section>

          <div className="section-rule flex flex-col gap-4 py-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-display text-[17px] font-semibold text-[#e8e6df]">Ready to build?</p>
              <p className="mt-1 text-[12px] text-[#939897]">Start with the server-side checkout example above.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a href="/merchant" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-[#f7a600] px-4 text-[12px] font-bold text-[#161716] transition-colors hover:bg-[#ffbb2c]" data-testid="link-merchant-tools">
                Open Merchant Tools <ArrowRight size={14} />
              </a>
              <a href="#quickstart" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-[#414548] px-4 text-[12px] font-semibold text-[#d0d0c9] transition-colors hover:bg-white/[0.04]" data-testid="link-back-quickstart">
                Back to quick start
              </a>
            </div>
          </div>
          <footer className="flex flex-col gap-2 border-t border-white/[0.08] pt-5 text-[10px] text-[#707575] sm:flex-row sm:items-center sm:justify-between">
            <span>Izichanj Pay · Developer documentation</span>
            <span className="font-code">HTG / USDT</span>
          </footer>
        </main>

        <aside className="hidden 2xl:block">
          <div className="sticky top-[100px] pt-[212px]">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[.16em] text-[#777c7c]">On this page</p>
            <nav className="space-y-2 border-l border-[#373a3a] pl-4" aria-label="On this page">
              {toc.map((item) => (
                <a key={item.id} href={`#${item.id}`} className="block text-[11px] leading-5 text-[#929696] transition-colors hover:text-[#f0bc4f]" data-testid={`link-right-${item.id}`}>{item.title}</a>
              ))}
            </nav>
            <div className="mt-7 rounded-lg border border-[#36393a] bg-[#191c1e] p-3.5">
              <p className="flex items-center gap-2 text-[11px] font-semibold text-[#d9d8d1]"><CheckCircle2 size={14} className="text-[#d4a543]" />No client-side secrets</p>
              <p className="mt-2 text-[10px] leading-5 text-[#929696]">All examples use placeholders. Retrieve your key from Merchant Tools.</p>
            </div>
          </div>
        </aside>
      </div>

      <a
        href="#quickstart"
        aria-label="Back to quick start"
        className="fixed bottom-5 right-5 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-[#f7a600]/40 bg-[#f7a600] text-[#171716] shadow-lg shadow-black/30 transition-transform hover:-translate-y-0.5 xl:hidden"
        data-testid="link-floating-top"
      >
        <ArrowDownRight size={18} className="rotate-[-135deg]" />
      </a>
    </div>
  );
}

function SectionHeading({ number, title, subtitle }: { number: string; title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center gap-2">
        <span className="font-code text-[10px] text-[#d7a741]">{number}</span>
        <span className="h-px w-5 bg-[#6a572d]" />
        <span className="text-[10px] font-semibold uppercase tracking-[.13em] text-[#777c7b]">Integration guide</span>
      </div>
      <h2 className="font-display text-[26px] font-semibold tracking-[-.035em] text-[#f0eee8] sm:text-[30px]" data-testid={`heading-section-${number}`}>{title}</h2>
      <p className="mt-2 max-w-[720px] text-[13px] leading-6 text-[#a0a3a2]">{subtitle}</p>
    </div>
  );
}

function Step({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex gap-3 rounded-lg border border-[#36393a] bg-[#191c1e] p-3.5">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#8a6c32] font-code text-[10px] text-[#f2bc4b]">{number}</span>
      <div><p className="text-[12px] font-semibold text-[#e5e3dc]">{title}</p><p className="mt-1 text-[11px] leading-5 text-[#979b9a]">{description}</p></div>
    </div>
  );
}

function FieldRow({ name, description, last = false }: { name: string; description: string; last?: boolean }) {
  return (
    <div className={`grid grid-cols-[minmax(85px,.7fr)_minmax(0,2fr)] gap-3 px-4 py-3 ${last ? '' : 'border-b border-white/[0.07]'}`} data-testid={`row-field-${name}`}>
      <code className="font-code text-[11px] text-[#e4b957]">{name}</code>
      <span className="text-[11px] leading-5 text-[#b0b2ae]">{description}</span>
    </div>
  );
}

function InlineCode({ children }: { children: ReactNode }) {
  return <code className="rounded border border-[#3b3d3d] bg-[#232527] px-1.5 py-0.5 font-code text-[11px] text-[#e8c46e]">{children}</code>;
}

function StatusTag({ children }: { children: string }) {
  return <span className="rounded-md border border-[#3c4040] bg-[#242729] px-2 py-1 font-code text-[10px] text-[#d0d0c9]" data-testid={`status-payment-${children}`}>{children}</span>;
}

function SecurityRule({ title, detail }: { title: string; detail: ReactNode }) {
  return (
    <li className="flex gap-3 py-3.5">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#6c5a32]/20 text-[#e4b64d]"><Check size={12} /></span>
      <div><p className="text-[12px] font-semibold text-[#e3e2dc]">{title}</p><p className="mt-1 text-[11px] leading-5 text-[#a0a3a1]">{detail}</p></div>
    </li>
  );
}
