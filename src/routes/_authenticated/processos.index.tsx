import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Briefcase, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { consultarProcessosLote } from "@/lib/cnj.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/processos/")({
  component: CasesList,
});

const statusColors: Record<string, string> = {
  ativo: "bg-success/15 text-success border-success/30",
  arquivado: "bg-muted text-muted-foreground border-border",
  suspenso: "bg-warning/15 text-warning border-warning/30",
  encerrado: "bg-muted text-muted-foreground border-border",
};

function CasesList() {
  const qc = useQueryClient();
  const sync = useServerFn(consultarProcessosLote);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["cases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("id, cnj_number, title, court, status, opposing_party, clients(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const items = data ?? [];
  const eligible = items.filter((c) => c.cnj_number);
  const allSelected = eligible.length > 0 && eligible.every((c) => selected.has(c.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(eligible.map((c) => c.id)));
  }

  async function runBulk(ids: string[]) {
    if (ids.length === 0) {
      toast.info("Nenhum processo com número CNJ selecionado.");
      return;
    }
    setBulkRunning(true);
    const toastId = toast.loading(`Sincronizando ${ids.length} processo(s)…`);
    try {
      const r = await sync({ data: { caseIds: ids } });
      toast.success(
        `${r.success}/${r.total} sincronizado(s) · ${r.newMovements} novas movimentação(ões)` +
          (r.failed.length > 0 ? ` · ${r.failed.length} falha(s)` : ""),
        { id: toastId },
      );
      qc.invalidateQueries({ queryKey: ["cases"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setSelected(new Set());
    } catch (e) {
      toast.error((e as Error).message, { id: toastId });
    } finally {
      setBulkRunning(false);
    }
  }

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Processos</h1>
          <p className="text-sm text-muted-foreground">Acompanhe seus processos e movimentações</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={bulkRunning || eligible.length === 0}
            onClick={() => runBulk(eligible.filter((c) => c.status === "ativo").map((c) => c.id))}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${bulkRunning ? "animate-spin" : ""}`} />
            Atualizar todos os ativos
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={bulkRunning || selected.size === 0}
            onClick={() => runBulk(Array.from(selected))}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${bulkRunning ? "animate-spin" : ""}`} />
            Atualizar selecionados ({selected.size})
          </Button>
          <Button asChild><Link to="/processos/novo"><Plus className="h-4 w-4 mr-1" />Novo processo</Link></Button>
        </div>
      </div>

      <Card>
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Carregando…</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Nenhum processo cadastrado.
            <div className="mt-3"><Button asChild size="sm"><Link to="/processos/novo">Cadastrar primeiro processo</Link></Button></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 w-8">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Selecionar todos" />
                  </th>
                  <th className="px-4 py-2 font-medium">Número CNJ</th>
                  <th className="px-4 py-2 font-medium">Cliente</th>
                  <th className="px-4 py-2 font-medium">Parte contrária</th>
                  <th className="px-4 py-2 font-medium">Tribunal</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => {
                  const client = (c as { clients?: { name?: string } | null }).clients;
                  const canSelect = !!c.cnj_number;
                  return (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-3">
                        <Checkbox
                          checked={selected.has(c.id)}
                          disabled={!canSelect}
                          onCheckedChange={() => toggle(c.id)}
                          aria-label="Selecionar"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Link to="/processos/$id" params={{ id: c.id }} className="text-primary hover:underline font-medium">
                          {c.cnj_number ?? "Sem número"}
                        </Link>
                        {c.title && <p className="text-xs text-muted-foreground">{c.title}</p>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{client?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.opposing_party ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.court ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={statusColors[c.status] ?? ""}>{c.status}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
