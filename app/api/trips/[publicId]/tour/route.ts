import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { loadMembership } from "@/lib/trip-view";

// Records guided-demo steps the server can't see by itself (opening the Insights tab).
export async function POST(_request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const { trip, me } = await loadMembership((await params).publicId);
  if (!trip?.isDemo || !me) return new Response("Forbidden", { status: 403 });
  await db
    .update(schema.trips)
    .set({ demoTour: { ...trip.demoTour, insightsOpened: true } })
    .where(eq(schema.trips.id, trip.id));
  return Response.json({ ok: true });
}
