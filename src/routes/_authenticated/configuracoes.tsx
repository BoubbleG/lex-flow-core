import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  component: Settings,
});

function Settings() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["settings-me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data: p } = await supabase
        .from("users_profile")
        .select("name, oab_number, oab_state, practice_area, email, organization_id, organizations(name, document, plan)")
        .eq("user_id", u.user!.id).single();
      return p;
    },
  });

  const [profile, setProfile] = useState({ name: "", oab_number: "", oab_state: "", practice_area: "" });
  const [org, setOrg] = useState({ name: "", document: "" });

  useEffect(() => {
    if (data) {
      setProfile({
        name: data.name ?? "", oab_number: data.oab_number ?? "",
        oab_state: data.oab_state ?? "", practice_area: data.practice_area ?? "",
      });
      const o = (data as { organizations?: { name?: string; document?: string } }).organizations;
      setOrg({ name: o?.name ?? "", document: o?.document ?? "" });
    }
  }, [data]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("users_profile").update(profile).eq("user_id", u.user!.id);
    if (error) return toast.error(error.message);
    toast.success("Perfil atualizado.");
    queryClient.invalidateQueries({ queryKey: ["me"] });
    queryClient.invalidateQueries({ queryKey: ["settings-me"] });
  }

  async function saveOrg(e: React.FormEvent) {
    e.preventDefault();
    if (!data?.organization_id) return;
    const { error } = await supabase.from("organizations").update(org).eq("id", data.organization_id);
    if (error) return toast.error(error.message);
    toast.success("Escritório atualizado.");
    queryClient.invalidateQueries({ queryKey: ["me"] });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Configurações</h1>

      <Card>
        <CardHeader><CardTitle className="text-base">Perfil</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="space-y-2"><Label>Nome</Label><Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>OAB</Label><Input value={profile.oab_number} onChange={(e) => setProfile({ ...profile, oab_number: e.target.value })} /></div>
              <div className="space-y-2"><Label>UF</Label><Input value={profile.oab_state} maxLength={2} onChange={(e) => setProfile({ ...profile, oab_state: e.target.value.toUpperCase() })} /></div>
            </div>
            <div className="space-y-2"><Label>Área de atuação</Label><Input value={profile.practice_area} onChange={(e) => setProfile({ ...profile, practice_area: e.target.value })} /></div>
            <div className="flex justify-end"><Button type="submit">Salvar perfil</Button></div>
          </form>
        </CardContent>
      </Card>

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
    </div>
  );
}
