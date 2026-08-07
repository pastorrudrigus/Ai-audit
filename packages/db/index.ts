import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema/index";

export function createDb(databaseUrl: string) {
  const sql = postgres(databaseUrl, { prepare: false });
  return drizzle(sql, { schema });
}

export * from "./schema/index";
export type { InferSelectModel, InferInsertModel } from "drizzle-orm";
