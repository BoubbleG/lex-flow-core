import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Scale } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Bem-vindo de volta!");
    navigate({ to: "/dashboard" });
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectUrl, data: { name } },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Conta criada. Verifique seu e-mail se for solicitado.");
    navigate({ to: "/onboarding" });
  }

  async function handleReset() {
    if (!email) return toast.error("Informe seu e-mail acima.");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    if (error) return toast.error(error.message);
    toast.success("Enviamos um e-mail para redefinir sua senha.");
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-sidebar text-sidebar-foreground">
        <Link to="/" className="flex items-center gap-2 text-lg font-semibold">
          <Scale className="h-6 w-6 text-sidebar-primary" />
          JusFlow
        </Link>
        <div className="space-y-4 max-w-md">
          <h2 className="text-3xl font-semibold tracking-tight">
            Gestão jurídica enxuta para quem advoga no dia a dia.
          </h2>
          <p className="text-sidebar-foreground/80">
            Centralize clientes, processos, prazos e movimentações em um único painel — com consulta
            integrada ao DataJud/CNJ.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/60">
          As informações processuais devem ser conferidas nas fontes oficiais.
        </p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="lg:hidden flex items-center gap-2 text-lg font-semibold">
            <Scale className="h-6 w-6 text-primary" />
            JusFlow
          </div>

          <Tabs defaultValue="login">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">E-mail</Label>
                  <Input id="login-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Senha</Label>
                  <Input id="login-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Entrando…" : "Entrar"}
                </Button>
                <button type="button" onClick={handleReset} className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">
                  Esqueci minha senha
                </button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="su-name">Nome</Label>
                  <Input id="su-name" required value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-email">E-mail</Label>
                  <Input id="su-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-password">Senha</Label>
                  <Input id="su-password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Criando conta…" : "Criar conta"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
