import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type N = {
  id: string;
  case_id: string | null;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
};

export function NotificationsBell() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["notifications", "recent"],
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, case_id, title, body, read_at, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      return (data ?? []) as N[];
    },
    refetchInterval: 60_000,
  });

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("notif-bell")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        () => qc.invalidateQueries({ queryKey: ["notifications"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const items = data ?? [];
  const unread = items.filter((n) => !n.read_at).length;

  async function markRead(id: string) {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-3 py-2 border-b flex items-center justify-between">
          <span className="text-sm font-semibold">Notificações</span>
          <Link to="/notificacoes" className="text-xs text-primary hover:underline">Ver todas</Link>
        </div>
        {items.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Sem novidades.</div>
        ) : (
          <ul className="divide-y max-h-96 overflow-auto">
            {items.map((n) => {
              const content = (
                <div className={`p-3 hover:bg-muted/40 ${n.read_at ? "" : "bg-primary/5"}`}>
                  <p className="text-sm font-medium leading-tight">{n.title}</p>
                  {n.body && <p className="text-xs text-muted-foreground truncate mt-0.5">{n.body}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
              );
              return (
                <li key={n.id}>
                  {n.case_id ? (
                    <Link to="/processos/$id" params={{ id: n.case_id }} onClick={() => markRead(n.id)}>
                      {content}
                    </Link>
                  ) : (
                    <button className="w-full text-left" onClick={() => markRead(n.id)}>{content}</button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
