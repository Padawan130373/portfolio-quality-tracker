import type { Express } from "express";
import { Server } from "http";
import { storage } from "./storage";
import { insertPositionSchema, insertDividendEntrySchema, insertQualityScoreSchema } from "@shared/schema";
import { z } from "zod";
import axios from "axios";

const FINANCE_BASE = "https://financialmodelingprep.com/api/v3";

async function fetchQuote(ticker: string) {
  try {
    // Use Yahoo Finance via allorigins proxy to avoid API key requirements
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`;
    const res = await axios.get(url, { timeout: 5000 });
    const result = res.data?.chart?.result?.[0];
    if (!result) return null;
    const meta = result.meta;
    return {
      ticker,
      price: meta.regularMarketPrice ?? null,
      previousClose: meta.chartPreviousClose ?? meta.previousClose ?? null,
      currency: meta.currency ?? "USD",
      longName: meta.longName ?? meta.shortName ?? ticker,
      change: meta.regularMarketPrice && meta.chartPreviousClose
        ? meta.regularMarketPrice - meta.chartPreviousClose
        : null,
      changePercent: meta.regularMarketPrice && meta.chartPreviousClose
        ? ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100
        : null,
    };
  } catch {
    return null;
  }
}

export async function registerRoutes(httpServer: Server, app: Express) {
  // ---- POSITIONS ----
  app.get("/api/positions", async (_req, res) => {
    const positions = await storage.getPositions();
    res.json(positions);
  });

  app.post("/api/positions", async (req, res) => {
    const parsed = insertPositionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
    const pos = await storage.createPosition(parsed.data);
    res.status(201).json(pos);
  });

  app.patch("/api/positions/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const partial = insertPositionSchema.partial().safeParse(req.body);
    if (!partial.success) return res.status(400).json({ error: partial.error.issues });
    const updated = await storage.updatePosition(id, partial.data);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  });

  app.delete("/api/positions/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const ok = await storage.deletePosition(id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.status(204).send();
  });

  // ---- DIVIDENDS ----
  app.get("/api/positions/:id/dividends", async (req, res) => {
    const id = parseInt(req.params.id);
    const entries = await storage.getDividendEntries(id);
    res.json(entries);
  });

  app.post("/api/positions/:id/dividends", async (req, res) => {
    const positionId = parseInt(req.params.id);
    const parsed = insertDividendEntrySchema.safeParse({ ...req.body, positionId });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
    const entry = await storage.createDividendEntry(parsed.data);
    res.status(201).json(entry);
  });

  app.delete("/api/dividends/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const ok = await storage.deleteDividendEntry(id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.status(204).send();
  });

  // ---- QUALITY SCORES ----
  app.get("/api/positions/:id/quality", async (req, res) => {
    const id = parseInt(req.params.id);
    const score = await storage.getQualityScore(id);
    res.json(score ?? null);
  });

  app.post("/api/positions/:id/quality", async (req, res) => {
    const positionId = parseInt(req.params.id);
    const parsed = insertQualityScoreSchema.safeParse({ ...req.body, positionId });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
    const score = await storage.upsertQualityScore(parsed.data);
    res.json(score);
  });

  // ---- MARKET DATA (live quotes) ----
  app.get("/api/quote/:ticker", async (req, res) => {
    const { ticker } = req.params;
    const quote = await fetchQuote(ticker.toUpperCase());
    if (!quote) return res.status(404).json({ error: "Quote unavailable" });
    res.json(quote);
  });

  // Batch quotes for all positions
  app.get("/api/quotes", async (req, res) => {
    const tickers = String(req.query.tickers || "").split(",").filter(Boolean);
    if (!tickers.length) return res.json({});
    const results = await Promise.all(tickers.map(t => fetchQuote(t)));
    const map: Record<string, any> = {};
    results.forEach((q, i) => { if (q) map[tickers[i]] = q; });
    res.json(map);
  });
}
