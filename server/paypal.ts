import {
  Client,
  Environment,
  LogLevel,
  OrdersController,
} from "@paypal/paypal-server-sdk";

const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET } = process.env;

export const PAYPAL_MIN_DEPOSIT_USD = 20.0;
export const PAYPAL_FLAT_FEE_USD = 10.0;
export const PAYPAL_MAX_DEPOSIT_USD = 10000.0;

// Default to sandbox. To go live, explicitly set PAYPAL_ENVIRONMENT=live AND
// swap the PAYPAL_CLIENT_ID/SECRET to your live merchant credentials.
// Note: NODE_ENV is intentionally NOT used here — Replit deployments run with
// NODE_ENV=production by default, but that does not mean PayPal should switch
// to live. PayPal env must be flipped deliberately and in lockstep with the
// credentials.
export const PAYPAL_ENVIRONMENT: "sandbox" | "live" =
  process.env.PAYPAL_ENVIRONMENT === "live" ? "live" : "sandbox";

const paypalClient = PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET ? new Client({
  clientCredentialsAuthCredentials: {
    oAuthClientId: PAYPAL_CLIENT_ID,
    oAuthClientSecret: PAYPAL_CLIENT_SECRET,
  },
  timeout: 0,
  environment: PAYPAL_ENVIRONMENT === "live" ? Environment.Production : Environment.Sandbox,
  logging: {
    logLevel: LogLevel.Info,
    logRequest: { logBody: false },
    logResponse: { logHeaders: false },
  },
}) : null;

const ordersController = paypalClient ? new OrdersController(paypalClient) : null;

export interface CreateOrderResult {
  id: string;
  status: string;
  totalCharged: string;
  depositAmount: string;
  fee: string;
}

export async function createPayPalDepositOrder(params: {
  depositAmount: number;
  userLabel: string;
}): Promise<CreateOrderResult> {
  if (!ordersController) throw new Error("PayPal is not configured");
  const { depositAmount, userLabel } = params;
  const fee = PAYPAL_FLAT_FEE_USD;
  const totalToCharge = depositAmount + fee;

  const collect = {
    body: {
      intent: "CAPTURE" as any,
      purchaseUnits: [
        {
          amount: {
            currencyCode: "USD",
            value: totalToCharge.toFixed(2),
            breakdown: {
              itemTotal: { currencyCode: "USD", value: depositAmount.toFixed(2) },
              handling: { currencyCode: "USD", value: fee.toFixed(2) },
            },
          },
          description: `Izichanj wallet deposit: $${depositAmount.toFixed(2)} (+ $${fee.toFixed(2)} fee) — ${userLabel}`,
        },
      ],
    },
    prefer: "return=representation",
  };

  const { body } = await ordersController.createOrder(collect);
  const result = JSON.parse(String(body));
  return {
    id: result.id,
    status: result.status,
    totalCharged: totalToCharge.toFixed(2),
    depositAmount: depositAmount.toFixed(2),
    fee: fee.toFixed(2),
  };
}

export interface CapturedOrder {
  id: string;
  status: string;
  amountPaidUsd: number;
  captureId: string;
  payerEmail?: string;
}

export async function capturePayPalOrder(orderId: string): Promise<CapturedOrder> {
  if (!ordersController) throw new Error("PayPal is not configured");
  const { body } = await ordersController.captureOrder({
    id: orderId,
    prefer: "return=representation",
  });
  const result = JSON.parse(String(body));

  const capture = result?.purchase_units?.[0]?.payments?.captures?.[0];
  const amountStr = capture?.amount?.value ?? "0";
  return {
    id: result.id,
    status: result.status,
    amountPaidUsd: parseFloat(amountStr),
    captureId: capture?.id,
    payerEmail: result?.payer?.email_address,
  };
}
