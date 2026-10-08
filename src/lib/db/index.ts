import "server-only";

import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";

const dbPath = process.env.DATABASE_URL ?? "data/reelflow.db";
const sqlite = new Database(dbPath);
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

export const db = drizzle(sqlite, { schema });
export type Database = typeof db;
