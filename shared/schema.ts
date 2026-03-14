import { sqliteTable, integer, real, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const positions = sqliteTable("positions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ticker: text("ticker").notNull(),
  name: text("name").notNull(),
  quantity: real("quantity").notNull().default(0),
  pru: real("pru").notNull().default(0),
  sector: text("sector").notNull().default("Autre"),
  country: text("country").notNull().default(""),
  currency: text("currency").notNull().default("EUR"),
  dividendYield: real("dividendYield").notNull().default(0),
  totalDividendsReceived: real("totalDividendsReceived").notNull().default(0),
  notes: text("notes").notNull().default(""),
  createdAt: text("createdAt").notNull().default(new Date().toISOString()),
});

export const dividendEntries = sqliteTable("dividend_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  positionId: integer("positionId").notNull().references(() => positions.id, { onDelete: "cascade" }),
  amount: real("amount").notNull(),
  date: text("date").notNull(),
  note: text("note").notNull().default(""),
  createdAt: text("createdAt").notNull().default(new Date().toISOString()),
});

export const insertPositionSchema = createInsertSchema(positions).omit({ id: true, createdAt: true, totalDividendsReceived: true });
export const insertDividendSchema = createInsertSchema(dividendEntries).omit({ id: true, createdAt: true });

export type Position = typeof positions.$inferSelect;
export type InsertPosition = z.infer<typeof insertPositionSchema>;
export type DividendEntry = typeof dividendEntries.$inferSelect;
export type InsertDividend = z.infer<typeof insertDividendSchema>;
