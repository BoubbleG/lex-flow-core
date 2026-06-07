import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "lucide-react";

export const Route = createFileRoute("/_authenticated/prazos")({
  component: () => (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-1">Prazos & Tarefas</h1>
      <p className="text-sm text-muted-foreground mb-4">
        Em breve: lista e calendário de prazos com alertas para vencimentos próximos.
      </p>
      <Card>
        <CardContent className="p-10 text-center text-sm text-muted-foreground">
          <Calendar className="h-8 w-8 mx-auto mb-2 opacity-40" />
          Módulo em construção. A estrutura de dados já está disponível no backend.
        </CardContent>
      </Card>
    </div>
  ),
});
