import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { verifyWebhook } from "@/lib/paypal/webhooks";
import { markCaptured, markFailed } from "@/lib/settlements";

type PayPalEvent = {
  id: string;
  event_type: string;
  resource: { id?: string; status?: string; supplementary_data?: { related_ids?: { order_id?: string } } };
};

// PayPal retries deliveries for days, so events are recorded by id and processed once.
export async function POST(request: Request) {
  const event = (await request.json()) as PayPalEvent;
  const verified = await verifyWebhook(request.headers, event).catch((e) => {
    console.error("[webhook] verify failed", e);
    return false;
  });
  if (!verified) return new Response("invalid signature", { status: 400 });

  const [fresh] = await db
    .insert(schema.webhookEvents)
    .values({ paypalEventId: event.id, eventType: event.event_type, payload: event })
    .onConflictDoNothing()
    .returning();
  if (!fresh) return new Response("duplicate");

  const orderId = event.resource.supplementary_data?.related_ids?.order_id;
  console.log("[webhook]", event.event_type, { eventId: event.id, orderId, status: event.resource.status });
  if (orderId && event.event_type === "PAYMENT.CAPTURE.COMPLETED") await markCaptured(orderId, event.resource.id!);
  if (orderId && event.event_type === "PAYMENT.CAPTURE.DENIED") await markFailed(orderId);

  await db
    .update(schema.webhookEvents)
    .set({ processedAt: new Date() })
    .where(eq(schema.webhookEvents.paypalEventId, event.id));
  return new Response("ok");
}
