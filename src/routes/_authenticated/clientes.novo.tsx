import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clientes/novo")({
  component: NewClient,
});

function NewClient() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", document: "", email: "", phone: "", address: "", notes: "",
  });

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { DEV_ORG_ID } = await import("@/lib/dev-auth");
    const { data, error } = await supabase
      .from("clients")
      .insert({ ...form, organization_id: DEV_ORG_ID })
      .select("id").single();
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Cliente cadastrado.");
    navigate({ to: "/clientes/$id", params: { id: data!.id } });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Link to="/clientes" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <Card>
        <CardHeader><CardTitle>Novo cliente</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="name">Nome / Razão social *</Label>
                <Input id="name" required value={form.name} onChange={(e) => set("name", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="doc">CPF / CNPJ</Label>
                <Input id="doc" value={form.document} onChange={(e) => set("document", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone / WhatsApp</Label>
                <Input id="phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="address">Endereço</Label>
                <Input id="address" value={form.address} onChange={(e) => set("address", e.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea id="notes" rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => navigate({ to: "/clientes" })}>Cancelar</Button>
              <Button type="submit" disabled={loading}>{loading ? "Salvando…" : "Salvar"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
