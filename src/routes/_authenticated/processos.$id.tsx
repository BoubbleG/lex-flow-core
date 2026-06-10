import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, RefreshCw, Trash2, CircleDot, Users2, Scale } from "lucide-react";
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
      const [c, m, p, l] = await Promise.all([
        supabase.from("cases").select("*, clients(id, name)").eq("id", id).single(),
        supabase.from("case_movements").select("*").eq("case_id", id).order("movement_date", { ascending: false }),
        supabase.from("case_parties").select("*").eq("case_id", id).order("role"),
        supabase.from("case_lawyers").select("*").eq("case_id", id),
      ]);
      if (c.error) throw c.error;
      await supabase.from("case_movements").update({ is_new: false }).eq("case_id", id).eq("is_new", true);
      return {
        case: c.data,
        movements: m.data ?? [],
        parties: p.data ?? [],
        lawyers: l.data ?? [],
      };
    },
  });

  const refreshMut = useMutation({
    mutationFn: async () => {
      if (!data?.case.cnj_number) throw new Error("Sem número CNJ para consultar.");
      return consultar({ data: { cnjNumber: data.case.cnj_number, caseId: id } });
    },
    onSuccess: (r) => {
      toast.success(
        r.source === "datajud"
          ? "Atualizado com dados do DataJud."
          : "Sem dados oficiais — usando dados simulados.",
      );
      queryClient.invalidateQueries({ queryKey: ["case", id] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
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
  const lawyersByParty = (data!.lawyers as Array<{ id: string; party_id: string | null; name: string; oab: string | null }>)
    .reduce<Record<string, Array<{ id: string; name: string; oab: string | null }>>>((acc, l) => {
      const k = l.party_id ?? "_none";
      (acc[k] ||= []).push(l);
      return acc;
    }, {});
  const hasRealData = (data!.movements as Array<{ source: string }>).some((m) => m.source === "datajud");

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <Link to="/processos" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="font-mono text-base">{c.cnj_number ?? "Sem número CNJ"}</CardTitle>
              {c.cnj_number && (
                <Badge
                  variant="outline"
                  className={
                    hasRealData
                      ? "bg-success/15 text-success border-success/30 text-[10px]"
                      : "bg-warning/15 text-warning border-warning/30 text-[10px]"
                  }
                >
                  {hasRealData ? "Fonte: DataJud" : "Fonte: simulado"}
                </Badge>
              )}
            </div>
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

      <Tabs defaultValue="movimentos">
        <TabsList>
          <TabsTrigger value="movimentos">Movimentações ({data!.movements.length})</TabsTrigger>
          <TabsTrigger value="partes">Partes & Advogados ({data!.parties.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="movimentos">
          <Card>
            <CardContent className="pt-6">
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
        </TabsContent>

        <TabsContent value="partes">
          <Card>
            <CardContent className="pt-6">
              {data!.parties.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma parte cadastrada. {c.cnj_number && "Clique em \"Atualizar\" para buscar no CNJ."}
                </p>
              ) : (
                <ul className="space-y-4">
                  {(data!.parties as Array<{
                    id: string; role: string; name: string; document: string | null; person_type: string | null;
                  }>).map((p) => {
                    const advs = lawyersByParty[p.id] ?? [];
                    const roleLabel =
                      p.role === "ativo" ? "Polo ativo" :
                      p.role === "passivo" ? "Polo passivo" : "Outro";
                    return (
                      <li key={p.id} className="border rounded-md p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2">
                            <Users2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">{p.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {p.person_type === "fisica" ? "Pessoa física" :
                                 p.person_type === "juridica" ? "Pessoa jurídica" : "—"}
                                {p.document && ` · ${p.document}`}
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[10px]">{roleLabel}</Badge>
                        </div>
                        {advs.length > 0 && (
                          <div className="mt-3 pt-3 border-t space-y-1">
                            <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Advogados</p>
                            {advs.map((a) => (
                              <div key={a.id} className="flex items-center gap-2 text-sm">
                                <Scale className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>{a.name}</span>
                                {a.oab && <span className="text-xs text-muted-foreground">· {a.oab}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
