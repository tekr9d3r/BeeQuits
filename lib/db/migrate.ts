import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import { db } from ".";

export async function runMigrations() {
  const config = { migrationsFolder: "./drizzle" };
  if (process.env.DATABASE_URL) await migratePostgres(db, config);
  else await migratePglite(db as unknown as Parameters<typeof migratePglite>[0], config);
}
