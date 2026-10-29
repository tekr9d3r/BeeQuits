import { runAgent } from "@/lib/agent/run";
import { db, schema } from "@/lib/db";
import { loadMembership } from "@/lib/trip-view";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// Posts a chat message (text and/or receipt photo), then lets the agent respond.
// The response returns once the agent is done; other members see it on their next poll.
export async function POST(request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const { trip, me } = await loadMembership((await params).publicId);
  if (!trip || !me) return new Response("Not a member of this trip", { status: 403 });

  const form = await request.formData();
  const text = String(form.get("text") ?? "").trim().slice(0, 2000);
  const photo = form.get("photo");
  const hasPhoto = photo instanceof File && photo.size > 0;
  if (!text && !hasPhoto) return new Response("Empty message", { status: 400 });

  let receiptId: string | null = null;
  if (hasPhoto) {
    if (!PHOTO_TYPES.includes(photo.type) || photo.size > MAX_PHOTO_BYTES) {
      return new Response("Photo must be a JPEG, PNG, WebP or GIF under 5 MB", { status: 400 });
    }
    const [receipt] = await db
      .insert(schema.receipts)
      .values({ tripId: trip.id, mediaType: photo.type, dataBase64: Buffer.from(await photo.arrayBuffer()).toString("base64") })
      .returning({ id: schema.receipts.id });
    receiptId = receipt.id;
  }

  await db.insert(schema.messages).values({
    tripId: trip.id,
    memberId: me.id,
    content: text,
    attachments: receiptId ? [{ type: "receipt", receiptId }] : null,
  });

  try {
    await runAgent(trip);
  } catch (error) {
    console.error("[agent]", error);
    await db.insert(schema.messages).values({
      tripId: trip.id,
      content: "Sorry, my wings got tangled 🐝 I couldn't process that. Could you try again?",
    });
  }
  return Response.json({ ok: true });
}
