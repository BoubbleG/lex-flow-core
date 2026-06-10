import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notificacoes")({
  component: NotificacoesPage,
});

type Notification = {
  id: string;
  case_id: string | null;
  type: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
};

function NotificacoesPage() {
  const qc = useQueryClient();
  const [items, setItems] = useState<Notification[]>([]);
  const { data, isLoading } = useQuery({
    queryKey: ["notifications", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, case_id, type, title, body, read_at, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as Notification[];
    },
  });

  useEffect(() => {
    if (data) setItems(data);
  }, [data]);

  async function markAllRead() {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .is("read_at", null);
    if (error) return toast.error(error.message);
    toast.success("Todas marcadas como lidas.");
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  async function markRead(id: string) {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Notificações</h1>
          <p className="text-sm text-muted-foreground">Alertas de novas movimentações nos seus processos.</p>
        </div>
        <Button variant="outline" size="sm" onClick={markAllRead}>
          <CheckCheck className="h-4 w-4 mr-1" /> Marcar tudo como lido
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Histórico</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Carregando…</div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-40" />
              Nenhuma notificação ainda.
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((n) => (
                <li key={n.id} className={`p-4 flex items-start gap-3 ${n.read_at ? "" : "bg-primary/5"}`}>
                  <div className={`h-2 w-2 rounded-full mt-2 ${n.read_at ? "bg-muted-foreground/40" : "bg-primary"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{n.title}</p>
                    {n.body && <p className="text-xs text-muted-foreground truncate">{n.body}</p>}
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                  {n.case_id && (
                    <Link
                      to="/processos/$id"
                      params={{ id: n.case_id }}
                      onClick={() => markRead(n.id)}
                      className="text-xs text-primary hover:underline shrink-0"
                    >
                      Abrir
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
