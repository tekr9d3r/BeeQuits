const apiBase = process.env.PAYPAL_API_BASE ?? "https://api-m.sandbox.paypal.com";
const webBase = apiBase.includes("sandbox") ? "https://www.sandbox.paypal.com" : "https://www.paypal.com";

export function authorizeUrl(state: string): string {
  const params = new URLSearchParams({
    flowEntry: "static",
    client_id: process.env.PAYPAL_CLIENT_ID!,
    response_type: "code",
    scope: "openid email profile",
    redirect_uri: process.env.PAYPAL_REDIRECT_URI!,
    state,
  });
  return `${webBase}/signin/authorize?${params}`;
}

export type PayPalIdentity = { paypalUserId: string; name: string; email: string };

// Exchanges the login code for the user's PayPal identity and verified email.
export async function exchangeCode(code: string): Promise<PayPalIdentity> {
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const tokenRes = await fetch(`${apiBase}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code }),
  });
  if (!tokenRes.ok) throw new Error(`PayPal code exchange ${tokenRes.status}: ${await tokenRes.text()}`);
  const { access_token } = await tokenRes.json();

  const infoRes = await fetch(`${apiBase}/v1/identity/oauth2/userinfo?schema=paypalv1.1`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!infoRes.ok) throw new Error(`PayPal userinfo ${infoRes.status}: ${await infoRes.text()}`);
  const info = await infoRes.json();
  const email = info.emails?.find((e: { primary?: boolean }) => e.primary)?.value ?? info.emails?.[0]?.value;
  if (!email) throw new Error("PayPal did not return an email address");
  return { paypalUserId: info.user_id, name: info.name ?? email, email };
}
