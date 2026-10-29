import { and, eq, like } from "drizzle-orm";
import { db, schema } from "./db";
import { addExpense, setBudget, type Category } from "./ledger/service";

// Sandbox personal accounts, so every settle-up in the demo is a real sandbox PayPal payment.
const CREW = [
  { key: "jack", name: "Jack", email: "sb-v7pbv53552738@personal.example.com", role: "organizer" as const },
  { key: "emma", name: "Emma", email: "sb-fh1r353552723@personal.example.com", role: "member" as const },
  { key: "sam", name: "Sam", email: "sb-hjo0a53552700@personal.example.com", role: "member" as const },
  { key: "olivia", name: "Olivia", email: "sb-wdwec53514350@personal.example.com", role: "member" as const },
];
type Key = (typeof CREW)[number]["key"];

const BUDGET: [Category, number][] = [
  ["lodging", 1300], ["lift_passes", 1200], ["rental", 350], ["transport", 120],
  ["groceries", 180], ["food_drinks", 250], ["apres_ski", 100], ["activities", 120],
];

// [payer, amount, category, description, split (null = everyone), what they typed, bee's reply]
const EXPENSES: [Key, number, Category, string, Key[] | null, string, string][] = [
  ["jack", 1280, "lodging", "Chalet in Sölden", null, "Paid the chalet, 1280€ for the week", "Logged €1,280.00 lodging (chalet), paid by Jack, split 4 ways."],
  ["jack", 1140, "lift_passes", "4x 6-day lift passes", null, "Bought 4 six-day lift passes, 1140", "Logged €1,140.00 lift passes, paid by Jack, split 4 ways. 🎿"],
  ["olivia", 86.4, "transport", "Fuel + Austrian vignette", null, "fuel and the vignette on the way, 86.40", "Logged €86.40 transport, paid by Olivia, split 4 ways."],
  ["emma", 312, "rental", "Ski & boot rental", ["emma", "sam", "olivia"], "Rental shop 312€ for me, Sam and Olivia (Jack brought his own skis)", "Logged €312.00 rental, paid by Emma, split Emma/Sam/Olivia."],
  ["sam", 96.2, "groceries", "Spar groceries", null, "Spar run 96.20", "Logged €96.20 groceries (Spar), paid by Sam, split 4 ways."],
  ["emma", 118.5, "food_drinks", "Pizzeria dinner", null, "Pizza night was 118.50, I got it", "Logged €118.50 food & drinks, paid by Emma, split 4 ways."],
  ["olivia", 95, "activities", "Ski school lesson for Emma", ["emma"], "I paid Emma's ski school lesson, 95", "Logged €95.00 activities, paid by Olivia, for Emma only."],
  ["sam", 64, "apres_ski", "Après-ski round", ["jack", "sam", "olivia"], "Après round 64€, Emma had already left", "Logged €64.00 après-ski, paid by Sam, split Jack/Sam/Olivia. 🍻"],
  ["jack", 54.8, "groceries", "Spar groceries", null, "second Spar run, 54.80", "Logged €54.80 groceries, paid by Jack, split 4 ways."],
  ["emma", 142, "food_drinks", "Fondue dinner", null, "Fondue tonight 142€ 🧀", "Logged €142.00 food & drinks, paid by Emma, split 4 ways. Heads up: food & drinks is now €10.50 over its €250 budget."],
];

export async function ensureDemoTrip() {
  const existing = await db.query.trips.findFirst({ where: eq(schema.trips.isDemo, true) });
  if (existing) {
    const seeded = await db.query.messages.findFirst({ where: eq(schema.messages.tripId, existing.id) });
    if (seeded) return existing;
    // A previous seed died halfway: start over.
    await db.delete(schema.trips).where(eq(schema.trips.id, existing.id));
  }

  const users = new Map<Key, typeof schema.users.$inferSelect>();
  for (const c of CREW) {
    const [u] = await db
      .insert(schema.users)
      .values({ paypalUserId: `demo:${c.key}`, name: c.name, paypalEmail: c.email })
      .onConflictDoUpdate({ target: schema.users.paypalUserId, set: { paypalEmail: c.email } })
      .returning();
    users.set(c.key, u);
  }

  const [trip] = await db
    .insert(schema.trips)
    .values({
      publicId: "soelden-demo",
      inviteCode: "demo",
      name: "Ski week in Sölden",
      startDate: "2026-01-24",
      endDate: "2026-01-31",
      isDemo: true,
      createdBy: users.get("jack")!.id,
    })
    .returning();

  const members = new Map<Key, string>();
  for (const c of CREW) {
    const [m] = await db
      .insert(schema.tripMembers)
      .values({ tripId: trip.id, userId: users.get(c.key)!.id, displayName: c.name, role: c.role })
      .returning();
    members.set(c.key, m.id);
  }
  const everyone = CREW.map((c) => members.get(c.key)!);

  for (const [category, amount] of BUDGET) await setBudget(trip.id, category, amount * 100);

  await db.insert(schema.messages).values({
    tripId: trip.id,
    content: "🐝 Hi! I'm the money bee for **Ski week in Sölden**. Tell me what you paid or snap a receipt, and I'll keep the ledger and settle everyone up with PayPal at the end.",
  });
  for (const [payer, amount, category, description, split, said, reply] of EXPENSES) {
    await db.insert(schema.messages).values({ tripId: trip.id, memberId: members.get(payer)!, content: said });
    const expense = await addExpense({
      tripId: trip.id,
      paidBy: members.get(payer)!,
      amountCents: Math.round(amount * 100),
      category,
      description,
      split: { type: "equal", memberIds: split ? split.map((k) => members.get(k)!) : everyone },
    });
    await db.insert(schema.messages).values({
      tripId: trip.id,
      content: reply,
      attachments: [{ type: "expense", expenseId: expense.id }],
    });
  }
  return trip;
}

export async function isDemoUser(userId: string) {
  return !!(await db.query.users.findFirst({
    where: and(eq(schema.users.id, userId), like(schema.users.paypalUserId, "demo:%")),
  }));
}
