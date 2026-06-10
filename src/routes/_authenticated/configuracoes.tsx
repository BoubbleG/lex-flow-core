import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { DEV_ORG_ID } from "@/lib/dev-auth";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  component: Settings,
});

function Settings() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["settings-org"],
    queryFn: async () => {
      const { data: o } = await supabase
        .from("organizations")
        .select("name, document, plan, auto_sync_enabled, last_auto_sync_at")
        .eq("id", DEV_ORG_ID)
        .maybeSingle();
      return o;
    },
  });

  const [org, setOrg] = useState({ name: "", document: "" });

  useEffect(() => {
    if (data) setOrg({ name: data.name ?? "", document: data.document ?? "" });
  }, [data]);

  async function saveOrg(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("organizations").update(org).eq("id", DEV_ORG_ID);
    if (error) return toast.error(error.message);
    toast.success("Escritório atualizado.");
    queryClient.invalidateQueries({ queryKey: ["settings-org"] });
  }

  async function toggleAutoSync(value: boolean) {
    const { error } = await supabase
      .from("organizations")
      .update({ auto_sync_enabled: value })
      .eq("id", DEV_ORG_ID);
    if (error) return toast.error(error.message);
    toast.success(value ? "Sincronização automática ativada." : "Sincronização automática pausada.");
    queryClient.invalidateQueries({ queryKey: ["settings-org"] });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Configurações</h1>
      <p className="text-sm text-muted-foreground">
        Modo desenvolvimento ativo — autenticação desativada.
      </p>

      <Card>
        <CardHeader><CardTitle className="text-base">Escritório</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={saveOrg} className="space-y-4">
            <div className="space-y-2"><Label>Nome</Label><Input value={org.name} onChange={(e) => setOrg({ ...org, name: e.target.value })} /></div>
            <div className="space-y-2"><Label>CNPJ</Label><Input value={org.document} onChange={(e) => setOrg({ ...org, document: e.target.value })} /></div>
            <div className="flex justify-end"><Button type="submit">Salvar escritório</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Sincronização CNJ (DataJud)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Sincronização automática</p>
              <p className="text-xs text-muted-foreground">
                Atualiza processos ativos com o DataJud a cada 6 horas.
              </p>
            </div>
            <Switch
              checked={data?.auto_sync_enabled ?? true}
              onCheckedChange={toggleAutoSync}
            />
          </div>
          <div className="text-xs text-muted-foreground border-t pt-3">
            Última execução automática:{" "}
            {data?.last_auto_sync_at
              ? format(new Date(data.last_auto_sync_at), "dd/MM/yyyy HH:mm")
              : "Ainda não executou"}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
