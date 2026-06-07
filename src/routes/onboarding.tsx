import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Scale } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
  },
  component: OnboardingPage,
});

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

function OnboardingPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [name, setName] = useState("");
  const [oab, setOab] = useState("");
  const [uf, setUf] = useState("SP");
  const [area, setArea] = useState("");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: p } = await supabase
        .from("users_profile")
        .select("name, onboarding_completed, organization_id, organizations(name)")
        .eq("user_id", u.user.id)
        .maybeSingle();
      if (p?.onboarding_completed) {
        navigate({ to: "/dashboard" });
        return;
      }
      if (p?.name) setName(p.name);
      const orgRel = (p as { organizations?: { name?: string } } | null)?.organizations;
      if (orgRel?.name) setOrgName(orgRel.name);
    })();
  }, [navigate]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data: profile } = await supabase
      .from("users_profile")
      .select("organization_id")
      .eq("user_id", u.user.id)
      .maybeSingle();
    if (profile?.organization_id) {
      await supabase.from("organizations").update({ name: orgName }).eq("id", profile.organization_id);
    }
    const { error } = await supabase
      .from("users_profile")
      .update({
        name,
        oab_number: oab,
        oab_state: uf,
        practice_area: area,
        onboarding_completed: true,
      })
      .eq("user_id", u.user.id);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Pronto! Vamos começar.");
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <div className="flex items-center gap-2 text-primary font-semibold mb-2">
            <Scale className="h-5 w-5" /> JusFlow
          </div>
          <CardTitle>Vamos configurar sua conta</CardTitle>
          <p className="text-sm text-muted-foreground">
            Esses dados aparecem no seu perfil e nos seus documentos.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="org">Nome do escritório / banca</Label>
                <Input id="org" required value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Ex.: Silva & Associados" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="name">Seu nome</Label>
                <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="oab">Número OAB</Label>
                <Input id="oab" value={oab} onChange={(e) => setOab(e.target.value)} placeholder="123456" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="uf">UF</Label>
                <select id="uf" value={uf} onChange={(e) => setUf(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                  {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="area">Área principal de atuação</Label>
                <Input id="area" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Cível, Trabalhista, Tributário…" />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Salvando…" : "Concluir e entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
