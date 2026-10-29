import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { ensureDemoTrip, resetDemoTrip } from "@/lib/demo";
import { getSession } from "@/lib/session";
import { publicUrl } from "@/lib/auth";

// Opens the seeded demo trip signed in as Jack (the organizer). ?reset starts it over.
export async function GET(request: Request) {
  if (process.env.DEMO_MODE !== "true") return new Response("Demo is disabled", { status: 404 });
  const reset = new URL(request.url).searchParams.has("reset");
  const trip = reset ? await resetDemoTrip() : await ensureDemoTrip();
  const jack = await db.query.users.findFirst({ where: eq(schema.users.paypalUserId, "demo:jack") });
  const session = await getSession();
  session.userId = jack!.id;
  await session.save();
  return Response.redirect(publicUrl(`/t/${trip.publicId}`, request));
}
