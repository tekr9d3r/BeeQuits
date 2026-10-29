import { eq } from "drizzle-orm";
import { db, schema } from "./db";
import { getSession } from "./session";

export async function currentUser() {
  const session = await getSession();
  if (!session.userId) return null;
  return (await db.query.users.findFirst({ where: eq(schema.users.id, session.userId) })) ?? null;
}

// Only same-site paths, so the login redirect can't be abused as an open redirect.
export function safeReturnTo(value: string | null | undefined): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

// Behind Render's proxy request.url is the internal address (https://localhost:10000),
// so redirects are built from the forwarded host instead.
export function publicUrl(path: string, request: Request): URL {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  return new URL(path, host ? `${proto}://${host}` : request.url);
}
