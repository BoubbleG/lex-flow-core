import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/documentos")({
  component: () => (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-1">Documentos</h1>
      <p className="text-sm text-muted-foreground mb-4">
        Em breve: upload de PDFs, DOCX e imagens vinculados a clientes e processos.
      </p>
      <Card>
        <CardContent className="p-10 text-center text-sm text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
          Módulo em construção. A estrutura de dados já está disponível no backend.
        </CardContent>
      </Card>
    </div>
  ),
});
