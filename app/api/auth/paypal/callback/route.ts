import { publicUrl, safeReturnTo } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { exchangeCode } from "@/lib/paypal/identity";
import { getSession } from "@/lib/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const session = await getSession();
  const code = url.searchParams.get("code");
  if (!code || url.searchParams.get("state") !== session.oauthState) {
    return new Response("Login failed or expired. Please try again.", { status: 400 });
  }

  const identity = await exchangeCode(code);
  const [user] = await db
    .insert(schema.users)
    .values({ paypalUserId: identity.paypalUserId, name: identity.name, paypalEmail: identity.email })
    .onConflictDoUpdate({
      target: schema.users.paypalUserId,
      set: { paypalEmail: identity.email },
    })
    .returning();

  const returnTo = safeReturnTo(session.returnTo);
  session.userId = user.id;
  session.oauthState = undefined;
  session.returnTo = undefined;
  await session.save();
  return Response.redirect(publicUrl(returnTo, request));
}
