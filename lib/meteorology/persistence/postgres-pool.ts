import { Pool } from "pg";

/**
 * Pool exclusivo do servidor. Nunca importe este módulo em componentes client-side.
 * DATABASE_URL deve existir somente no ambiente do servidor.
 */
let pool: Pool | undefined;

export function getPostgresPool(): Pool {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL não foi configurada no ambiente do servidor.");
  }

  pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: true },
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    application_name: "climabr",
  });

  return pool;
}

export async function closePostgresPool(): Promise<void> {
  if (!pool) return;
  const current = pool;
  pool = undefined;
  await current.end();
}
