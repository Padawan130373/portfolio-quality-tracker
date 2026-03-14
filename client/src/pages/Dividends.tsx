import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Position, DividendEntry } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { Plus, Trash2, DollarSign } from "lucide-react";

function useDividends(positionId: number | null) {
  return useQuery<DividendEntry[]>({
    queryKey: ["/api/positions", positionId, "dividends"],
    queryFn: async () => {
      if (!positionId) return [];
      const res = await fetch(`/api/positions/${positionId}/dividends`);
      return res.json();
    },
    enabled: positionId !== null,
  });
}

export default function Dividends() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedPosId, setSelectedPosId] = useState<number | null>(null);
  const [form, setForm] = useState({ positionId: "", amount: "", date: new Date().toISOString().split("T")[0], note: "" });

  const { data: positions = [] } = useQuery<Position[]>({ queryKey: ["/api/positions"] });
  const { data: entries = [], isLoading } = useDividends(selectedPosId);

  const createMutation = useMutation({
    mutationFn: (data: { amount: number; date: string; note: string }) =>
      apiRequest("POST", `/api/positions/${form.positionId}/dividends`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/positions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/positions", selectedPosId, "dividends"] });
      setOpen(false);
      toast({ title: "Dividende ajouté" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/dividends/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/positions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/positions", selectedPosId, "dividends"] });
      toast({ title: "Dividende supprimé" });
    },
  });

  function handleSave() {
    if (!form.positionId || !form.amount || !form.date) {
      toast({ title: "Champs requis", variant: "destructive" }); return;
    }
    createMutation.mutate({ amount: parseFloat(form.amount), date: form.date, note: form.note });
  }

  // Aggregate dividends by year for chart
  const allDividendsByYear = positions.reduce((acc, p) => {
    // We can only show from total; per-entry chart only for selected
    return acc;
  }, {} as Record<string, number>);

  // Chart data from selected position's entries
  const chartData = entries.reduce((acc, e) => {
    const year = e.date.slice(0, 4);
    acc[year] = (acc[year] || 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);
  const chartArr = Object.entries(chartData).map(([year, amount]) => ({ year, amount })).sort((a, b) => a.year.localeCompare(b.year));

  const totalAllDividends = positions.reduce((acc, p) => acc + p.totalDividendsReceived, 0);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Dividendes</h1>
          <p className="text-sm text-muted-foreground">Total reçu : <span className="font-semibold text-yellow-400 mono">{formatCurrency(totalAllDividends)}</span></p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)} data-testid="button-add-dividend">
          <Plus size={14} className="mr-1.5" /> Ajouter un dividende
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {positions.filter(p => p.totalDividendsReceived > 0).sort((a, b) => b.totalDividendsReceived - a.totalDividendsReceived).slice(0, 4).map(p => (
          <div key={p.id} className="bg-card border border-border/60 rounded-xl p-3 cursor-pointer hover:border-primary/40 transition-colors"
            onClick={() => setSelectedPosId(selectedPosId === p.id ? null : p.id)}
            data-testid={`card-dividend-${p.id}`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold mono text-primary">{p.ticker}</span>
              <DollarSign size={12} className="text-yellow-400" />
            </div>
            <p className="text-base font-bold mono text-yellow-400">{formatCurrency(p.totalDividendsReceived)}</p>
            <p className="text-xs text-muted-foreground truncate">{p.name}</p>
          </div>
        ))}
      </div>

      {/* Select position filter */}
      <div className="flex items-center gap-3">
        <Label className="text-sm text-muted-foreground whitespace-nowrap">Filtrer par position :</Label>
        <Select value={selectedPosId ? String(selectedPosId) : ""} onValueChange={v => setSelectedPosId(v ? parseInt(v) : null)}>
          <SelectTrigger className="w-64" data-testid="select-filter-position">
            <SelectValue placeholder="Toutes les positions" />
          </SelectTrigger>
          <SelectContent>
            {positions.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.ticker} — {p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {selectedPosId && <Button variant="ghost" size="sm" className="text-xs" onClick={() => setSelectedPosId(null)}>Tout afficher</Button>}
      </div>

      {/* Chart per selected position */}
      {selectedPosId && chartArr.length > 0 && (
        <div className="bg-card border border-border/60 rounded-xl p-4">
          <p className="text-sm font-semibold mb-3" style={{ fontFamily: "var(--font-display)" }}>
            Dividendes annuels — {positions.find(p => p.id === selectedPosId)?.ticker}
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartArr}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 32% 18%)" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: "hsl(215 20% 55%)" }} />
              <YAxis tickFormatter={v => `${v}€`} tick={{ fontSize: 11, fill: "hsl(215 20% 55%)" }} />
              <Tooltip formatter={(v: any) => formatCurrency(v)} contentStyle={{ background: "hsl(222 40% 10%)", border: "1px solid hsl(222 32% 18%)", borderRadius: 8 }} />
              <Bar dataKey="amount" name="Dividendes" fill="hsl(43 96% 56%)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Entries table */}
      {selectedPosId && (
        <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border/60">
            <p className="text-sm font-semibold" style={{ fontFamily: "var(--font-display)" }}>
              Historique — {positions.find(p => p.id === selectedPosId)?.ticker}
            </p>
          </div>
          {isLoading ? (
            <div className="p-4 space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">Aucun dividende enregistré.</p>
          ) : (
            <table className="w-full text-sm data-table">
              <thead><tr><th>Date</th><th>Montant</th><th>Note</th><th></th></tr></thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id}>
                    <td className="mono text-muted-foreground">{e.date}</td>
                    <td className="font-semibold mono text-yellow-400">{formatCurrency(e.amount)}</td>
                    <td className="text-muted-foreground">{e.note || "—"}</td>
                    <td>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteMutation.mutate(e.id)} data-testid={`btn-delete-dividend-${e.id}`}>
                        <Trash2 size={13} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Add dividend dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Ajouter un dividende</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Position</Label>
              <Select value={form.positionId} onValueChange={v => setForm(f => ({ ...f, positionId: v }))}>
                <SelectTrigger><SelectValue placeholder="Choisir une position" /></SelectTrigger>
                <SelectContent>
                  {positions.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.ticker} — {p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Montant (€)</Label>
                <Input type="number" step="0.01" placeholder="25.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} data-testid="input-dividend-amount" />
              </div>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} data-testid="input-dividend-date" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Note (optionnel)</Label>
              <Input placeholder="ex: Q2 2024" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} data-testid="input-dividend-note" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending} data-testid="button-save-dividend">Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
