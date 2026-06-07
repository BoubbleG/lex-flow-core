import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clientes/$id")({
  component: ClientDetail,
});

function ClientDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: "", document: "", email: "", phone: "", address: "", notes: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const [c, cs] = await Promise.all([
        supabase.from("clients").select("*").eq("id", id).single(),
        supabase.from("cases").select("id, cnj_number, title, status").eq("client_id", id),
      ]);
      if (c.error) throw c.error;
      return { client: c.data, cases: cs.data ?? [] };
    },
  });

  useEffect(() => {
    if (data?.client) {
      const c = data.client;
      setForm({
        name: c.name ?? "", document: c.document ?? "", email: c.email ?? "",
        phone: c.phone ?? "", address: c.address ?? "", notes: c.notes ?? "",
      });
    }
  }, [data]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("clients").update(form).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Cliente atualizado.");
    queryClient.invalidateQueries({ queryKey: ["client", id] });
    queryClient.invalidateQueries({ queryKey: ["clients"] });
  }

  async function handleDelete() {
    if (!confirm("Excluir este cliente? Os processos vinculados ficarão sem cliente.")) return;
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Cliente removido.");
    navigate({ to: "/clientes" });
  }

  if (isLoading) return <div className="text-sm text-muted-foreground">Carregando…</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Link to="/clientes" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{form.name}</CardTitle>
          <Button variant="ghost" size="sm" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-1" /> Excluir
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2"><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-2"><Label>CPF/CNPJ</Label><Input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} /></div>
              <div className="space-y-2"><Label>Telefone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>E-mail</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Endereço</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Observações</Label><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <div className="flex justify-end"><Button type="submit">Salvar alterações</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Processos vinculados</CardTitle></CardHeader>
        <CardContent>
          {data!.cases.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum processo vinculado.</p>
          ) : (
            <ul className="divide-y">
              {data!.cases.map((c) => (
                <li key={c.id} className="py-2 flex items-center justify-between">
                  <div>
                    <Link to="/processos/$id" params={{ id: c.id }} className="text-primary hover:underline text-sm font-medium">
                      {c.cnj_number ?? c.title ?? "Processo sem número"}
                    </Link>
                    <p className="text-xs text-muted-foreground">{c.title}</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded bg-muted">{c.status}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
