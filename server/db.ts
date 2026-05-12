import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool, types } = pg;

// All `timestamp without time zone` values in our DB are stored in UTC
// (PostgreSQL server runs in UTC). Tell the driver to parse OID 1114
// as UTC so the returned Date object is correct, and JSON serialization
// produces ISO strings with `Z` — letting each browser render the
// message time in the user's own local timezone (Haiti = UTC-5, etc.).
types.setTypeParser(1114, (val: string) => new Date(val.endsWith("Z") ? val : val.replace(" ", "T") + "Z"));

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
