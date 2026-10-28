import { paypal } from "./client";

// Asks PayPal to verify the transmission signature. Needs the raw event as sent.
export async function verifyWebhook(headers: Headers, event: unknown): Promise<boolean> {
  const res = await paypal<{ verification_status: string }>("POST", "/v1/notifications/verify-webhook-signature", {
    auth_algo: headers.get("paypal-auth-algo"),
    cert_url: headers.get("paypal-cert-url"),
    transmission_id: headers.get("paypal-transmission-id"),
    transmission_sig: headers.get("paypal-transmission-sig"),
    transmission_time: headers.get("paypal-transmission-time"),
    webhook_id: process.env.PAYPAL_WEBHOOK_ID,
    webhook_event: event,
  });
  return res.verification_status === "SUCCESS";
}
