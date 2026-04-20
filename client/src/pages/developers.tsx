import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Code, Webhook, ShieldCheck, Percent, KeyRound, ExternalLink } from "lucide-react";

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="bg-zinc-950 text-zinc-100 text-xs font-mono p-4 rounded-lg overflow-x-auto">
      <code>{children}</code>
    </pre>
  );
}

export default function DevelopersPage() {
  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-3 text-primary"><Code className="w-6 h-6" /></div>
          <div>
            <h1 className="text-2xl font-bold">Izichanj for Developers</h1>
            <p className="text-sm text-muted-foreground">Accept HTG/USDT payments on your e-commerce site in minutes.</p>
          </div>
        </div>
        <Link href="/merchant">
          <Button data-testid="link-merchant"><KeyRound className="w-4 h-4 mr-2" />Get API Keys</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card><CardContent className="p-4 flex items-center gap-3"><Percent className="w-5 h-5 text-primary" /><div><p className="text-xs text-muted-foreground">Transaction fee</p><p className="font-bold">1.5% per payment</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><ShieldCheck className="w-5 h-5 text-primary" /><div><p className="text-xs text-muted-foreground">Settlement</p><p className="font-bold">Instant USDT credit</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><Webhook className="w-5 h-5 text-primary" /><div><p className="text-xs text-muted-foreground">Notifications</p><p className="font-bold">Signed webhooks</p></div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BookOpen className="w-5 h-5" />Quick Start</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-decimal pl-5 space-y-2 text-sm">
            <li>Complete KYC verification in your <Link href="/profile" className="text-primary underline">Profile</Link>.</li>
            <li>Go to <Link href="/merchant" className="text-primary underline">Merchant Tools</Link> and activate your merchant account.</li>
            <li>Copy your <Badge variant="secondary">izi_pk_</Badge> public key and <Badge variant="destructive">izi_sk_</Badge> secret key.</li>
            <li>Set your webhook URL so we can notify your server about completed payments.</li>
            <li>Call <code className="bg-muted px-1.5 py-0.5 rounded">POST /api/v1/checkout</code> from your backend to create a checkout session.</li>
            <li>Redirect the buyer to the returned <code className="bg-muted px-1.5 py-0.5 rounded">checkout_url</code>.</li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Create a checkout</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Always call this endpoint from your backend (never the browser — your secret key must stay private).</p>
          <CodeBlock>{`POST https://izichanj.replit.app/api/v1/checkout
Authorization: Bearer izi_sk_your_secret_key_here
Content-Type: application/json

{
  "amount": 5000,
  "currency": "HTG",
  "order_id": "ORDER-12345",
  "description": "Pro subscription",
  "success_url": "https://yourstore.com/thank-you",
  "cancel_url": "https://yourstore.com/cart"
}`}</CodeBlock>
          <p className="text-sm font-medium mt-2">Response</p>
          <CodeBlock>{`{
  "ok": true,
  "payment_id": "pay_abc123...",
  "checkout_url": "https://izichanj.replit.app/checkout/pay_abc123...",
  "amount": 5000,
  "currency": "HTG",
  "amount_usdt": "35.8423",
  "amount_htg": "5000.00",
  "fee_usdt": "0.5376",
  "net_usdt": "35.3047",
  "exchange_rate": 139.5,
  "order_id": "ORDER-12345",
  "expires_at": "2026-04-19T17:30:00.000Z"
}`}</CodeBlock>
          <p className="text-sm">Then simply redirect the buyer to <code className="bg-muted px-1.5 py-0.5 rounded">checkout_url</code>.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Node.js Example</CardTitle></CardHeader>
        <CardContent>
          <CodeBlock>{`const r = await fetch("https://izichanj.replit.app/api/v1/checkout", {
  method: "POST",
  headers: {
    "Authorization": "Bearer " + process.env.IZICHANJ_SECRET,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    amount: 5000,
    currency: "HTG",
    order_id: "ORDER-" + Date.now(),
    success_url: "https://yourstore.com/thanks",
    cancel_url: "https://yourstore.com/cart",
  }),
});
const { checkout_url } = await r.json();
res.redirect(checkout_url);`}</CodeBlock>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Webhook Handling</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">When the buyer pays, we POST a JSON payload to your webhook URL with an <code className="bg-muted px-1 rounded">X-Izichanj-Signature</code> header. Verify it using HMAC-SHA256 of the raw request body with your secret key.</p>
          <CodeBlock>{`// Express webhook handler
import crypto from "crypto";

app.post("/api/izichanj-webhook", express.raw({type:"application/json"}), (req, res) => {
  const sig = req.headers["x-izichanj-signature"];
  const expected = crypto.createHmac("sha256", process.env.IZICHANJ_SECRET)
                         .update(req.body).digest("hex");
  if (sig !== expected) return res.status(401).send("bad signature");

  const event = JSON.parse(req.body);
  if (event.event === "payment.completed") {
    // Mark the order as paid in your DB and deliver the product
    fulfillOrder(event.order_id, event.amount_usdt);
  }
  res.json({ received: true });
});`}</CodeBlock>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Frequently Asked Questions</CardTitle></CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="q1">
              <AccordionTrigger data-testid="faq-keys">How do I get my API keys?</AccordionTrigger>
              <AccordionContent>
                Complete KYC verification, then go to the <Link href="/merchant" className="text-primary underline">Merchant Tools</Link> page and activate your merchant account. Your public key (<code>izi_pk_</code>) and secret key (<code>izi_sk_</code>) are generated automatically. You can rotate them at any time.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q2">
              <AccordionTrigger data-testid="faq-fee">How does the 1.5% fee work?</AccordionTrigger>
              <AccordionContent>
                For every successful payment, we deduct 1.5% of the USDT amount before crediting your wallet. Example: a 5,000 HTG order ≈ 35.84 USDT → fee = 0.54 USDT → you receive 35.30 USDT instantly. The buyer always pays the full amount you charged.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q3">
              <AccordionTrigger data-testid="faq-button">How do I integrate the payment button?</AccordionTrigger>
              <AccordionContent className="space-y-2">
                Two simple steps:
                <ol className="list-decimal pl-5 mt-2 space-y-1">
                  <li>From your backend, call <code>POST /api/v1/checkout</code> when the customer clicks "Pay".</li>
                  <li>Redirect them to the returned <code>checkout_url</code>. After payment, they bounce back to your <code>success_url</code>.</li>
                </ol>
                Never expose your secret key in HTML or browser JavaScript.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q4">
              <AccordionTrigger data-testid="faq-webhook">How do I set up the webhook?</AccordionTrigger>
              <AccordionContent>
                Set your <strong>Webhook URL</strong> in the <Link href="/merchant" className="text-primary underline">Merchant Tools</Link> page. We POST a JSON event when a payment completes, signed with HMAC-SHA256 in the <code>X-Izichanj-Signature</code> header. Use the webhook to trigger automatic order delivery on your side.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q5">
              <AccordionTrigger data-testid="faq-currency">Can I charge in HTG or USDT?</AccordionTrigger>
              <AccordionContent>
                Yes. Set <code>currency: "HTG"</code> or <code>"USDT"</code>. If HTG, we automatically convert to USDT using the platform's current exchange rate at checkout time. The buyer sees both amounts on the checkout page.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q6">
              <AccordionTrigger data-testid="faq-expires">How long is a checkout valid?</AccordionTrigger>
              <AccordionContent>
                Each checkout session expires after 30 minutes. If the buyer doesn't pay in time, the status becomes <code>expired</code> and you'll need to create a new session.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q7">
              <AccordionTrigger data-testid="faq-security">Is my secret key safe?</AccordionTrigger>
              <AccordionContent>
                Your secret key is only sent to you once and shown in your dashboard. Always keep it on your server — never commit it to git, never put it in HTML or browser JavaScript. If you suspect it's leaked, rotate it immediately from the dashboard.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q8">
              <AccordionTrigger data-testid="faq-test">How do I test the integration?</AccordionTrigger>
              <AccordionContent>
                Create a test order via <code>POST /api/v1/checkout</code>, open the returned URL in a browser, log in with a different Izichanj account that has some balance, and complete the payment. Check your merchant dashboard for the transaction and your webhook server for the event.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>API Reference Summary</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-3 p-2 rounded hover:bg-muted/30">
              <Badge>POST</Badge>
              <div className="flex-1">
                <code className="font-mono">/api/v1/checkout</code>
                <p className="text-xs text-muted-foreground">Create a new payment session. Auth: Bearer secret key.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-2 rounded hover:bg-muted/30">
              <Badge>GET</Badge>
              <div className="flex-1">
                <code className="font-mono">/api/v1/payment/:id</code>
                <p className="text-xs text-muted-foreground">Look up payment status. Auth: Bearer secret key.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
