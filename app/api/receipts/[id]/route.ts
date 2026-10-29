import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getTripById } from "@/lib/trips";
import { loadMembership } from "@/lib/trip-view";

// Serves a receipt photo to members of its trip.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const receipt = await db.query.receipts.findFirst({ where: eq(schema.receipts.id, (await params).id) });
  if (!receipt) return new Response("Not found", { status: 404 });
  const trip = await getTripById(receipt.tripId);
  const { me } = await loadMembership(trip!.publicId);
  if (!me) return new Response("Forbidden", { status: 403 });
  return new Response(Buffer.from(receipt.dataBase64, "base64"), {
    headers: { "Content-Type": receipt.mediaType, "Cache-Control": "private, max-age=86400" },
  });
}
