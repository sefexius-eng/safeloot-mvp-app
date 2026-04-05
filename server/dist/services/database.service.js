"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pingDatabase = pingDatabase;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ override: true });
const pg_1 = require("pg");
const databaseUrl = process.env.DATABASE_URL?.trim();
const poolConfig = databaseUrl
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
const pool = new pg_1.Pool(poolConfig);
async function pingDatabase() {
    try {
        await pool.query("SELECT 1");
        return "up";
    }
    catch {
        return "down";
    }
}
