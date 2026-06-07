import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clientes/")({
  component: ClientsList,
});

function ClientsList() {
  const { data, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, document, email, phone, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clientes</h1>
          <p className="text-sm text-muted-foreground">Pessoas e empresas atendidas pelo escritório</p>
        </div>
        <Button asChild><Link to="/clientes/novo"><Plus className="h-4 w-4 mr-1" />Novo cliente</Link></Button>
      </div>

      <Card>
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Carregando…</div>
        ) : !data || data.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Nenhum cliente cadastrado.
            <div className="mt-3"><Button asChild size="sm"><Link to="/clientes/novo">Cadastrar primeiro cliente</Link></Button></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Nome</th>
                  <th className="px-4 py-2 font-medium">CPF/CNPJ</th>
                  <th className="px-4 py-2 font-medium">E-mail</th>
                  <th className="px-4 py-2 font-medium">Telefone</th>
                </tr>
              </thead>
              <tbody>
                {data.map((c) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link to="/clientes/$id" params={{ id: c.id }} className="text-primary hover:underline font-medium">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.document ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.email ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.phone ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
