import { publicUrl } from "@/lib/auth";
import { getSession } from "@/lib/session";

export async function POST(request: Request) {
  const session = await getSession();
  session.destroy();
  return Response.redirect(publicUrl("/", request), 303);
}
