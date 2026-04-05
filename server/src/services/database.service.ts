import dotenv from "dotenv";

dotenv.config({ override: true });

import { Pool, PoolConfig } from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim();

const poolConfig: PoolConfig = databaseUrl
  ? {
      connectionString: databaseUrl,
      ssl: databaseUrl.includes("sslmode=require")
        ? {
            rejectUnauthorized: false,
          }
        : undefined,
    }
  : {
      host: process.env.DB_HOST ?? "localhost",
      port: Number(process.env.DB_PORT ?? 5432),
      user: process.env.DB_USER ?? "postgres",
      password: process.env.DB_PASSWORD ?? "postgres",
      database: process.env.DB_NAME ?? "app_db",
    };

const pool = new Pool(poolConfig);

export async function pingDatabase(): Promise<"up" | "down"> {
  try {
    await pool.query("SELECT 1");
    return "up";
  } catch {
    return "down";
  }
}