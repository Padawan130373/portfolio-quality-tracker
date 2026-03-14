import { useQuery } from "@tanstack/react-query";
import { Position } from "@shared/schema";
import { formatPercent, formatCurrency } from "@/lib/utils";
import { ShieldCheck, ShieldAlert, ShieldX, Info } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface QualityCriterion {
  label: string;
  description: string;
  score: number; // 0-3
  detail: string;
}

interface PositionQuality {
  position: Position;
  criteria: QualityCriterion[];
  totalScore: number;
  maxScore: number;
  grade: "excellent" | "good" | "medium" | "poor";
}

function evaluateQuality(p: Position, quotes: Record<string, { price: number; changePercent: number; currency: string }>): PositionQuality {
  const quote = quotes[p.ticker];
  const currentPrice = quote?.price ?? p.pru;
  const plusValuePct = p.pru > 0 ? ((currentPrice - p.pru) / p.pru) * 100 : 0;

  const criteria: QualityCriterion[] = [
    {
      label: "Rendement dividende",
      description: "Rendement annuel des dividendes",
      score: p.dividendYield >= 4 ? 3 : p.dividendYield >= 2 ? 2 : p.dividendYield > 0 ? 1 : 0,
      detail: p.dividendYield > 0 ? `${p.dividendYield.toFixed(2)}%` : "Non renseigné",
    },
    {
      label: "Performance latente",
      description: "Plus-value latente sur prix d'achat",
      score: plusValuePct >= 20 ? 3 : plusValuePct >= 5 ? 2 : plusValuePct >= 0 ? 1 : 0,
      detail: `${plusValuePct >= 0 ? "+" : ""}${plusValuePct.toFixed(2)}%`,
    },
    {
      label: "Dividendes reçus",
      description: "Historique des dividendes encaissés",
      score: p.totalDividendsReceived >= 500 ? 3 : p.totalDividendsReceived >= 100 ? 2 : p.totalDividendsReceived > 0 ? 1 : 0,
      detail: formatCurrency(p.totalDividendsReceived),
    },
    {
      label: "Diversification sectorielle",
      description: "Secteur renseigné et hors 'Autre'",
      score: p.sector && p.sector !== "Autre" ? 2 : p.sector ? 1 : 0,
      detail: p.sector || "Non renseigné",
    },
    {
      label: "Diversification géographique",
      description: "Pays d'origine renseigné",
      score: p.country ? 2 : 0,
      detail: p.country || "Non renseigné",
    },
    {
      label: "Taille de position",
      description: "Valeur investie suffisante (> 500€)",
      score: p.quantity * p.pru >= 2000 ? 3 : p.quantity * p.pru >= 500 ? 2 : 1,
      detail: formatCurrency(p.quantity * p.pru),
    },
  ];

  const totalScore = criteria.reduce((s, c) => s + c.score, 0);
  const maxScore = criteria.length * 3;
  const ratio = totalScore / maxScore;
  const grade = ratio >= 0.8 ? "excellent" : ratio >= 0.6 ? "good" : ratio >= 0.4 ? "medium" : "poor";

  return { position: p, criteria, totalScore, maxScore, grade };
}

const gradeConfig = {
  excellent: { label: "Excellent", icon: ShieldCheck, className: "quality-excellent", bar: "bg-emerald-500" },
  good: { label: "Bon", icon: ShieldCheck, className: "quality-good", bar: "bg-blue-500" },
  medium: { label: "Moyen", icon: ShieldAlert, className: "quality-medium", bar: "bg-yellow-500" },
  poor: { label: "Faible", icon: ShieldX, className: "quality-poor", bar: "bg-red-500" },
};

const scoreColor = (score: number, max = 3) => {
  const r = score / max;
  if (r >= 0.9) return "bg-emerald-500";
  if (r >= 0.6) return "bg-blue-500";
  if (r >= 0.3) return "bg-yellow-500";
  return "bg-red-500";
};

export default function QualityCheck() {
  const { data: positions = [], isLoading } = useQuery<Position[]>({ queryKey: ["/api/positions"] });

  const tickers = positions.map(p => p.ticker).join(",");
  const { data: quotes = {} } = useQuery({
    queryKey: ["/api/quotes", tickers],
    queryFn: async () => {
      if (!tickers) return {};
      const res = await fetch(`/api/quotes?tickers=${tickers}`);
      return res.json();
    },
    enabled: tickers.length > 0,
  });

  const evaluations = positions.map(p => evaluateQuality(p, quotes as any));
  const avgScore = evaluations.length > 0
    ? evaluations.reduce((s, e) => s + e.totalScore / e.maxScore, 0) / evaluations.length
    : 0;

  if (isLoading) {
    return <div className="p-6 space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>;
  }

  if (!positions.length) {
    return (
      <div className="p-6 text-center">
        <ShieldCheck size={32} className="mx-auto mb-3 text-muted-foreground opacity-40" />
        <p className="text-muted-foreground">Aucune position à analyser.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Critères Quality</h1>
          <p className="text-sm text-muted-foreground">Score moyen du portefeuille : <span className="font-semibold text-primary">{(avgScore * 100).toFixed(0)}%</span></p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Info size={12} />
          Score basé sur 6 critères
        </div>
      </div>

      {/* Summary bar */}
      <div className="bg-card border border-border/60 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Score global</p>
          <span className="text-sm font-bold mono text-primary">{(avgScore * 100).toFixed(0)}%</span>
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${avgScore * 100}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {["excellent", "good", "medium", "poor"].map(g => {
            const count = evaluations.filter(e => e.grade === g).length;
            if (!count) return null;
            const cfg = gradeConfig[g as keyof typeof gradeConfig];
            return (
              <span key={g} className={`quality-badge ${cfg.className}`}>
                <cfg.icon size={10} />
                {count} {cfg.label}
              </span>
            );
          })}
        </div>
      </div>

      {/* Per-position cards */}
      <div className="space-y-3">
        {evaluations.sort((a, b) => b.totalScore - a.totalScore).map(({ position: p, criteria, totalScore, maxScore, grade }) => {
          const cfg = gradeConfig[grade];
          const ratio = totalScore / maxScore;
          return (
            <div key={p.id} className="bg-card border border-border/60 rounded-xl overflow-hidden" data-testid={`quality-card-${p.id}`}>
              {/* Header */}
              <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-bold mono text-primary text-sm">{p.ticker}</span>
                  <span className="text-xs text-muted-foreground truncate max-w-[140px]">{p.name}</span>
                  <Badge variant="outline" className="text-[10px]">{p.sector}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`quality-badge ${cfg.className}`}>
                    <cfg.icon size={10} />
                    {cfg.label}
                  </span>
                  <span className="text-xs font-bold mono">{totalScore}/{maxScore}</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="px-4 pt-2 pb-1">
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${cfg.bar}`} style={{ width: `${ratio * 100}%` }} />
                </div>
              </div>

              {/* Criteria grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-border/30 border-t border-border/30">
                {criteria.map((c, i) => (
                  <div key={i} className="bg-card px-3 py-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium text-muted-foreground truncate">{c.label}</p>
                      <div className="flex gap-0.5 ml-2 shrink-0">
                        {[0, 1, 2].map(dot => (
                          <div key={dot} className={`w-1.5 h-1.5 rounded-full ${dot < c.score ? scoreColor(c.score) : "bg-muted-foreground/20"}`} />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs mono font-semibold">{c.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
