import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { createSharePayment } from "@/lib/settlements";
import { getTripById } from "@/lib/trips";
import { loadMembership } from "@/lib/trip-view";

// Called by the "Pay my share" PayPal button's createOrder.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const expense = await db.query.expenses.findFirst({ where: eq(schema.expenses.id, id) });
  if (!expense) return new Response("Not found", { status: 404 });
  const trip = await getTripById(expense.tripId);
  const { me } = await loadMembership(trip!.publicId);
  if (!me) return new Response("Forbidden", { status: 403 });
  try {
    return Response.json(await createSharePayment(id, me.id));
  } catch (error) {
    console.error("[share payment]", error);
    return Response.json({ error: error instanceof Error ? error.message : "Could not create the PayPal order" }, { status: 400 });
  }
}
