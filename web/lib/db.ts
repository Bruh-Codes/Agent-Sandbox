import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";

function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  return drizzle(process.env.DATABASE_URL);
}

let _db: ReturnType<typeof drizzle> | undefined;

const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_, prop) {
    if (!_db) _db = getDb();
    return (_db as any)[prop];
  },
});

export default db;
