import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Briefcase, Calendar, AlertCircle, Plus, Search, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function StatCard({ icon: Icon, label, value, hint }: {
  icon: typeof Users; label: string; value: string | number; hint?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold mt-1">{value}</p>
            {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
          </div>
          <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [cases, clients, movements, tasks, recentMovements] = await Promise.all([
        supabase.from("cases").select("id, status", { count: "exact" }).eq("status", "ativo"),
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("case_movements").select("id", { count: "exact", head: true }).eq("is_new", true),
        supabase.from("tasks").select("id, status", { count: "exact" }).in("status", ["pendente", "em_andamento", "atrasada"]),
        supabase.from("case_movements")
          .select("id, description, movement_date, source, case_id, cases(cnj_number, title)")
          .order("movement_date", { ascending: false })
          .limit(8),
      ]);
      return {
        activeCases: cases.count ?? 0,
        clients: clients.count ?? 0,
        newMovements: movements.count ?? 0,
        pendingTasks: tasks.count ?? 0,
        recent: (recentMovements.data ?? []) as Array<{
          id: string; description: string; movement_date: string; source: string;
          case_id: string; cases: { cnj_number: string | null; title: string | null } | null;
        }>,
      };
    },
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral do escritório</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm"><Link to="/clientes/novo"><Plus className="h-4 w-4 mr-1" />Cliente</Link></Button>
          <Button asChild variant="outline" size="sm"><Link to="/processos/novo"><Plus className="h-4 w-4 mr-1" />Processo</Link></Button>
          <Button asChild size="sm"><Link to="/processos/novo"><Search className="h-4 w-4 mr-1" />Consultar CNJ</Link></Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Briefcase} label="Processos ativos" value={isLoading ? "…" : data!.activeCases} />
        <StatCard icon={AlertCircle} label="Movimentações novas" value={isLoading ? "…" : data!.newMovements} hint="desde a última visualização" />
        <StatCard icon={Calendar} label="Tarefas pendentes" value={isLoading ? "…" : data!.pendingTasks} />
        <StatCard icon={Users} label="Clientes" value={isLoading ? "…" : data!.clients} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimos andamentos</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : data!.recent.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
              Nenhuma movimentação ainda. Cadastre um processo e consulte o CNJ para começar.
            </div>
          ) : (
            <ul className="divide-y">
              {data!.recent.map((m) => (
                <li key={m.id} className="py-3 flex items-start gap-3">
                  <div className="h-2 w-2 rounded-full bg-primary mt-2" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.cases?.cnj_number ?? "Processo"} ·{" "}
                      {formatDistanceToNow(new Date(m.movement_date), { addSuffix: true, locale: ptBR })}
                      {m.source === "mock" && " · simulado"}
                    </p>
                  </div>
                  <Link
                    to="/processos/$id"
                    params={{ id: m.case_id }}
                    className="text-xs text-primary hover:underline shrink-0"
                  >
                    Ver
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
