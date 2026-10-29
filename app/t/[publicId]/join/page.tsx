import { notFound, redirect } from "next/navigation";
import { joinTripAction } from "@/app/actions";
import { Logo } from "@/components/Logo";
import { loadMembership } from "@/lib/trip-view";
import { listMembers } from "@/lib/trips";

// Reads the session cookie, so it renders per request.
export const instant = false;

export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ publicId: string }>;
  searchParams: Promise<{ code?: string }>;
}) {
  const { publicId } = await params;
  const { code = "" } = await searchParams;
  const { trip, user, me } = await loadMembership(publicId);
  if (!trip) notFound();
  if (me) redirect(`/t/${publicId}`);

  const valid = trip.inviteCode === code;
  const members = valid ? await listMembers(trip.id) : [];
  const organizer = members.find((m) => m.role === "organizer");
  const placeholders = members.filter((m) => m.userId === null && m.status === "active");
  const loginHref = `/api/auth/paypal/login?next=${encodeURIComponent(`/t/${publicId}/join?code=${code}`)}`;

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
      <Logo />
      {!valid ? (
        <div className="mt-16 text-center">
          <h1 className="text-2xl font-bold">This invite link has expired</h1>
          <p className="mt-2 text-muted">Ask the organizer for a fresh link.</p>
        </div>
      ) : trip.lockedAt ? (
        <div className="mt-16 text-center">
          <h1 className="text-2xl font-bold">{trip.name} is locked</h1>
          <p className="mt-2 text-muted">The group is settling up, so no new members can join right now.</p>
        </div>
      ) : (
        <div className="mt-12">
          <p className="text-muted">{organizer?.displayName ?? "A friend"} invited you to</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{trip.name}</h1>
          <p className="mt-4 text-sm text-muted">
            {members.map((m) => m.displayName).join(", ")}
          </p>

          {!user ? (
            <>
              <p className="mt-8 text-muted">
                Log in with PayPal to join. Your PayPal email is where friends will pay you back. BeeQuits never holds money.
              </p>
              <a href={loginHref} className="mt-4 block rounded-full bg-ink px-6 py-3 text-center font-semibold text-paper">
                Log in with PayPal
              </a>
            </>
          ) : (
            <div className="mt-8 flex flex-col gap-3">
              {placeholders.length > 0 && <p className="font-medium">Are you one of these?</p>}
              {placeholders.map((p) => (
                <form key={p.id} action={joinTripAction.bind(null, publicId, code, p.id)}>
                  <button className="w-full rounded-full border-2 border-ink px-6 py-3 font-semibold hover:bg-honey-soft">
                    I&apos;m {p.displayName}
                  </button>
                </form>
              ))}
              <form action={joinTripAction.bind(null, publicId, code, null)}>
                <button className="w-full rounded-full bg-ink px-6 py-3 font-semibold text-paper">
                  {placeholders.length ? `No, join as ${user.name.split(" ")[0]}` : `Join as ${user.name.split(" ")[0]}`}
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
