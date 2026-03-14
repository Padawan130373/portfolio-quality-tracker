import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Position } from "@shared/schema";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { TrendingUp, TrendingDown, DollarSign, PieChart, Activity, Award } from "lucide-react";
import {
  ResponsiveContainer, PieChart as RechartsPie, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

const SECTOR_COLORS = [
  "#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899",
  "#06b6d4", "#f97316", "#84cc16", "#6366f1", "#14b8a6"
];

interface Quote {
  price: number;
  changePercent: number;
  currency: string;
}

type QuotesMap = Record<string, Quote>;

function KpiCard({ title, value, sub, icon: Icon, trend }: {
  title: string; value: string; sub?: string; icon: any; trend?: "up" | "down" | "neutral"
}) {
  return (
    <div className="kpi-card" data-testid={`kpi-${title.toLowerCase().replace(/\s/g, '-')}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
        <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
          <Icon size={14} className="text-primary" />
        </div>
      </div>
      <p className="text-xl font-bold mono mt-1" style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }}>
        {value}
      </p>
      {sub && (
        <p className={`text-xs font-medium mt-0.5 ${
          trend === "up" ? "gain" : trend === "down" ? "loss" : "text-muted-foreground"
        }`}>{sub}</p>
      )}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl text-sm">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="mono text-xs">
          {p.name}: {typeof p.value === "number" ? formatCurrency(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const { data: positions = [], isLoading } = useQuery<Position[]>({ queryKey: ["/api/positions"] });

  const tickers = positions.map(p => p.ticker).join(",");
  const { data: quotes = {} } = useQuery<QuotesMap>({
    queryKey: ["/api/quotes", tickers],
    queryFn: async () => {
      if (!tickers) return {};
      const res = await fetch(`/api/quotes?tickers=${tickers}`);
      return res.json();
    },
    enabled: tickers.length > 0,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const stats = useMemo(() => {
    if (!positions.length) return null;
    let totalInvested = 0;
    let totalCurrentValue = 0;
    let totalDividends = 0;

    positions.forEach(p => {
      const invested = p.quantity * p.pru;
      const quote = quotes[p.ticker];
      const currentPrice = quote?.price ?? p.pru;
      totalInvested += invested;
      totalCurrentValue += p.quantity * currentPrice;
      totalDividends += p.totalDividendsReceived;
    });

    const plusValue = totalCurrentValue - totalInvested;
    const plusValuePercent = totalInvested > 0 ? (plusValue / totalInvested) * 100 : 0;
    const totalReturn = plusValue + totalDividends;
    const totalReturnPercent = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;

    return { totalInvested, totalCurrentValue, plusValue, plusValuePercent, totalDividends, totalReturn, totalReturnPercent };
  }, [positions, quotes]);

  // Sector allocation data
  const sectorData = useMemo(() => {
    const map: Record<string, number> = {};
    positions.forEach(p => {
      const quote = quotes[p.ticker];
      const val = p.quantity * (quote?.price ?? p.pru);
      map[p.sector] = (map[p.sector] || 0) + val;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [positions, quotes]);

  // Position performance data
  const performanceData = useMemo(() => {
    return positions.map(p => {
      const quote = quotes[p.ticker];
      const currentPrice = quote?.price ?? p.pru;
      const invested = p.quantity * p.pru;
      const currentValue = p.quantity * currentPrice;
      const pv = currentValue - invested;
      return {
        name: p.ticker,
        invested,
        currentValue,
        plusValue: pv,
        dividends: p.totalDividendsReceived,
      };
    }).sort((a, b) => b.currentValue - a.currentValue).slice(0, 10);
  }, [positions, quotes]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  if (!positions.length) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full text-center gap-3">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-2">
          <PieChart size={28} className="text-primary" />
        </div>
        <h2 className="text-lg font-bold">Aucune action en portefeuille</h2>
        <p className="text-muted-foreground text-sm max-w-xs">Ajoutez vos premières positions dans l'onglet Portefeuille pour commencer le suivi.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Tableau de bord</h1>
          <p className="text-sm text-muted-foreground">{positions.length} position{positions.length > 1 ? "s" : ""} · Mis à jour en temps réel</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-full">
          <Activity size={12} className="text-primary animate-pulse" />
          Live
        </div>
      </div>

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            title="Valeur portefeuille"
            value={formatCurrency(stats.totalCurrentValue)}
            sub={`Investi: ${formatCurrency(stats.totalInvested)}`}
            icon={TrendingUp}
            trend="neutral"
          />
          <KpiCard
            title="Plus-value latente"
            value={formatCurrency(stats.plusValue)}
            sub={`${stats.plusValuePercent >= 0 ? "+" : ""}${formatPercent(stats.plusValuePercent)}`}
            icon={stats.plusValue >= 0 ? TrendingUp : TrendingDown}
            trend={stats.plusValue >= 0 ? "up" : "down"}
          />
          <KpiCard
            title="Dividendes reçus"
            value={formatCurrency(stats.totalDividends)}
            sub="Total historique"
            icon={DollarSign}
            trend="up"
          />
          <KpiCard
            title="Retour total"
            value={formatCurrency(stats.totalReturn)}
            sub={`${stats.totalReturnPercent >= 0 ? "+" : ""}${formatPercent(stats.totalReturnPercent)}`}
            icon={Award}
            trend={stats.totalReturn >= 0 ? "up" : "down"}
          />
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Sector Allocation */}
        <div className="bg-card border border-border/60 rounded-xl p-4">
          <p className="text-sm font-semibold mb-4" style={{ fontFamily: "var(--font-display)" }}>Répartition par secteur</p>
          <ResponsiveContainer width="100%" height={260}>
            <RechartsPie>
              <Pie
                data={sectorData}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={100}
                paddingAngle={3}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {sectorData.map((_, i) => (
                  <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: any) => formatCurrency(v)} contentStyle={{ background: "hsl(222 40% 10%)", border: "1px solid hsl(222 32% 18%)", borderRadius: 8 }} />
            </RechartsPie>
          </ResponsiveContainer>
        </div>

        {/* Performance by position */}
        <div className="bg-card border border-border/60 rounded-xl p-4">
          <p className="text-sm font-semibold mb-4" style={{ fontFamily: "var(--font-display)" }}>Performance par position (top 10)</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={performanceData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 32% 18%)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(215 20% 55%)" }} />
              <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: "hsl(215 20% 55%)" }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="invested" name="Investi" fill="hsl(222 32% 28%)" radius={[2, 2, 0, 0]} />
              <Bar dataKey="currentValue" name="Valeur actuelle" fill="hsl(158 64% 42%)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Plus-values per position */}
      <div className="bg-card border border-border/60 rounded-xl p-4">
        <p className="text-sm font-semibold mb-4" style={{ fontFamily: "var(--font-display)" }}>Plus-values + dividendes par position</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={performanceData} layout="vertical" barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 32% 18%)" horizontal={false} />
            <XAxis type="number" tickFormatter={v => formatCurrency(v)} tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(215 20% 55%)" }} width={48} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="plusValue" name="Plus-value" stackId="a" fill="hsl(158 64% 42%)" radius={[0, 2, 2, 0]} />
            <Bar dataKey="dividends" name="Dividendes" stackId="a" fill="hsl(43 96% 56%)" radius={[0, 2, 2, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
