import { loadMembership, messagesAfter, tripSnapshot } from "@/lib/trip-view";

// Polled by the trip screen: new chat messages since `after`, plus the current ledger snapshot.
export async function GET(request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const { trip, me } = await loadMembership((await params).publicId);
  if (!trip || !me) return new Response("Not a member of this trip", { status: 403 });
  const after = Number(new URL(request.url).searchParams.get("after") ?? 0);
  const [messages, snapshot] = await Promise.all([messagesAfter(trip.id, after), tripSnapshot(trip.id)]);
  return Response.json({ messages, snapshot, locked: trip.lockedAt !== null });
}
