import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { consultarProcessoCNJ } from "@/lib/cnj.functions";
import { formatCNJ, isValidCNJ } from "@/lib/cnj";

export const Route = createFileRoute("/_authenticated/processos/novo")({
  component: NewCase,
});

function NewCase() {
  const navigate = useNavigate();
  const consultar = useServerFn(consultarProcessoCNJ);

  const [form, setForm] = useState({
    cnj_number: "", title: "", client_id: "", court: "", judicial_body: "",
    case_class: "", subject: "", opposing_party: "", claim_value: "", notes: "",
  });
  const [cnjData, setCnjData] = useState<Awaited<ReturnType<typeof consultarProcessoCNJ>> | null>(null);

  const { data: clients } = useQuery({
    queryKey: ["clients-select"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name").order("name");
      return data ?? [];
    },
  });

  const consultaMut = useMutation({
    mutationFn: async () => consultar({ data: { cnjNumber: form.cnj_number } }),
    onSuccess: (r) => {
      setCnjData(r);
      setForm((f) => ({
        ...f,
        court: r.court,
        judicial_body: r.judicial_body ?? f.judicial_body,
        case_class: r.case_class ?? f.case_class,
        subject: r.subject ?? f.subject,
      }));
      toast.success(r.source === "datajud" ? "Dados obtidos do DataJud." : "DataJud indisponível — usando dados simulados.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("users_profile").select("organization_id").eq("user_id", u.user!.id).single();

      const { data: created, error } = await supabase
        .from("cases")
        .insert({
          organization_id: profile!.organization_id,
          cnj_number: form.cnj_number || null,
          title: form.title || null,
          client_id: form.client_id || null,
          court: form.court || null,
          judicial_body: form.judicial_body || null,
          case_class: form.case_class || null,
          subject: form.subject || null,
          opposing_party: form.opposing_party || null,
          claim_value: form.claim_value ? parseFloat(form.claim_value) : null,
          distribution_date: cnjData?.distribution_date ?? null,
          notes: form.notes || null,
          last_cnj_sync_at: cnjData ? new Date().toISOString() : null,
          responsible_user_id: u.user!.id,
        })
        .select("id").single();
      if (error) throw error;

      if (cnjData && cnjData.movements.length > 0) {
        await supabase.from("case_movements").insert(
          cnjData.movements.map((m) => ({
            organization_id: profile!.organization_id,
            case_id: created!.id,
            movement_date: m.movement_date,
            description: m.description,
            source: cnjData.source,
            external_id: m.external_id ?? null,
            is_new: true,
          })),
        );
      }
      return created!.id;
    },
    onSuccess: (id) => {
      toast.success("Processo cadastrado.");
      navigate({ to: "/processos/$id", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Link to="/processos" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <Card>
        <CardHeader><CardTitle>Novo processo</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); saveMut.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cnj">Número CNJ</Label>
              <div className="flex gap-2">
                <Input
                  id="cnj"
                  placeholder="NNNNNNN-DD.AAAA.J.TR.OOOO"
                  value={form.cnj_number}
                  onChange={(e) => setForm({ ...form, cnj_number: formatCNJ(e.target.value) })}
                  className="font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={!isValidCNJ(form.cnj_number) || consultaMut.isPending}
                  onClick={() => consultaMut.mutate()}
                >
                  {consultaMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Search className="h-4 w-4 mr-1" />Consultar CNJ</>}
                </Button>
              </div>
              {form.cnj_number && !isValidCNJ(form.cnj_number) && (
                <p className="text-xs text-destructive">Formato inválido — são 20 dígitos.</p>
              )}
              {cnjData && (
                <p className="text-xs text-muted-foreground">
                  {cnjData.movements.length} movimentações encontradas · fonte: {cnjData.source === "datajud" ? "DataJud" : "Simulado"}
                </p>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label>Título interno</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Indenização — Cliente X" />
              </div>
              <div className="space-y-2">
                <Label>Cliente</Label>
                <select
                  value={form.client_id}
                  onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">— Selecionar —</option>
                  {clients?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Parte contrária</Label>
                <Input value={form.opposing_party} onChange={(e) => setForm({ ...form, opposing_party: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Tribunal</Label>
                <Input value={form.court} onChange={(e) => setForm({ ...form, court: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Vara / Órgão julgador</Label>
                <Input value={form.judicial_body} onChange={(e) => setForm({ ...form, judicial_body: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Classe processual</Label>
                <Input value={form.case_class} onChange={(e) => setForm({ ...form, case_class: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Assunto</Label>
                <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Valor da causa (R$)</Label>
                <Input type="number" step="0.01" value={form.claim_value} onChange={(e) => setForm({ ...form, claim_value: e.target.value })} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Observações</Label>
                <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => navigate({ to: "/processos" })}>Cancelar</Button>
              <Button type="submit" disabled={saveMut.isPending}>{saveMut.isPending ? "Salvando…" : "Salvar processo"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
