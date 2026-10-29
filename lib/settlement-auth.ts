import { eq } from "drizzle-orm";
import { db, schema } from "./db";
import { getTripById } from "./trips";
import { loadMembership } from "./trip-view";

// The signed-in member of the settlement's trip, or null.
export async function memberForSettlement(settlementId: string) {
  const s = await db.query.settlements.findFirst({ where: eq(schema.settlements.id, settlementId) });
  if (!s) return null;
  const trip = await getTripById(s.tripId);
  const { me } = await loadMembership(trip!.publicId);
  return me;
}
