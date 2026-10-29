import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Render sets DATABASE_URL. Locally we fall back to an embedded Postgres (PGlite) in .pglite/,
// so development needs no database install. Both expose the same Drizzle query API.
function connect(): PostgresJsDatabase<typeof schema> {
  if (process.env.DATABASE_URL) {
    return drizzlePostgres(postgres(process.env.DATABASE_URL, { max: 5 }), { schema, casing: "snake_case" });
  }
  const local = drizzlePglite(new PGlite(".pglite"), { schema, casing: "snake_case" });
  return local as unknown as PostgresJsDatabase<typeof schema>;
}

// Cache across Next dev hot reloads, otherwise each reload opens a new connection.
const globalForDb = globalThis as unknown as { db?: ReturnType<typeof connect> };
export const db = (globalForDb.db ??= connect());
export { schema };
