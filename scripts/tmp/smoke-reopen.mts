import { runMigrations } from "@/lib/db/migrate";
import { db, schema } from "@/lib/db";
import { ensureDemoTrip } from "@/lib/demo";
import { runAgent } from "@/lib/agent/run";
import { listMembers } from "@/lib/trips";
import { listSettlements } from "@/lib/settlements";

await runMigrations();
const t0 = await ensureDemoTrip();
const members = await listMembers(t0.id);
const id = (n: string) => members.find((m) => m.displayName === n)!.id;
const trip = async () => (await db.query.trips.findFirst({ where: (t, { eq }) => eq(t.id, t0.id) }))!;
async function say(who: string, text: string) {
  await db.insert(schema.messages).values({ tripId: t0.id, memberId: id(who), content: text });
  const r = await runAgent(await trip());
  console.log(`\n${who}: ${text}\n🐝 ${r?.content}\n   [status ${(await trip()).status}, settlements ${(await listSettlements(t0.id)).length}]`);
}
await say("Sam", "trip's over, let's settle!");
await say("Emma", "oh wait, I also paid 20 for parking");
await say("Jack", "yes go ahead, reopen it");
