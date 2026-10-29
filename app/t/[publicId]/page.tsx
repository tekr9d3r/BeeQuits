import { notFound, redirect } from "next/navigation";
import { TripApp } from "@/components/trip/TripApp";
import { inviteLink } from "@/lib/invite";
import { listMembers } from "@/lib/trips";
import { loadMembership, messagesAfter, tripSnapshot } from "@/lib/trip-view";

// Reads the session cookie, so it renders per request.
export const instant = false;

export default async function TripPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const { trip, user, me } = await loadMembership(publicId);
  if (!trip) notFound();
  if (!me) {
    if (trip.isDemo) redirect("/demo");
    if (!user) redirect(`/api/auth/paypal/login?next=/t/${publicId}`);
    return (
      <main className="mx-auto max-w-md flex-1 px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">You&apos;re not in this trip yet</h1>
        <p className="mt-2 text-muted">Ask a friend in the trip for the invite link.</p>
      </main>
    );
  }

  const [messages, snapshot, invite, members] = await Promise.all([
    messagesAfter(trip.id, 0),
    tripSnapshot(trip.id),
    inviteLink(trip.publicId, trip.inviteCode),
    trip.isDemo ? listMembers(trip.id) : Promise.resolve([]),
  ]);

  return (
    <TripApp
      trip={{
        publicId: trip.publicId,
        name: trip.name,
        currency: trip.currency,
        startDate: trip.startDate,
        endDate: trip.endDate,
        isDemo: trip.isDemo,
        locked: trip.lockedAt !== null,
      }}
      me={{ memberId: me.id, role: me.role }}
      invite={invite}
      demoCrew={members.filter((m) => m.userId).map((m) => ({ id: m.id, name: m.displayName }))}
      initialMessages={JSON.parse(JSON.stringify(messages))}
      initialSnapshot={snapshot}
    />
  );
}
