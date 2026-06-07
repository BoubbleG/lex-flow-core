import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, User as UserIcon, Info } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DEV_ORG_NAME, DEV_USER_NAME } from "@/lib/dev-auth";

export function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  // Modo dev: perfil mock (sem login).
  const profile = { name: DEV_USER_NAME };
  const orgName = DEV_ORG_NAME;

  useEffect(() => {
    setDismissed(typeof window !== "undefined" && sessionStorage.getItem("jf-disclaimer") === "1");
  }, []);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-muted/20">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b bg-background flex items-center gap-3 px-3 sm:px-4">
            <SidebarTrigger />
            <div className="flex-1 max-w-md relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar clientes, processos, tarefas…"
                className="pl-9 h-9 bg-muted/40 border-transparent focus-visible:bg-background"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">
                    {(profile?.name ?? "?").slice(0, 1).toUpperCase()}
                  </div>
                  <span className="hidden sm:inline text-sm">{profile?.name ?? "Conta"}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="font-medium">{profile?.name}</div>
                  <div className="text-xs text-muted-foreground">{orgName}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/configuracoes" })}>
                  <UserIcon className="h-4 w-4 mr-2" /> Configurações
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="h-4 w-4 mr-2" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          {!dismissed && (
            <div className="bg-accent/40 border-b border-accent text-accent-foreground text-xs px-4 py-2 flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <p className="flex-1">
                As informações processuais exibidas devem ser conferidas nas fontes oficiais. Esta
                plataforma não substitui a conferência profissional do advogado.
              </p>
              <button
                onClick={() => { sessionStorage.setItem("jf-disclaimer", "1"); setDismissed(true); }}
                className="text-xs underline-offset-2 hover:underline"
              >
                Entendi
              </button>
            </div>
          )}

          <main className="flex-1 p-4 sm:p-6 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
