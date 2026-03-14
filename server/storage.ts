import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "@shared/schema";
import { sql } from "drizzle-orm";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "../data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const sqlite = new Database(path.join(DATA_DIR, "portfolio.db"));
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });

// Auto-migrate / create tables
db.run(sql`
  CREATE TABLE IF NOT EXISTS positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker TEXT NOT NULL,
    name TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 0,
    pru REAL NOT NULL DEFAULT 0,
    sector TEXT NOT NULL DEFAULT 'Autre',
    country TEXT NOT NULL DEFAULT '',
    currency TEXT NOT NULL DEFAULT 'EUR',
    "dividendYield" REAL NOT NULL DEFAULT 0,
    "totalDividendsReceived" REAL NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

db.run(sql`
  CREATE TABLE IF NOT EXISTS dividend_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    "positionId" INTEGER NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);
