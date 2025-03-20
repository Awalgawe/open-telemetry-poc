import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { Logger } from "pino";

export const table_name = "test_table";
export type table_name = typeof table_name;

export interface TestItem {
  id: number;
  description: string;
  created_at: Date;
}

interface Database {
  [table_name]: TestItem;
}

const db = new Kysely<Database>({
  dialect: new PostgresDialect({
    pool: new Pool({
      host: "postgres",
      port: 5432,
      user: "admin",
      password: "admin",
      database: "telemetry",
    }),
  }),
});

export default db;

export async function initDB(logger: Logger) {
  const tables = await db.introspection.getTables();

  if (tables.some((table) => table.name === table_name)) {
    return;
  }

  logger.info(`Creating table ${table_name}`);

  await db.schema
    .createTable(table_name)
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("description", "text", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  logger.info(`Inserting a sample row into ${table_name}`);

  await db
    .insertInto(table_name)
    .values(
      // @ts-expect-error ignore
      { description: "This is a test description" }
    )
    .execute();
}
