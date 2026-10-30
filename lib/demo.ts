import { and, eq, lt, sql } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { avatarFor } from "./avatars";
import { db, schema } from "./db";
import { addExpense, setBudget, type Category } from "./ledger/service";

// The judge's friends. Their sandbox PayPal accounts are real payees, so paying them works for real.
export const DEMO_FRIENDS = [
  { key: "emma", name: "Emma", email: "sb-fh1r353552723@personal.example.com" },
  { key: "sam", name: "Sam", email: "sb-hjo0a53552700@personal.example.com" },
  { key: "olivia", name: "Olivia", email: "sb-wdwec53514350@personal.example.com" },
] as const;
type FriendKey = (typeof DEMO_FRIENDS)[number]["key"];

const BUDGET: [Category, number][] = [
  ["lodging", 1300], ["lift_passes", 1200], ["rental", 350], ["transport", 120],
  ["groceries", 180], ["food_drinks", 300], ["apres_ski", 100], ["activities", 120],
];

// What the friends logged before the judge arrived: [day of trip, payer, amount, category,
// description, what they typed, bee's reply]. Everything is split between all four.
const HISTORY: [number, FriendKey, number, Category, string, string, string][] = [
  [0, "emma", 1280, "lodging", "Chalet in Sölden", "Paid the chalet, 1280€ for the week", "Logged €1,280.00 lodging (chalet), paid by Emma, split 4 ways."],
  [0, "olivia", 86.4, "transport", "Fuel + Austrian vignette", "fuel and the vignette on the way, 86.40", "Logged €86.40 transport, paid by Olivia, split 4 ways."],
  [1, "sam", 1140, "lift_passes", "4x 6-day lift passes", "Bought 4 six-day lift passes, 1140", "Logged €1,140.00 lift passes, paid by Sam, split 4 ways. 🎿"],
  [1, "emma", 312, "rental", "Ski & boot rental", "Rental shop 312€ for all of us", "Logged €312.00 rental, paid by Emma, split 4 ways."],
  [2, "sam", 96.2, "groceries", "Spar groceries", "Spar run 96.20", "Logged €96.20 groceries (Spar), paid by Sam, split 4 ways."],
  [3, "olivia", 118.5, "food_drinks", "Pizzeria dinner", "Pizza night was 118.50, I got it", "Logged €118.50 food & drinks, paid by Olivia, split 4 ways."],
  [4, "emma", 64, "apres_ski", "Après-ski round", "Après round 64€ 🍻", "Logged €64.00 après-ski, paid by Emma, split 4 ways (€16.00 each). 🍻"],
  [4, "sam", 142, "food_drinks", "Fondue dinner", "Fondue tonight 142€ 🧀", "Logged €142.00 food & drinks, paid by Sam, split 4 ways."],
];

const newId = customAlphabet("23456789abcdefghjkmnpqrstuvwxyz", 12);
const DAY = 24 * 3600_000;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

// Creates a private copy of the Sölden trip for one visitor: they are the organizer, their three
// friends have already joined and logged the first days. Nobody else can see or change it.
// startKey is generated once per form load, so a double-submitted form reopens the same trip.
export async function createDemoTour(judgeName: string, startKey: string) {
  const existing = await db.query.trips.findFirst({
    where: and(eq(schema.trips.isDemo, true), sql`${schema.trips.demoTour}->>'startKey' = ${startKey}`),
  });
  if (existing) {
    const judge = await db.query.users.findFirst({ where: eq(schema.users.id, existing.createdBy!) });
    return { trip: existing, judge: judge! };
  }

  await db.delete(schema.trips).where(and(eq(schema.trips.isDemo, true), lt(schema.trips.createdAt, new Date(Date.now() - 3 * DAY))));

  const [judge] = await db
    .insert(schema.users)
    .values({
      paypalUserId: `demo-judge:${newId()}`,
      name: judgeName,
      paypalEmail: process.env.DEMO_BUYER_EMAIL || "judge@example.com",
    })
    .returning();
  const friends = new Map<FriendKey, typeof schema.users.$inferSelect>();
  for (const f of DEMO_FRIENDS) {
    const [u] = await db
      .insert(schema.users)
      .values({ paypalUserId: `demo:${f.key}`, name: f.name, paypalEmail: f.email })
      .onConflictDoUpdate({ target: schema.users.paypalUserId, set: { paypalEmail: f.email } })
      .returning();
    friends.set(f.key, u);
  }

  const start = new Date(Date.now() - 5 * DAY);
  start.setHours(9, 0, 0, 0);
  const [trip] = await db
    .insert(schema.trips)
    .values({
      publicId: newId(),
      inviteCode: newId(),
      name: "Ski week in Sölden",
      startDate: isoDate(start),
      endDate: isoDate(new Date(start.getTime() + 7 * DAY)),
      isDemo: true,
      demoTour: { startKey },
      createdBy: judge.id,
    })
    .returning();

  const [judgeMember] = await db
    .insert(schema.tripMembers)
    .values({ tripId: trip.id, userId: judge.id, displayName: judgeName, role: "organizer" })
    .returning();
  const members = new Map<FriendKey, string>();
  for (const f of DEMO_FRIENDS) {
    const [m] = await db
      .insert(schema.tripMembers)
      .values({ tripId: trip.id, userId: friends.get(f.key)!.id, displayName: f.name })
      .returning();
    members.set(f.key, m.id);
  }
  const everyone = [judgeMember.id, ...members.values()];

  for (const [category, amount] of BUDGET) await setBudget(trip.id, category, amount * 100);

  const at = (day: number, minutes = 0) => new Date(start.getTime() + day * DAY + minutes * 60_000);
  const say = (createdAt: Date, content: string, memberId: string | null = null, attachments: (typeof schema.messages.$inferInsert)["attachments"] = null) =>
    db.insert(schema.messages).values({ tripId: trip.id, memberId, content, attachments, createdAt });

  await say(at(-1), `🐝 Hi! I'm the money bee for **Ski week in Sölden**. Tell me what you paid or snap a receipt, and I'll keep the ledger and settle everyone up with PayPal at the end.`);
  for (const [i, f] of DEMO_FRIENDS.entries()) {
    await say(at(-1, i + 1), `${avatarFor(trip.id, i + 1).emoji} ${f.name} joined the trip via PayPal.`);
  }
  for (const [i, [day, payer, amount, category, description, said, reply]] of HISTORY.entries()) {
    const when = at(day, 600 + i * 7);
    await say(when, said, members.get(payer)!);
    const expense = await addExpense({
      tripId: trip.id,
      paidBy: members.get(payer)!,
      amountCents: Math.round(amount * 100),
      category,
      description,
      split: { type: "equal", memberIds: everyone },
      createdAt: when,
    });
    await say(new Date(when.getTime() + 5000), reply, null, [{ type: "expense", expenseId: expense.id }]);
  }
  await say(
    new Date(),
    `👋 Welcome, ${judgeName}! Your friends have been logging the trip so far. Follow the **demo tour** above, or just tell me what you paid. Everything here is your private copy with PayPal sandbox money, so try anything.`,
  );
  return { trip, judge };
}
