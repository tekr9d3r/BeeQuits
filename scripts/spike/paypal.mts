export {};

// Step 0 spike: prove a debtor can pay a creditor directly via Orders v2 custom payee.
// Usage (Node 24 runs .ts directly):
//   node --env-file=.env scripts/spike/paypal.mts create [amount]   → prints approve link
//   node --env-file=.env scripts/spike/paypal.mts capture <orderId>
//   node --env-file=.env scripts/spike/paypal.mts get <orderId>

const base = process.env.PAYPAL_API_BASE ?? "https://api-m.sandbox.paypal.com";

async function token(): Promise<string> {
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`token ${res.status}: ${await res.text()}`);
  return (await res.json()).access_token;
}

async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  console.log(res.status, JSON.stringify(json, null, 2));
  return json;
}

const [cmd, arg] = process.argv.slice(2);

if (cmd === "create") {
  const payee = process.env.SPIKE_PAYEE_EMAIL;
  if (!payee) throw new Error("Set SPIKE_PAYEE_EMAIL");
  const order = await call("POST", "/v2/checkout/orders", {
    intent: "CAPTURE",
    purchase_units: [
      {
        amount: { currency_code: "EUR", value: arg ?? "42.50" },
        payee: { email_address: payee },
        description: "BeeQuits settle-up (spike)",
      },
    ],
    payment_source: {
      paypal: {
        experience_context: {
          return_url: "https://example.com/return",
          cancel_url: "https://example.com/cancel",
          user_action: "PAY_NOW",
        },
      },
    },
  });
  const approve = order.links?.find((l: { rel: string }) => l.rel === "payer-action" || l.rel === "approve");
  console.log("\nApprove as the DEBTOR sandbox account:", approve?.href);
  console.log(`Then: node --env-file=.env scripts/spike/paypal.mts capture ${order.id}`);
} else if (cmd === "capture" && arg) {
  await call("POST", `/v2/checkout/orders/${arg}/capture`, {});
} else if (cmd === "get" && arg) {
  await call("GET", `/v2/checkout/orders/${arg}`);
} else {
  console.log("usage: create [amount] | capture <orderId> | get <orderId>");
}
