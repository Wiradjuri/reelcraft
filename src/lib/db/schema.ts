import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  topic: text("topic").notNull(),
  targetAudience: text("target_audience").notNull(),
  platform: text("platform").notNull(),
  objective: text("objective").notNull(),
  tone: text("tone").notNull(),
  duration: integer("duration").notNull(),
  visualStyle: text("visual_style").notNull(),
  voice: text("voice").notNull(),
  callToAction: text("call_to_action").default(""),
  brandInstructions: text("brand_instructions").default(""),
  imageQuality: text("image_quality").default("standard"),
  status: text("status").default("draft"),
  script: text("script"),            // JSON string
  storyboard: text("storyboard"),    // JSON string
  assets: text("assets").default("[]"),      // JSON string
  renderJob: text("render_job"),             // JSON string
  error: text("error"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
