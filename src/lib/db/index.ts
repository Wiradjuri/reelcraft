import "server-only";

import * as schema from "./schema";

// Use @libsql/client when TURSO_DATABASE_URL is set (Vercel/production),
// otherwise use better-sqlite3 for local development and tests.
const isTurso = !!process.env.TURSO_DATABASE_URL;

function createDb() {
  if (isTurso) {
    // Dynamic import so better-sqlite3 is never bundled for Vercel
    const { createClient } = require("@libsql/client") as typeof import("@libsql/client");
    const { drizzle } = require("drizzle-orm/libsql") as typeof import("drizzle-orm/libsql");
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    return drizzle(client, { schema });
  }

  const Database = require("better-sqlite3") as typeof import("better-sqlite3").default;
  const { drizzle } = require("drizzle-orm/better-sqlite3") as typeof import("drizzle-orm/better-sqlite3");
  const sqlite = new Database(process.env.DATABASE_URL ?? "data/reelflow.db");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      topic TEXT NOT NULL,
      target_audience TEXT NOT NULL,
      platform TEXT NOT NULL,
      objective TEXT NOT NULL,
      tone TEXT NOT NULL,
      duration INTEGER NOT NULL,
      visual_style TEXT NOT NULL,
      voice TEXT NOT NULL,
      call_to_action TEXT DEFAULT '',
      brand_instructions TEXT DEFAULT '',
      image_quality TEXT DEFAULT 'standard',
      status TEXT DEFAULT 'draft',
      script TEXT,
      storyboard TEXT,
      assets TEXT DEFAULT '[]',
      render_job TEXT,
      error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  return drizzle(sqlite, { schema });
}

export const db = createDb();
export type Database = typeof db;
