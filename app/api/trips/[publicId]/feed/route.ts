import { after } from "next/server";
import { maybeAutoNudge } from "@/lib/nudges";
import { loadMembership, messagesAfter, tripSnapshot } from "@/lib/trip-view";

// Polled by the trip screen: new chat messages since `after`, plus the current ledger snapshot.
export async function GET(request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const { trip, me } = await loadMembership((await params).publicId);
  if (!trip || !me) return new Response("Not a member of this trip", { status: 403 });
  const afterSeq = Number(new URL(request.url).searchParams.get("after") ?? 0);
  const [messages, snapshot] = await Promise.all([messagesAfter(trip.id, afterSeq), tripSnapshot(trip.id)]);
  // Someone is looking at the trip, a good moment to remind anyone who still owes.
  after(() => maybeAutoNudge(trip).catch((e) => console.error("[nudge]", e)));
  return Response.json({ messages, snapshot, locked: trip.lockedAt !== null });
}
