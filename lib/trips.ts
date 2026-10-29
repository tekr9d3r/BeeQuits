import { and, asc, eq, isNull } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { db, schema } from "./db";

const { trips, tripMembers, users } = schema;
const newId = customAlphabet("23456789abcdefghjkmnpqrstuvwxyz", 10);

export type Trip = typeof trips.$inferSelect;
export type Member = typeof tripMembers.$inferSelect;
export type MemberWithUser = Member & { user: typeof users.$inferSelect | null };

export async function createTrip(input: {
  name: string;
  startDate?: string | null;
  endDate?: string | null;
  organizer: { id: string; name: string };
}) {
  return db.transaction(async (tx) => {
    const [trip] = await tx
      .insert(trips)
      .values({
        publicId: newId(),
        inviteCode: newId(),
        name: input.name,
        startDate: input.startDate || null,
        endDate: input.endDate || null,
        createdBy: input.organizer.id,
      })
      .returning();
    await tx.insert(tripMembers).values({
      tripId: trip.id,
      userId: input.organizer.id,
      displayName: firstName(input.organizer.name),
      role: "organizer",
    });
    await tx.insert(schema.messages).values({
      tripId: trip.id,
      content: `🐝 Hi! I'm the money bee for **${trip.name}**. Tell me what you paid, like "Paid 96€ at Spar, everyone except Sam", or snap a receipt. I'll keep the ledger and settle everyone up with PayPal at the end.`,
    });
    return trip;
  });
}

export async function getTripByPublicId(publicId: string) {
  return (await db.query.trips.findFirst({ where: eq(trips.publicId, publicId) })) ?? null;
}

export async function listMembers(tripId: string): Promise<MemberWithUser[]> {
  return db.query.tripMembers.findMany({
    where: eq(tripMembers.tripId, tripId),
    with: { user: true },
    orderBy: asc(tripMembers.createdAt),
  });
}

export async function membershipFor(tripId: string, userId: string) {
  return (
    (await db.query.tripMembers.findFirst({
      where: and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, userId)),
    })) ?? null
  );
}

export async function addPlaceholder(tripId: string, displayName: string) {
  const [member] = await db.insert(tripMembers).values({ tripId, displayName: displayName.trim() }).returning();
  return member;
}

// Joining either claims an unclaimed placeholder (inheriting its expenses) or adds a new member.
export async function joinTrip(trip: Trip, user: { id: string; name: string }, claimMemberId?: string | null) {
  if (trip.lockedAt) throw new Error("This trip is locked. Ask the organizer to unlock it.");
  const existing = await membershipFor(trip.id, user.id);
  if (existing) return existing;

  if (claimMemberId) {
    const [claimed] = await db
      .update(tripMembers)
      .set({ userId: user.id })
      .where(and(eq(tripMembers.id, claimMemberId), eq(tripMembers.tripId, trip.id), isNull(tripMembers.userId)))
      .returning();
    if (claimed) return claimed;
  }
  const [member] = await db
    .insert(tripMembers)
    .values({ tripId: trip.id, userId: user.id, displayName: firstName(user.name) })
    .returning();
  return member;
}

export async function regenerateInvite(tripId: string) {
  await db.update(trips).set({ inviteCode: newId() }).where(eq(trips.id, tripId));
}

export async function setLocked(tripId: string, locked: boolean) {
  await db.update(trips).set({ lockedAt: locked ? new Date() : null }).where(eq(trips.id, tripId));
}

export async function renameMember(memberId: string, displayName: string) {
  await db.update(tripMembers).set({ displayName: displayName.trim() }).where(eq(tripMembers.id, memberId));
}

function firstName(name: string) {
  return name.split(/\s+/)[0] || name;
}
