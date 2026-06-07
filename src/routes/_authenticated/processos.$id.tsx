import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RefreshCw, Trash2, CircleDot } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { consultarProcessoCNJ } from "@/lib/cnj.functions";

export const Route = createFileRoute("/_authenticated/processos/$id")({
  component: CaseDetail,
});

function CaseDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const consultar = useServerFn(consultarProcessoCNJ);

  const { data, isLoading } = useQuery({
    queryKey: ["case", id],
    queryFn: async () => {
      const [c, m] = await Promise.all([
        supabase.from("cases").select("*, clients(id, name)").eq("id", id).single(),
        supabase.from("case_movements").select("*").eq("case_id", id).order("movement_date", { ascending: false }),
      ]);
      if (c.error) throw c.error;
      // Marca como vistas
      await supabase.from("case_movements").update({ is_new: false }).eq("case_id", id).eq("is_new", true);
      return { case: c.data, movements: m.data ?? [] };
    },
  });

  const refreshMut = useMutation({
    mutationFn: async () => {
      if (!data?.case.cnj_number) throw new Error("Sem número CNJ para consultar.");
      const r = await consultar({ data: { cnjNumber: data.case.cnj_number, caseId: id } });
      const { data: u } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("users_profile").select("organization_id").eq("user_id", u.user!.id).single();
      const existing = new Set((data.movements ?? []).map((m) => `${m.movement_date}|${m.description}`));
      const newOnes = r.movements.filter((m) => !existing.has(`${m.movement_date}|${m.description}`));
      if (newOnes.length > 0) {
        await supabase.from("case_movements").insert(
          newOnes.map((m) => ({
            organization_id: profile!.organization_id,
            case_id: id,
            movement_date: m.movement_date,
            description: m.description,
            source: r.source,
            external_id: m.external_id ?? null,
            is_new: true,
          })),
        );
      }
      await supabase.from("cases").update({ last_cnj_sync_at: new Date().toISOString() }).eq("id", id);
      return { added: newOnes.length, source: r.source };
    },
    onSuccess: (r) => {
      toast.success(r.added > 0 ? `${r.added} nova(s) movimentação(ões).` : "Sem novas movimentações.");
      queryClient.invalidateQueries({ queryKey: ["case", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleDelete() {
    if (!confirm("Excluir este processo?")) return;
    const { error } = await supabase.from("cases").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Processo removido.");
    navigate({ to: "/processos" });
  }

  if (isLoading) return <div className="text-sm text-muted-foreground">Carregando…</div>;
  const c = data!.case;
  const client = (c as { clients?: { id: string; name: string } | null }).clients;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <Link to="/processos" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="font-mono text-base">{c.cnj_number ?? "Sem número CNJ"}</CardTitle>
            {c.title && <p className="text-sm text-muted-foreground mt-1">{c.title}</p>}
          </div>
          <div className="flex gap-2">
            {c.cnj_number && (
              <Button size="sm" variant="outline" onClick={() => refreshMut.mutate()} disabled={refreshMut.isPending}>
                <RefreshCw className={`h-4 w-4 mr-1 ${refreshMut.isPending ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={handleDelete}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div><dt className="text-muted-foreground text-xs">Cliente</dt><dd>{client ? <Link to="/clientes/$id" params={{ id: client.id }} className="text-primary hover:underline">{client.name}</Link> : "—"}</dd></div>
            <div><dt className="text-muted-foreground text-xs">Parte contrária</dt><dd>{c.opposing_party ?? "—"}</dd></div>
            <div><dt className="text-muted-foreground text-xs">Tribunal</dt><dd>{c.court ?? "—"}</dd></div>
            <div><dt className="text-muted-foreground text-xs">Vara / Órgão</dt><dd>{c.judicial_body ?? "—"}</dd></div>
            <div><dt className="text-muted-foreground text-xs">Classe</dt><dd>{c.case_class ?? "—"}</dd></div>
            <div><dt className="text-muted-foreground text-xs">Assunto</dt><dd>{c.subject ?? "—"}</dd></div>
            <div><dt className="text-muted-foreground text-xs">Status</dt><dd><Badge variant="outline">{c.status}</Badge></dd></div>
            <div><dt className="text-muted-foreground text-xs">Valor da causa</dt><dd>{c.claim_value ? `R$ ${Number(c.claim_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}</dd></div>
            <div><dt className="text-muted-foreground text-xs">Distribuição</dt><dd>{c.distribution_date ? format(new Date(c.distribution_date), "dd/MM/yyyy") : "—"}</dd></div>
            <div><dt className="text-muted-foreground text-xs">Última sincronização CNJ</dt><dd>{c.last_cnj_sync_at ? format(new Date(c.last_cnj_sync_at), "dd/MM/yyyy HH:mm") : "Nunca"}</dd></div>
          </dl>
          {c.notes && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-muted-foreground mb-1">Observações</p>
              <p className="text-sm whitespace-pre-wrap">{c.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Movimentações</CardTitle></CardHeader>
        <CardContent>
          {data!.movements.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma movimentação registrada. {c.cnj_number && "Clique em \"Atualizar\" para buscar no CNJ."}
            </p>
          ) : (
            <ol className="relative border-l border-border ml-2 space-y-4">
              {data!.movements.map((m) => (
                <li key={m.id} className="ml-4">
                  <span className="absolute -left-[7px] mt-1.5 flex">
                    <CircleDot className={`h-3.5 w-3.5 ${m.is_new ? "text-warning" : "text-muted-foreground"}`} />
                  </span>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{m.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(m.movement_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        {m.source !== "manual" && ` · ${m.source}`}
                      </p>
                    </div>
                    {m.is_new && <Badge variant="outline" className="bg-warning/15 text-warning border-warning/30 text-[10px]">NOVO</Badge>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
