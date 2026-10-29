import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { ensureDemoTrip } from "@/lib/demo";
import { getSession } from "@/lib/session";

// Opens the seeded demo trip signed in as Jack (the organizer).
export async function GET(request: Request) {
  if (process.env.DEMO_MODE !== "true") return new Response("Demo is disabled", { status: 404 });
  const trip = await ensureDemoTrip();
  const jack = await db.query.users.findFirst({ where: eq(schema.users.paypalUserId, "demo:jack") });
  const session = await getSession();
  session.userId = jack!.id;
  await session.save();
  return Response.redirect(new URL(`/t/${trip.publicId}`, request.url));
}
