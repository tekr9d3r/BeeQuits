import { getSession } from "@/lib/session";

export async function POST(request: Request) {
  const session = await getSession();
  session.destroy();
  return Response.redirect(new URL("/", request.url), 303);
}
