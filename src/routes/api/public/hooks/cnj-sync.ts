import { createFileRoute } from "@tanstack/react-router";
import { syncCaseInternal } from "@/lib/cnj.functions";

/**
 * Endpoint público chamado pelo pg_cron a cada 6h.
 * Lê processos ativos com sync pendente (nunca sincronizados ou > 12h) e atualiza até 50.
 *
 * Segurança: `apikey` header com a anon key (padrão dos /api/public/*).
 */
export const Route = createFileRoute("/api/public/hooks/cnj-sync")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const startedAt = new Date().toISOString();

        // Organizações com auto-sync ligado
        const { data: orgs } = await supabaseAdmin
          .from("organizations")
          .select("id")
          .eq("auto_sync_enabled", true);
        const orgIds = (orgs ?? []).map((o) => o.id);
        if (orgIds.length === 0) {
          return Response.json({ ok: true, message: "no orgs with auto-sync", processed: 0 });
        }

        const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
        const { data: cases, error } = await supabaseAdmin
          .from("cases")
          .select("id, cnj_number, organization_id, last_cnj_sync_at")
          .in("organization_id", orgIds)
          .eq("status", "ativo")
          .not("cnj_number", "is", null)
          .or(`last_cnj_sync_at.is.null,last_cnj_sync_at.lt.${cutoff}`)
          .limit(50);

        if (error) {
          console.error("[cnj-sync] query error", error);
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        const items = cases ?? [];
        let success = 0;
        let failed = 0;
        let newMovements = 0;

        const CONCURRENCY = 3;
        let idx = 0;
        async function worker() {
          while (idx < items.length) {
            const i = idx++;
            const c = items[i];
            try {
              const r = await syncCaseInternal({
                cnjNumber: c.cnj_number!,
                caseId: c.id,
                organizationId: c.organization_id,
              });
              success++;
              newMovements += r.newMovements;
            } catch (e) {
              failed++;
              console.error("[cnj-sync] case failed", c.id, e);
            }
          }
        }
        await Promise.all(Array.from({ length: CONCURRENCY }, worker));

        // Atualiza last_auto_sync_at por organização
        await supabaseAdmin
          .from("organizations")
          .update({ last_auto_sync_at: new Date().toISOString() })
          .in("id", orgIds);

        return Response.json({
          ok: true,
          startedAt,
          processed: items.length,
          success,
          failed,
          newMovements,
        });
      },
    },
  },
});
