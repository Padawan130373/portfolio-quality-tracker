import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Position, InsertPosition } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown } from "lucide-react";

const SECTORS = ["Technologie", "Finance", "Santé", "Énergie", "Consommation", "Industrie", "Immobilier", "Matériaux", "Services", "Telecom", "Autre"];

interface Quote { price: number; changePercent: number; currency: string; }
type QuotesMap = Record<string, Quote>;

const empty: Partial<InsertPosition> = { ticker: "", name: "", quantity: 0, pru: 0, sector: "Technologie", country: "", currency: "EUR", dividendYield: 0, notes: "" };

export default function Positions() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Position | null>(null);
  const [form, setForm] = useState<Partial<InsertPosition>>(empty);

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
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertPosition) => apiRequest("POST", "/api/positions", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/positions"] }); setOpen(false); toast({ title: "Position ajoutée" }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InsertPosition> }) => apiRequest("PUT", `/api/positions/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/positions"] }); setOpen(false); setEditing(null); toast({ title: "Position mise à jour" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/positions/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/positions"] }); toast({ title: "Position supprimée" }); },
  });

  function openAdd() { setForm(empty); setEditing(null); setOpen(true); }
  function openEdit(p: Position) { setForm({ ...p }); setEditing(p); setOpen(true); }

  function handleSave() {
    if (!form.ticker || !form.name || !form.quantity || !form.pru) {
      toast({ title: "Champs requis manquants", variant: "destructive" }); return;
    }
    if (editing) updateMutation.mutate({ id: editing.id, data: form as InsertPosition });
    else createMutation.mutate(form as InsertPosition);
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Portefeuille</h1>
          <p className="text-sm text-muted-foreground">{positions.length} position{positions.length !== 1 ? "s" : ""}</p>
        </div>
        <Button size="sm" onClick={openAdd} data-testid="button-add-position">
          <Plus size={14} className="mr-1.5" /> Ajouter
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
      ) : positions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <TrendingUp size={32} className="mx-auto mb-3 opacity-30" />
          <p>Aucune position. Cliquez sur Ajouter pour commencer.</p>
        </div>
      ) : (
        <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
          <table className="w-full text-sm data-table">
            <thead>
              <tr>
                <th>Ticker</th><th>Nom</th><th>Secteur</th><th>Qté</th>
                <th>PRU</th><th>Cours</th><th>Valeur</th><th>+/-</th><th>Rend.</th><th></th>
              </tr>
            </thead>
            <tbody>
              {positions.map(p => {
                const quote = quotes[p.ticker];
                const price = quote?.price ?? p.pru;
                const invested = p.quantity * p.pru;
                const value = p.quantity * price;
                const pv = value - invested;
                const pvPct = invested > 0 ? (pv / invested) * 100 : 0;
                return (
                  <tr key={p.id} data-testid={`row-position-${p.id}`}>
                    <td><span className="font-bold mono text-primary text-xs">{p.ticker}</span></td>
                    <td className="max-w-[160px] truncate text-foreground/80">{p.name}</td>
                    <td><Badge variant="outline" className="text-[10px]">{p.sector}</Badge></td>
                    <td className="mono">{p.quantity}</td>
                    <td className="mono">{formatCurrency(p.pru)}</td>
                    <td className="mono">
                      {formatCurrency(price)}
                      {quote && (
                        <span className={`ml-1 text-[10px] ${quote.changePercent >= 0 ? "gain" : "loss"}`}>
                          {quote.changePercent >= 0 ? "+" : ""}{quote.changePercent.toFixed(2)}%
                        </span>
                      )}
                    </td>
                    <td className="mono font-semibold">{formatCurrency(value)}</td>
                    <td>
                      <span className={`mono font-semibold text-xs ${pv >= 0 ? "gain" : "loss"}`}>
                        {pv >= 0 ? "+" : ""}{formatCurrency(pv)}
                      </span>
                      <br />
                      <span className={`text-[10px] ${pvPct >= 0 ? "gain" : "loss"}`}>
                        ({pvPct >= 0 ? "+" : ""}{formatPercent(pvPct)})
                      </span>
                    </td>
                    <td className="mono text-yellow-400">{p.dividendYield > 0 ? `${p.dividendYield.toFixed(2)}%` : "—"}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)} data-testid={`btn-edit-${p.id}`}>
                          <Pencil size={12} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate(p.id)} data-testid={`btn-delete-${p.id}`}>
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Modifier la position" : "Ajouter une position"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="space-y-1.5">
              <Label>Ticker *</Label>
              <Input placeholder="ex: AAPL" value={form.ticker ?? ""} onChange={e => setForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))} data-testid="input-ticker" />
            </div>
            <div className="space-y-1.5">
              <Label>Nom *</Label>
              <Input placeholder="ex: Apple Inc." value={form.name ?? ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} data-testid="input-name" />
            </div>
            <div className="space-y-1.5">
              <Label>Quantité *</Label>
              <Input type="number" placeholder="10" value={form.quantity ?? ""} onChange={e => setForm(f => ({ ...f, quantity: parseFloat(e.target.value) }))} data-testid="input-quantity" />
            </div>
            <div className="space-y-1.5">
              <Label>PRU (€) *</Label>
              <Input type="number" step="0.01" placeholder="150.00" value={form.pru ?? ""} onChange={e => setForm(f => ({ ...f, pru: parseFloat(e.target.value) }))} data-testid="input-pru" />
            </div>
            <div className="space-y-1.5">
              <Label>Secteur</Label>
              <Select value={form.sector ?? "Technologie"} onValueChange={v => setForm(f => ({ ...f, sector: v }))}>
                <SelectTrigger data-testid="select-sector"><SelectValue /></SelectTrigger>
                <SelectContent>{SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Pays</Label>
              <Input placeholder="ex: USA" value={form.country ?? ""} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} data-testid="input-country" />
            </div>
            <div className="space-y-1.5">
              <Label>Devise</Label>
              <Input placeholder="EUR" value={form.currency ?? "EUR"} onChange={e => setForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))} data-testid="input-currency" />
            </div>
            <div className="space-y-1.5">
              <Label>Rendement div. (%)</Label>
              <Input type="number" step="0.01" placeholder="2.50" value={form.dividendYield ?? ""} onChange={e => setForm(f => ({ ...f, dividendYield: parseFloat(e.target.value) || 0 }))} data-testid="input-dividend-yield" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Notes</Label>
              <Input placeholder="Notes optionnelles" value={form.notes ?? ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} data-testid="input-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setEditing(null); }}>Annuler</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-position">
              {editing ? "Mettre à jour" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
