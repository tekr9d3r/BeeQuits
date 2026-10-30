import { and, asc, eq, gt } from "drizzle-orm";
import { currentUser, isDemoAccount } from "./auth";
import { avatarFor } from "./avatars";
import { db, schema } from "./db";
import { getBalances, getBudgetStatus, listExpenses } from "./ledger/service";
import { listSettlements, listSharePayments } from "./settlements";
import { getTripByPublicId, listMembers } from "./trips";

// Resolves the trip and the signed-in user's membership; null if either is missing.
export async function loadMembership(publicId: string) {
  const [trip, sessionUser] = await Promise.all([getTripByPublicId(publicId), currentUser()]);
  const user = sessionUser && (trip?.isDemo || !isDemoAccount(sessionUser)) ? sessionUser : null;
  if (!trip) return { trip: null, user, me: null };
  if (!user) return { trip, user: null, me: null };
  const me = await db.query.tripMembers.findFirst({
    where: and(eq(schema.tripMembers.tripId, trip.id), eq(schema.tripMembers.userId, user.id)),
  });
  return { trip, user, me: me ?? null };
}

export type ChatMessage = Awaited<ReturnType<typeof messagesAfter>>[number];

export async function messagesAfter(tripId: string, afterSeq: number) {
  return db.query.messages.findMany({
    where: and(eq(schema.messages.tripId, tripId), gt(schema.messages.seq, afterSeq)),
    orderBy: asc(schema.messages.seq),
    columns: { seq: true, memberId: true, content: true, attachments: true, createdAt: true },
  });
}

// Everything the trip screen shows besides the chat. Plain JSON so it can go to the client.
export async function tripSnapshot(tripId: string) {
  const [members, { balances, transfers, totalCents }, expenses, budget, settlements, trip, sharePayments] = await Promise.all([
    listMembers(tripId),
    getBalances(tripId),
    listExpenses(tripId),
    getBudgetStatus(tripId),
    listSettlements(tripId),
    db.query.trips.findFirst({ where: eq(schema.trips.id, tripId), columns: { status: true } }),
    listSharePayments(tripId),
  ]);
  const net = new Map(balances.map((b) => [b.memberId, b]));
  return {
    totalCents,
    members: members.map((m, i) => ({
      id: m.id,
      avatar: avatarFor(tripId, i),
      name: m.displayName,
      role: m.role,
      status: m.status,
      joined: m.userId !== null,
      paidCents: net.get(m.id)?.paidCents ?? 0,
      shareCents: net.get(m.id)?.owedCents ?? 0,
      netCents: net.get(m.id)?.netCents ?? 0,
    })),
    expenses: expenses.map((e) => ({
      id: e.id,
      paidBy: e.paidBy,
      amountCents: e.amountCents,
      category: e.category,
      description: e.description,
      splitWith: e.splits.map((s) => s.memberId),
      shares: Object.fromEntries(e.splits.map((s) => [s.memberId, s.shareCents])),
      sharePaidBy: sharePayments.filter((p) => p.expenseId === e.id).map((p) => p.fromMember),
      hasReceipt: e.receiptId !== null,
      createdAt: e.createdAt.toISOString(),
    })),
    budget,
    transfers,
    status: trip!.status,
    settlements: settlements.map((s) => ({
      id: s.id,
      from: s.fromMember,
      to: s.toMember,
      amountCents: s.amountCents,
      status: s.status,
      paidAt: s.paidAt?.toISOString() ?? null,
    })),
  };
}
export type TripSnapshot = Awaited<ReturnType<typeof tripSnapshot>>;
