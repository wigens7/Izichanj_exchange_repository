import { Link } from "wouter";
import { ArrowLeft, BookOpen, CheckCircle2, Code2, ExternalLink, ShieldCheck, Webhook } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const baseUrl = "https://izichanj.com";

export default function DevelopersPage() {
  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/merchant">
          <Button variant="ghost" size="icon" aria-label="Back to merchant tools">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="rounded-lg bg-primary/10 p-3 text-primary"><BookOpen className="w-6 h-6" /></div>
        <div>
          <h1 className="text-2xl font-bold">Izichanj Pay API</h1>
          <p className="text-sm text-muted-foreground">Accept USDT and HTG payments on your website.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick start</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p>Activate a merchant account, copy your secret key from Merchant Tools, then create a checkout payment from your server.</p>
          <div className="rounded-lg bg-muted p-4 font-mono text-xs overflow-x-auto whitespace-pre">{`curl -X POST ${baseUrl}/api/v1/checkout \\
  -H "Authorization: Bearer izi_sk_YOUR_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"amount": 100, "currency": "USDT", "order_id": "order-123",
       "description": "Order #123",
       "success_url": "https://yourstore.com/success",
       "cancel_url": "https://yourstore.com/cancel"}'`}</div>
          <p>The response contains <code className="font-mono">checkout_url</code>. Redirect your customer to that URL to complete payment.</p>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Code2 className="w-5 h-5 text-primary" />Create checkout</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="font-mono text-xs">POST /api/v1/checkout</p>
            <p>Use your secret key in the Authorization header. Amount is in HTG when currency is <code className="font-mono">HTG</code>, or USDT when currency is <code className="font-mono">USDT</code>.</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li><code className="font-mono">amount</code> — positive number; minimum 0.50 USDT equivalent</li>
              <li><code className="font-mono">currency</code> — HTG or USDT</li>
              <li><code className="font-mono">order_id</code> — your unique order reference</li>
              <li><code className="font-mono">description</code>, <code className="font-mono">success_url</code>, <code className="font-mono">cancel_url</code> — optional</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary" />Check payment</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="font-mono text-xs">GET /api/v1/payment/:payment_id</p>
            <p>Use this endpoint from your server to confirm the payment status. Never trust only the customer redirect.</p>
            <div className="rounded-lg bg-muted p-3 font-mono text-xs whitespace-pre-wrap">{`curl ${baseUrl}/api/v1/payment/pay_xxx \\
  -H "Authorization: Bearer izi_sk_YOUR_SECRET_KEY"`}</div>
            <p className="text-muted-foreground">Possible statuses: <code className="font-mono">pending</code>, <code className="font-mono">completed</code>, <code className="font-mono">expired</code>, <code className="font-mono">failed</code>.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Webhook className="w-5 h-5 text-primary" />Webhooks</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>Set your webhook URL in Merchant Tools. After a successful payment, Izichanj sends a <code className="font-mono">POST</code> request with JSON and these headers:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><code className="font-mono">X-Izichanj-Event: payment.completed</code></li>
            <li><code className="font-mono">X-Izichanj-Signature</code> — HMAC-SHA256 of the exact request body using your secret key</li>
          </ul>
          <div className="rounded-lg bg-muted p-3 font-mono text-xs whitespace-pre-wrap">{`const expected = crypto
  .createHmac("sha256", process.env.IZICHANJ_SECRET_KEY)
  .update(rawRequestBody)
  .digest("hex");

if (signature !== expected) return res.sendStatus(401);`}</div>
          <p className="text-muted-foreground">Use the raw request body before JSON parsing when calculating the signature. Return a 2xx response after processing.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-500" />Important security rules</CardTitle></CardHeader>
        <CardContent className="text-sm">
          <ul className="list-disc pl-5 space-y-2">
            <li>Keep <code className="font-mono">izi_sk_...</code> only on your backend. Do not put it in browser JavaScript.</li>
            <li>Use the public key only where a public identifier is required; the checkout API requires the secret key.</li>
            <li>Verify the payment status server-to-server before delivering goods or services.</li>
            <li>Rotating keys immediately invalidates the old keys.</li>
            <li>Izichanj Pay currently charges <strong>0% transaction fee</strong>; the full payment is credited to the merchant balance.</li>
          </ul>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Link href="/merchant"><Button>Open Merchant Tools</Button></Link>
        <a href={`${baseUrl}/api/v1/payment/example`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
          API base URL <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}
