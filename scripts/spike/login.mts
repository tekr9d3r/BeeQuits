export {};

// Step 0 spike: Log In with PayPal → verified email.
//   node --env-file=.env scripts/spike/login.mts            → prints authorize URL
//   node --env-file=.env scripts/spike/login.mts <code>     → exchanges code, prints userinfo
// After logging in, PayPal redirects to PAYPAL_REDIRECT_URI?code=... (a 404 is fine; copy the code).

const base = process.env.PAYPAL_API_BASE ?? "https://api-m.sandbox.paypal.com";
const web = base.includes("sandbox") ? "https://www.sandbox.paypal.com" : "https://www.paypal.com";
const code = process.argv[2];

if (!code) {
  const params = new URLSearchParams({
    flowEntry: "static",
    client_id: process.env.PAYPAL_CLIENT_ID!,
    response_type: "code",
    scope: "openid email profile",
    redirect_uri: process.env.PAYPAL_REDIRECT_URI!,
  });
  console.log(`${web}/signin/authorize?${params}`);
} else {
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const tokRes = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code }),
  });
  const tok = await tokRes.json();
  if (!tokRes.ok) throw new Error(JSON.stringify(tok));
  const info = await fetch(`${base}/v1/identity/oauth2/userinfo?schema=paypalv1.1`, {
    headers: { Authorization: `Bearer ${tok.access_token}` },
  });
  console.log(info.status, JSON.stringify(await info.json(), null, 2));
}
