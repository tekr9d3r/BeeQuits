import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db, schema } from "./db";
import { money } from "./format";
import { getBalances } from "./ledger/service";
import { paypal } from "./paypal/client";
import { listMembers } from "./trips";

const { settlements, trips, tripMembers } = schema;
export type Settlement = typeof settlements.$inferSelect;

// End-of-trip settle-up transfers (share payments made along the way are excluded).
export async function listSettlements(tripId: string) {
  return db.query.settlements.findMany({
    where: and(eq(settlements.tripId, tripId), isNull(settlements.expenseId)),
    orderBy: asc(settlements.createdAt),
  });
}

export async function listSharePayments(tripId: string) {
  return db.query.settlements.findMany({
    where: and(eq(settlements.tripId, tripId), eq(settlements.status, "captured")),
    columns: { expenseId: true, fromMember: true },
  });
}

// Locks the trip and turns the minimal transfers into settlements. Each one is paid
// directly from debtor to creditor on PayPal, so every creditor needs a PayPal login.
export async function startSettlement(tripId: string) {
  const existing = await listSettlements(tripId);
  if (existing.length) return { settlements: existing, alreadyStarted: true as const };

  const [{ transfers }, members] = await Promise.all([getBalances(tripId), listMembers(tripId)]);
  if (transfers.length === 0) return { settlements: [], alreadyStarted: false as const };

  const notJoined = [...new Set(transfers.map((t) => t.to))]
    .map((id) => members.find((m) => m.id === id)!)
    .filter((m) => !m.user);
  if (notJoined.length) {
    throw new Error(
      `${notJoined.map((m) => m.displayName).join(" and ")} must join the trip with PayPal before they can be paid back.`,
    );
  }

  const rows = await db.transaction(async (tx) => {
    await tx.update(trips).set({ status: "settling", lockedAt: new Date() }).where(eq(trips.id, tripId));
    return tx
      .insert(settlements)
      .values(transfers.map((t) => ({ tripId, fromMember: t.from, toMember: t.to, amountCents: t.amountCents })))
      .returning();
  });
  return { settlements: rows, alreadyStarted: false as const };
}

// Cancels a settle-up nobody has paid into yet, e.g. when someone forgot an expense.
export async function reopenTrip(tripId: string) {
  const rows = await listSettlements(tripId);
  if (rows.some((s) => s.status === "captured")) throw new Error("Payments have already been made, so the trip can't be reopened.");
  await db.transaction(async (tx) => {
    await tx.delete(settlements).where(and(eq(settlements.tripId, tripId), isNull(settlements.expenseId)));
    await tx.update(trips).set({ status: "active", lockedAt: null }).where(eq(trips.id, tripId));
  });
}

type PayPalOrder = { id: string; status: string };

// "Pay my share" on one expense: reuses an unpaid attempt or creates a new transfer to the payer.
export async function createSharePayment(expenseId: string, payerMemberId: string) {
  const expense = await db.query.expenses.findFirst({ where: eq(schema.expenses.id, expenseId), with: { splits: true } });
  if (!expense || expense.deletedAt) throw new Error("Expense not found");
  const trip = await db.query.trips.findFirst({ where: eq(trips.id, expense.tripId) });
  if (trip?.status !== "active") throw new Error("The group is settling up already, use the settle-up instead");
  const share = expense.splits.find((s) => s.memberId === payerMemberId);
  if (!share || expense.paidBy === payerMemberId) throw new Error("You don't owe anything on this expense");

  const previous = await db.query.settlements.findMany({
    where: and(eq(settlements.expenseId, expenseId), eq(settlements.fromMember, payerMemberId)),
  });
  if (previous.some((p) => p.status === "captured")) throw new Error("You already paid your share");
  const open = previous.find((p) => p.status !== "captured");
  const row =
    open ??
    (
      await db
        .insert(settlements)
        .values({ tripId: expense.tripId, expenseId, fromMember: payerMemberId, toMember: expense.paidBy, amountCents: share.shareCents })
        .returning()
    )[0];
  const orderId = await createSettlementOrder(row.id, payerMemberId, `${expense.description} (my share)`);
  return { settlementId: row.id, orderId };
}

// Creates the PayPal order for one transfer: the signed-in debtor pays, the creditor's
// PayPal email is the payee. BeeQuits is never in the money flow.
export async function createSettlementOrder(settlementId: string, payerMemberId: string, label?: string) {
  const s = await db.query.settlements.findFirst({ where: eq(settlements.id, settlementId) });
  if (!s || s.fromMember !== payerMemberId) throw new Error("This payment isn't yours to make");
  if (s.status === "captured") throw new Error("Already paid");
  const [trip, creditor] = await Promise.all([
    db.query.trips.findFirst({ where: eq(trips.id, s.tripId) }),
    db.query.tripMembers.findFirst({ where: eq(tripMembers.id, s.toMember), with: { user: true } }),
  ]);
  if (!creditor?.user) throw new Error("The person you're paying hasn't joined with PayPal yet");

  const order = await paypal<PayPalOrder>("POST", "/v2/checkout/orders", {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: s.id,
        custom_id: s.id,
        description: `BeeQuits · ${trip!.name} · ${label ?? "settle-up"}`.slice(0, 127),
        amount: { currency_code: trip!.currency, value: (s.amountCents / 100).toFixed(2) },
        payee: { email_address: creditor.user.paypalEmail },
      },
    ],
  });
  await db.update(settlements).set({ paypalOrderId: order.id, status: "pending" }).where(eq(settlements.id, s.id));
  return order.id;
}

type CaptureResponse = {
  status: string;
  purchase_units: { payments?: { captures?: { id: string; status: string }[] } }[];
};

export async function captureSettlementOrder(settlementId: string, payerMemberId: string) {
  const s = await db.query.settlements.findFirst({ where: eq(settlements.id, settlementId) });
  if (!s?.paypalOrderId || s.fromMember !== payerMemberId) throw new Error("Nothing to capture");
  if (s.status === "captured") return s;
  const result = await paypal<CaptureResponse>("POST", `/v2/checkout/orders/${s.paypalOrderId}/capture`, {});
  const capture = result.purchase_units[0]?.payments?.captures?.[0];
  if (capture?.status === "COMPLETED") await markCaptured(s.paypalOrderId, capture.id);
  else await db.update(settlements).set({ status: "approved" }).where(eq(settlements.id, s.id));
  return db.query.settlements.findFirst({ where: eq(settlements.id, s.id) });
}

// Called from both the capture response and the webhook; only the first call posts to the chat.
export async function markCaptured(paypalOrderId: string, captureId: string) {
  const [updated] = await db
    .update(settlements)
    .set({ status: "captured", paypalCaptureId: captureId, paidAt: new Date() })
    .where(and(eq(settlements.paypalOrderId, paypalOrderId), inArray(settlements.status, ["pending", "approved", "failed"])))
    .returning();
  if (!updated) return;

  const [members, trip, all, expense] = await Promise.all([
    listMembers(updated.tripId),
    db.query.trips.findFirst({ where: eq(trips.id, updated.tripId) }),
    listSettlements(updated.tripId),
    updated.expenseId ? db.query.expenses.findFirst({ where: eq(schema.expenses.id, updated.expenseId) }) : null,
  ]);
  const name = (id: string) => members.find((m) => m.id === id)?.displayName ?? "Someone";
  const forWhat = expense ? ` for their share of ${expense.description}` : "";
  const how = captureId === SIMULATED ? " (simulated demo friend)" : " via PayPal";
  await db.insert(schema.messages).values({
    tripId: updated.tripId,
    content: `${name(updated.fromMember)} paid ${name(updated.toMember)} ${money(updated.amountCents, trip!.currency)}${forWhat}${how}.`,
    attachments: [{ type: "settlement", settlementId: updated.id }],
  });
  if (trip!.status === "settling" && all.length > 0 && all.every((s) => s.status === "captured")) {
    await db.update(trips).set({ status: "closed" }).where(eq(trips.id, updated.tripId));
    await db.insert(schema.messages).values({
      tripId: updated.tripId,
      content: "Everyone is quits 🎉 All payments went directly between you on PayPal. Thanks for using BeeQuits.",
    });
  }
}

const SIMULATED = "SIMULATED";

// Guided demo only: the visitor can't log into their friends' PayPal accounts, so transfers
// between the simulated friends are marked paid. The visitor's own transfers stay real.
export async function simulateFriendPayments(tripId: string) {
  const trip = await db.query.trips.findFirst({ where: eq(trips.id, tripId) });
  if (!trip?.isDemo || trip.status !== "settling") return;
  const judge = await db.query.tripMembers.findFirst({
    where: and(eq(tripMembers.tripId, tripId), eq(tripMembers.role, "organizer")),
  });
  for (const s of await listSettlements(tripId)) {
    if (s.status === "captured" || s.fromMember === judge?.id) continue;
    const orderId = s.paypalOrderId ?? `SIM-${s.id}`;
    await db.update(settlements).set({ paypalOrderId: orderId }).where(eq(settlements.id, s.id));
    await markCaptured(orderId, SIMULATED);
  }
}

export async function markFailed(paypalOrderId: string) {
  await db
    .update(settlements)
    .set({ status: "failed" })
    .where(and(eq(settlements.paypalOrderId, paypalOrderId), inArray(settlements.status, ["pending", "approved"])));
}
