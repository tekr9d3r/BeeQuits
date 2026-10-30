import Anthropic from "@anthropic-ai/sdk";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import { db, schema } from "./db";
import { money } from "./format";
import { listSettlements } from "./settlements";
import { listMembers, type Trip } from "./trips";

// Sonnet only for BeeQuits (cost).
const MODEL = "claude-sonnet-5-5";
const client = new Anthropic();

function nudgeAfterMs() {
  return Number(process.env.NUDGE_AFTER_HOURS ?? 24) * 3600_000;
}

// Posts a reminder when settle-up transfers have stayed unpaid for a while. Runs at most once
// per period per trip: claiming lastNudgedAt in the UPDATE stops concurrent pollers double-posting.
export async function maybeAutoNudge(trip: Trip) {
  if (trip.status !== "settling") return;
  const cutoff = new Date(Date.now() - nudgeAfterMs());
  const open = (await listSettlements(trip.id)).filter((s) => s.status !== "captured" && s.createdAt < cutoff);
  if (!open.length) return;

  const [claimed] = await db
    .update(schema.trips)
    .set({ lastNudgedAt: new Date() })
    .where(and(eq(schema.trips.id, trip.id), or(isNull(schema.trips.lastNudgedAt), lt(schema.trips.lastNudgedAt, cutoff))))
    .returning({ id: schema.trips.id });
  if (!claimed) return;

  const members = await listMembers(trip.id);
  const name = (id: string) => members.find((m) => m.id === id)?.displayName ?? "someone";
  const lines = open.map((s) => `${name(s.fromMember)} owes ${name(s.toMember)} ${money(s.amountCents, trip.currency)}`);
  await db.insert(schema.messages).values({ tripId: trip.id, content: await writeNudge(trip.name, lines) });
}

async function writeNudge(tripName: string, open: string[]) {
  const fallback = `🔔 Friendly reminder from your money bee: ${open.join("; ")}. Tap your Pay button and we're all quits! 🐝`;
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1000,
      output_config: { effort: "low" },
      system:
        "You are BeeQuits, the friendly money bee of a group trip. Write a short, warm, lightly funny reminder (2-4 lines) for friends who still haven't paid their settle-up. Name each person, the amount and who they pay. Remind them it's one tap on their PayPal button. No guilt-tripping. Start with 🔔.",
      messages: [{ role: "user", content: `Trip: ${tripName}\nStill open:\n${open.join("\n")}` }],
    });
    const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
    return text || fallback;
  } catch (error) {
    console.error("[nudge]", error);
    return fallback;
  }
}
