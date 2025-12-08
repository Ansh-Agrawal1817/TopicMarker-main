import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// Lazy initialization for serverless
let _db: PostgresJsDatabase | null = null;

export const db = new Proxy({} as PostgresJsDatabase, {
  get(_, prop) {
    if (!_db) {
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new Error("DATABASE_URL is not set");
      }
      const queryClient = postgres(databaseUrl);
      _db = drizzle(queryClient);
    }
    return (_db as any)[prop];
  }
});
