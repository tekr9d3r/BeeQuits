import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { TripApp } from "@/components/trip/TripApp";
import { db, schema } from "@/lib/db";
import { inviteLink } from "@/lib/invite";
import { loadMembership, messagesAfter, tripSnapshot } from "@/lib/trip-view";

// Reads the session cookie, so it renders per request.
export const instant = false;

export default async function TripPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const { trip, user, me } = await loadMembership(publicId);
  if (!trip) notFound();
  if (!me) {
    if (trip.isDemo) {
      // This browser started a newer tour: go there rather than back to the start page.
      const current = user && (await db.query.trips.findFirst({ where: eq(schema.trips.createdBy, user.id) }));
      redirect(current ? `/t/${current.publicId}` : "/demo");
    }
    if (!user) redirect(`/api/auth/paypal/login?next=/t/${publicId}`);
    return (
      <main className="mx-auto max-w-md flex-1 px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">You&apos;re not in this trip yet</h1>
        <p className="mt-2 text-muted">Ask a friend in the trip for the invite link.</p>
      </main>
    );
  }

  const [messages, snapshot, invite] = await Promise.all([
    messagesAfter(trip.id, 0),
    tripSnapshot(trip.id),
    inviteLink(trip.publicId, trip.inviteCode),
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
        demoBuyer:
          trip.isDemo && process.env.DEMO_BUYER_EMAIL
            ? { email: process.env.DEMO_BUYER_EMAIL, password: process.env.DEMO_BUYER_PASSWORD ?? "" }
            : null,
      }}
      me={{ memberId: me.id, role: me.role }}
      invite={invite}
      paypalClientId={process.env.PAYPAL_CLIENT_ID!}
      initialMessages={JSON.parse(JSON.stringify(messages))}
      initialSnapshot={snapshot}
    />
  );
}
