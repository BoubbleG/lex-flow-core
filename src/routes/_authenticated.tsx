import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

// TODO: reativar auth antes de produção.
// Modo dev: gate de autenticação desativado.
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
