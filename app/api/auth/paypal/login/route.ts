import { randomBytes } from "node:crypto";
import { safeReturnTo } from "@/lib/auth";
import { authorizeUrl } from "@/lib/paypal/identity";
import { getSession } from "@/lib/session";

export async function GET(request: Request) {
  const session = await getSession();
  session.oauthState = randomBytes(16).toString("hex");
  session.returnTo = safeReturnTo(new URL(request.url).searchParams.get("next"));
  await session.save();
  return Response.redirect(authorizeUrl(session.oauthState));
}
