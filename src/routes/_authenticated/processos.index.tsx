import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Briefcase } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Processos</h1>
          <p className="text-sm text-muted-foreground">Acompanhe seus processos e movimentações</p>
        </div>
        <Button asChild><Link to="/processos/novo"><Plus className="h-4 w-4 mr-1" />Novo processo</Link></Button>
      </div>

      <Card>
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Carregando…</div>
        ) : !data || data.length === 0 ? (
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
                  <th className="px-4 py-2 font-medium">Número CNJ</th>
                  <th className="px-4 py-2 font-medium">Cliente</th>
                  <th className="px-4 py-2 font-medium">Parte contrária</th>
                  <th className="px-4 py-2 font-medium">Tribunal</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.map((c) => {
                  const client = (c as { clients?: { name?: string } | null }).clients;
                  return (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
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
