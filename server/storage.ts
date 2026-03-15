import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import {
  Position, InsertPosition,
  DividendEntry, InsertDividendEntry,
  QualityScore, InsertQualityScore,
} from "@shared/schema";

export interface IStorage {
  getPositions(): Promise<Position[]>;
  getPosition(id: number): Promise<Position | undefined>;
  createPosition(pos: InsertPosition): Promise<Position>;
  updatePosition(id: number, pos: Partial<InsertPosition>): Promise<Position | undefined>;
  deletePosition(id: number): Promise<boolean>;
  getDividendEntries(positionId: number): Promise<DividendEntry[]>;
  createDividendEntry(entry: InsertDividendEntry): Promise<DividendEntry>;
  deleteDividendEntry(id: number): Promise<boolean>;
  getQualityScore(positionId: number): Promise<QualityScore | undefined>;
  upsertQualityScore(score: InsertQualityScore): Promise<QualityScore>;
}

// Determine DB path — use /data for Render persistent disk, fallback to local
const DATA_DIR = process.env.RENDER ? "/data" : path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, "portfolio.db");

class SQLiteStorage implements IStorage {
  private db: Database.Database;

  constructor() {
    this.db = new Database(DB_PATH);
    this.db.pragma("journal_mode = WAL");
    this.migrate();
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS positions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker TEXT NOT NULL,
        name TEXT NOT NULL,
        sector TEXT NOT NULL,
        quantity REAL NOT NULL,
        pru REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'EUR',
        total_dividends_received REAL NOT NULL DEFAULT 0,
        notes TEXT,
        added_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS dividend_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        position_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        note TEXT,
        FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS quality_scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        position_id INTEGER NOT NULL UNIQUE,
        roic_above_15 INTEGER NOT NULL DEFAULT 0,
        margin_stable INTEGER NOT NULL DEFAULT 0,
        low_debt INTEGER NOT NULL DEFAULT 0,
        dividend_growth INTEGER NOT NULL DEFAULT 0,
        moat INTEGER NOT NULL DEFAULT 0,
        management_quality INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE CASCADE
      );
    `);
  }

  private rowToPosition(row: any): Position {
    return {
      id: row.id,
      ticker: row.ticker,
      name: row.name,
      sector: row.sector,
      quantity: row.quantity,
      pru: row.pru,
      currency: row.currency,
      totalDividendsReceived: row.total_dividends_received,
      notes: row.notes,
      addedAt: new Date(row.added_at),
    };
  }

  private rowToDividend(row: any): DividendEntry {
    return { id: row.id, positionId: row.position_id, amount: row.amount, date: row.date, note: row.note };
  }

  private rowToQuality(row: any): QualityScore {
    return {
      id: row.id,
      positionId: row.position_id,
      roicAbove15: row.roic_above_15,
      marginStable: row.margin_stable,
      lowDebt: row.low_debt,
      dividendGrowth: row.dividend_growth,
      moat: row.moat,
      managementQuality: row.management_quality,
      updatedAt: new Date(row.updated_at),
    };
  }

  async getPositions(): Promise<Position[]> {
    const rows = this.db.prepare("SELECT * FROM positions ORDER BY id").all();
    return rows.map(this.rowToPosition);
  }

  async getPosition(id: number): Promise<Position | undefined> {
    const row = this.db.prepare("SELECT * FROM positions WHERE id = ?").get(id);
    return row ? this.rowToPosition(row) : undefined;
  }

  async createPosition(pos: InsertPosition): Promise<Position> {
    const stmt = this.db.prepare(`
      INSERT INTO positions (ticker, name, sector, quantity, pru, currency, total_dividends_received, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      pos.ticker, pos.name, pos.sector, pos.quantity, pos.pru,
      pos.currency ?? "EUR", pos.totalDividendsReceived ?? 0, pos.notes ?? null
    );
    return (await this.getPosition(result.lastInsertRowid as number))!;
  }

  async updatePosition(id: number, updates: Partial<InsertPosition>): Promise<Position | undefined> {
    const pos = await this.getPosition(id);
    if (!pos) return undefined;
    const merged = {
      ticker: updates.ticker ?? pos.ticker,
      name: updates.name ?? pos.name,
      sector: updates.sector ?? pos.sector,
      quantity: updates.quantity ?? pos.quantity,
      pru: updates.pru ?? pos.pru,
      currency: updates.currency ?? pos.currency,
      totalDividendsReceived: updates.totalDividendsReceived ?? pos.totalDividendsReceived,
      notes: updates.notes !== undefined ? updates.notes : pos.notes,
    };
    this.db.prepare(`
      UPDATE positions SET ticker=?, name=?, sector=?, quantity=?, pru=?, currency=?, total_dividends_received=?, notes=?
      WHERE id=?
    `).run(merged.ticker, merged.name, merged.sector, merged.quantity, merged.pru, merged.currency, merged.totalDividendsReceived, merged.notes, id);
    return this.getPosition(id);
  }

  async deletePosition(id: number): Promise<boolean> {
    const result = this.db.prepare("DELETE FROM positions WHERE id = ?").run(id);
    return result.changes > 0;
  }

  async getDividendEntries(positionId: number): Promise<DividendEntry[]> {
    const rows = this.db.prepare("SELECT * FROM dividend_entries WHERE position_id = ? ORDER BY date DESC").all(positionId);
    return rows.map(this.rowToDividend);
  }

  async createDividendEntry(entry: InsertDividendEntry): Promise<DividendEntry> {
    const stmt = this.db.prepare("INSERT INTO dividend_entries (position_id, amount, date, note) VALUES (?, ?, ?, ?)");
    const result = stmt.run(entry.positionId, entry.amount, entry.date, entry.note ?? null);
    // Update position total
    this.db.prepare("UPDATE positions SET total_dividends_received = total_dividends_received + ? WHERE id = ?")
      .run(entry.amount, entry.positionId);
    const row = this.db.prepare("SELECT * FROM dividend_entries WHERE id = ?").get(result.lastInsertRowid as number);
    return this.rowToDividend(row);
  }

  async deleteDividendEntry(id: number): Promise<boolean> {
    const entry = this.db.prepare("SELECT * FROM dividend_entries WHERE id = ?").get(id) as any;
    if (!entry) return false;
    this.db.prepare("UPDATE positions SET total_dividends_received = MAX(0, total_dividends_received - ?) WHERE id = ?")
      .run(entry.amount, entry.position_id);
    const result = this.db.prepare("DELETE FROM dividend_entries WHERE id = ?").run(id);
    return result.changes > 0;
  }

  async getQualityScore(positionId: number): Promise<QualityScore | undefined> {
    const row = this.db.prepare("SELECT * FROM quality_scores WHERE position_id = ?").get(positionId);
    return row ? this.rowToQuality(row) : undefined;
  }

  async upsertQualityScore(score: InsertQualityScore): Promise<QualityScore> {
    this.db.prepare(`
      INSERT INTO quality_scores (position_id, roic_above_15, margin_stable, low_debt, dividend_growth, moat, management_quality, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(position_id) DO UPDATE SET
        roic_above_15 = excluded.roic_above_15,
        margin_stable = excluded.margin_stable,
        low_debt = excluded.low_debt,
        dividend_growth = excluded.dividend_growth,
        moat = excluded.moat,
        management_quality = excluded.management_quality,
        updated_at = datetime('now')
    `).run(
      score.positionId,
      score.roicAbove15 ?? 0, score.marginStable ?? 0, score.lowDebt ?? 0,
      score.dividendGrowth ?? 0, score.moat ?? 0, score.managementQuality ?? 0
    );
    return (await this.getQualityScore(score.positionId))!;
  }
}

export const storage = new SQLiteStorage();
