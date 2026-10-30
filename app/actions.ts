"use server";

import { redirect } from "next/navigation";
import { payPalUser } from "@/lib/auth";
import { createDemoTour } from "@/lib/demo";
import { db, schema } from "@/lib/db";
import { getBalances } from "@/lib/ledger/service";
import { getSession } from "@/lib/session";
import {
  addPlaceholder,
  getTripByPublicId,
  joinTrip,
  listMembers,
  regenerateInvite,
  renameMember,
  setLocked,
} from "@/lib/trips";
import { loadMembership } from "@/lib/trip-view";
import { eq } from "drizzle-orm";

export async function joinTripAction(publicId: string, code: string, claimMemberId: string | null) {
  const [trip, user] = await Promise.all([getTripByPublicId(publicId), payPalUser()]);
  if (!trip || trip.inviteCode !== code) throw new Error("This invite link is no longer valid");
  if (!user) redirect(`/api/auth/paypal/login?next=${encodeURIComponent(`/t/${publicId}/join?code=${code}`)}`);
  await joinTrip(trip, user, claimMemberId);
  redirect(`/t/${publicId}`);
}

// Starts a private guided demo trip for this browser: no PayPal login, the visitor is the organizer.
export async function startDemoTour(formData: FormData) {
  if (process.env.DEMO_MODE !== "true") throw new Error("The demo is disabled");
  const name = String(formData.get("name") ?? "").trim().slice(0, 30) || "Alex";
  const startKey = String(formData.get("startKey") ?? "").slice(0, 64) || crypto.randomUUID();
  const { trip, judge } = await createDemoTour(name, startKey);
  const session = await getSession();
  session.userId = judge.id;
  await session.save();
  redirect(`/t/${trip.publicId}`);
}

export type ActionResult = { error?: string };

// People-tab actions report problems as values: thrown errors are redacted in production builds.
async function attempt(fn: () => Promise<unknown>): Promise<ActionResult> {
  try {
    await fn();
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

async function requireOrganizer(publicId: string) {
  const { trip, me } = await loadMembership(publicId);
  if (!trip || me?.role !== "organizer") throw new Error("Only the organizer can do that");
  return trip;
}

async function requireMember(publicId: string) {
  const { trip, me } = await loadMembership(publicId);
  if (!trip || !me) throw new Error("Not a member of this trip");
  return { trip, me };
}

export async function addPlaceholderAction(publicId: string, name: string): Promise<ActionResult> {
  return attempt(async () => {
    const { trip } = await requireMember(publicId);
    if (!name.trim()) return;
    await addPlaceholder(trip.id, name.slice(0, 40));
  });
}

export async function renameMemberAction(publicId: string, memberId: string, name: string): Promise<ActionResult> {
  return attempt(async () => {
    const { trip, me } = await requireMember(publicId);
    if (!name.trim()) return;
    if (memberId !== me.id && me.role !== "organizer") throw new Error("You can only rename yourself");
    const members = await listMembers(trip.id);
    if (!members.some((m) => m.id === memberId)) throw new Error("Unknown member");
    await renameMember(memberId, name.slice(0, 40));
  });
}

export async function regenerateInviteAction(publicId: string): Promise<ActionResult> {
  return attempt(async () => {
    const trip = await requireOrganizer(publicId);
    await regenerateInvite(trip.id);
  });
}

export async function setLockedAction(publicId: string, locked: boolean): Promise<ActionResult> {
  return attempt(async () => {
    const trip = await requireOrganizer(publicId);
    await setLocked(trip.id, locked);
  });
}

// Members with expenses can't vanish from the ledger: removal is only allowed once they're even,
// and then they're marked inactive rather than deleted.
export async function removeMemberAction(publicId: string, memberId: string): Promise<ActionResult> {
  return attempt(async () => {
    const trip = await requireOrganizer(publicId);
    const { balances } = await getBalances(trip.id);
    const balance = balances.find((b) => b.memberId === memberId);
    if (balance && balance.netCents !== 0) throw new Error("Settle this member's balance before removing them");
    await db.update(schema.tripMembers).set({ status: "inactive" }).where(eq(schema.tripMembers.id, memberId));
  });
}
