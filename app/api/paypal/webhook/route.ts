import { verifyWebhook } from "@/lib/paypal/webhooks";

type PayPalEvent = {
  id: string;
  event_type: string;
  resource: { id?: string; status?: string; supplementary_data?: { related_ids?: { order_id?: string } } };
};

export async function POST(request: Request) {
  const event = (await request.json()) as PayPalEvent;
  const verified = await verifyWebhook(request.headers, event).catch((e) => {
    console.error("[webhook] verify failed", e);
    return false;
  });
  if (!verified) return new Response("invalid signature", { status: 400 });

  // TODO(phase 2): insert into webhook_events (unique paypal_event_id) and mark settlement captured.
  console.log("[webhook]", event.event_type, {
    eventId: event.id,
    captureId: event.resource.id,
    status: event.resource.status,
    orderId: event.resource.supplementary_data?.related_ids?.order_id,
  });
  return new Response("ok");
}
