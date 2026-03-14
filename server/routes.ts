import { type Express } from "express";
import { createServer } from "http";
import { db } from "./storage";
import { positions, dividendEntries } from "@shared/schema";
import { eq } from "drizzle-orm";

// Yahoo Finance quote fetcher
async function fetchQuote(ticker: string): Promise<{ price: number; changePercent: number; currency: string } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    return {
      price: meta.regularMarketPrice ?? meta.previousClose ?? 0,
      changePercent: ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100,
      currency: meta.currency ?? "EUR",
    };
  } catch {
    return null;
  }
}

const quoteCache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 60_000; // 1 min

export async function registerRoutes(app: Express) {
  // GET all positions
  app.get("/api/positions", async (_req, res) => {
    const rows = await db.select().from(positions).all();
    res.json(rows);
  });

  // POST create position
  app.post("/api/positions", async (req, res) => {
    const row = await db.insert(positions).values(req.body).returning().get();
    res.status(201).json(row);
  });

  // PUT update position
  app.put("/api/positions/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const row = await db.update(positions).set(req.body).where(eq(positions.id, id)).returning().get();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  });

  // DELETE position
  app.delete("/api/positions/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    await db.delete(positions).where(eq(positions.id, id));
    res.status(204).end();
  });

  // GET dividends for a position
  app.get("/api/positions/:id/dividends", async (req, res) => {
    const id = parseInt(req.params.id);
    const rows = await db.select().from(dividendEntries).where(eq(dividendEntries.positionId, id)).all();
    res.json(rows);
  });

  // POST add dividend entry
  app.post("/api/positions/:id/dividends", async (req, res) => {
    const positionId = parseInt(req.params.id);
    const entry = await db.insert(dividendEntries).values({ ...req.body, positionId }).returning().get();
    // Update total on position
    const allEntries = await db.select().from(dividendEntries).where(eq(dividendEntries.positionId, positionId)).all();
    const total = allEntries.reduce((s, e) => s + e.amount, 0);
    await db.update(positions).set({ totalDividendsReceived: total }).where(eq(positions.id, positionId));
    res.status(201).json(entry);
  });

  // DELETE dividend entry
  app.delete("/api/dividends/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const entry = await db.select().from(dividendEntries).where(eq(dividendEntries.id, id)).get();
    if (!entry) return res.status(404).json({ error: "Not found" });
    await db.delete(dividendEntries).where(eq(dividendEntries.id, id));
    // Update total
    const allEntries = await db.select().from(dividendEntries).where(eq(dividendEntries.positionId, entry.positionId)).all();
    const total = allEntries.reduce((s, e) => s + e.amount, 0);
    await db.update(positions).set({ totalDividendsReceived: total }).where(eq(positions.id, entry.positionId));
    res.status(204).end();
  });

  // GET live quotes
  app.get("/api/quotes", async (req, res) => {
    const tickers = ((req.query.tickers as string) || "").split(",").filter(Boolean);
    if (!tickers.length) return res.json({});
    const result: Record<string, any> = {};
    await Promise.all(tickers.map(async (ticker) => {
      const cached = quoteCache.get(ticker);
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        result[ticker] = cached.data;
        return;
      }
      const data = await fetchQuote(ticker);
      if (data) {
        quoteCache.set(ticker, { data, ts: Date.now() });
        result[ticker] = data;
      }
    }));
    res.json(result);
  });

  return createServer(app);
}
