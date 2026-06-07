import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeCNJ, parseCNJ, getDataJudAlias, getTribunalLabel } from "./cnj";

/**
 * Integração com a API pública do CNJ DataJud.
 *
 * Para substituir as credenciais reais, configure as variáveis de ambiente:
 *   CNJ_API_BASE_URL  (default: https://api-publica.datajud.cnj.jus.br)
 *   CNJ_API_KEY       (chave pública DataJud — documentada no portal do CNJ)
 *   CNJ_API_TIMEOUT   (ms, default 10000)
 *
 * Se a consulta falhar (timeout, tribunal não suportado, erro de rede),
 * a função retorna dados simulados realistas marcados com source = 'mock'.
 */

// Chave pública do DataJud (documentada publicamente pelo CNJ).
// Pode ser substituída via CNJ_API_KEY.
const DEFAULT_DATAJUD_KEY =
  "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";

type Movement = {
  movement_date: string;
  description: string;
  external_id?: string;
};

type CNJResult = {
  source: "datajud" | "mock";
  cnj_number: string;
  court: string;
  judicial_body: string | null;
  case_class: string | null;
  subject: string | null;
  distribution_date: string | null;
  movements: Movement[];
};

function buildMock(cnjNumber: string): CNJResult {
  const seg = parseCNJ(cnjNumber);
  const court = seg ? getTribunalLabel(seg) : "Tribunal";
  const now = Date.now();
  const mk = (daysAgo: number, description: string): Movement => ({
    movement_date: new Date(now - daysAgo * 86400000).toISOString(),
    description,
  });
  return {
    source: "mock",
    cnj_number: cnjNumber,
    court,
    judicial_body: "1ª Vara Cível (simulado)",
    case_class: "Procedimento Comum Cível",
    subject: "Obrigação de Fazer / Indenização",
    distribution_date: new Date(now - 180 * 86400000).toISOString().slice(0, 10),
    movements: [
      mk(2, "Conclusos para despacho"),
      mk(10, "Juntada de petição da parte autora"),
      mk(25, "Audiência de conciliação designada"),
      mk(60, "Citação expedida"),
      mk(120, "Distribuição por sorteio"),
    ],
  };
}

async function queryDataJud(cnjNumber: string, alias: string): Promise<CNJResult | null> {
  const base = process.env.CNJ_API_BASE_URL ?? "https://api-publica.datajud.cnj.jus.br";
  const key = process.env.CNJ_API_KEY ?? DEFAULT_DATAJUD_KEY;
  const timeout = parseInt(process.env.CNJ_API_TIMEOUT ?? "10000", 10);
  const url = `${base.replace(/\/$/, "")}/api_publica_${alias}/_search`;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `APIKey ${key}`,
      },
      body: JSON.stringify({
        query: { match: { numeroProcesso: cnjNumber } },
        size: 1,
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      hits?: { hits?: Array<{ _source: Record<string, unknown> }> };
    };
    const hit = json.hits?.hits?.[0]?._source;
    if (!hit) return null;
    const src = hit as {
      numeroProcesso?: string;
      tribunal?: string;
      orgaoJulgador?: { nome?: string };
      classe?: { nome?: string };
      assuntos?: Array<{ nome?: string }>;
      dataAjuizamento?: string;
      movimentos?: Array<{ nome?: string; dataHora?: string; codigo?: number }>;
    };
    return {
      source: "datajud",
      cnj_number: src.numeroProcesso ?? cnjNumber,
      court: src.tribunal ?? alias.toUpperCase(),
      judicial_body: src.orgaoJulgador?.nome ?? null,
      case_class: src.classe?.nome ?? null,
      subject: src.assuntos?.map((a) => a.nome).filter(Boolean).join(", ") || null,
      distribution_date: src.dataAjuizamento ? src.dataAjuizamento.slice(0, 10) : null,
      movements: (src.movimentos ?? [])
        .filter((m) => m.dataHora)
        .map((m) => ({
          movement_date: new Date(m.dataHora!).toISOString(),
          description: m.nome ?? "Movimentação",
          external_id: m.codigo != null ? String(m.codigo) : undefined,
        }))
        .sort((a, b) => b.movement_date.localeCompare(a.movement_date)),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export const consultarProcessoCNJ = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { cnjNumber: string; caseId?: string }) =>
    z
      .object({
        cnjNumber: z.string().min(20).max(30),
        caseId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const clean = normalizeCNJ(data.cnjNumber);
    const seg = parseCNJ(clean);
    if (!seg) {
      throw new Error("Número CNJ inválido. Use o formato NNNNNNN-DD.AAAA.J.TR.OOOO.");
    }
    const formatted = `${clean.slice(0, 7)}-${clean.slice(7, 9)}.${clean.slice(9, 13)}.${clean.slice(13, 14)}.${clean.slice(14, 16)}.${clean.slice(16, 20)}`;
    const alias = getDataJudAlias(seg);

    let result: CNJResult;
    let logStatus: "success" | "fallback_mock" | "error" = "success";
    let logError: string | null = null;

    if (alias) {
      const real = await queryDataJud(formatted, alias);
      if (real) {
        result = real;
      } else {
        result = buildMock(formatted);
        logStatus = "fallback_mock";
        logError = "DataJud indisponível ou sem retorno — usando dados simulados.";
      }
    } else {
      result = buildMock(formatted);
      logStatus = "fallback_mock";
      logError = "Tribunal não suportado pela API pública — usando dados simulados.";
    }

    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("users_profile")
      .select("organization_id")
      .eq("user_id", userId)
      .maybeSingle();
    const orgId = profile?.organization_id;
    if (!orgId) throw new Error("Perfil/organização não encontrados.");

    await supabase.from("cnj_query_logs").insert({
      organization_id: orgId,
      case_id: data.caseId ?? null,
      user_id: userId,
      cnj_number: formatted,
      status: logStatus,
      source: result.source,
      response_summary: `${result.movements.length} movimentações | ${result.court}`,
      error_message: logError,
    });

    return result;
  });
