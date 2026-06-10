import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { normalizeCNJ, parseCNJ, getDataJudAlias, getTribunalLabel } from "./cnj";

/**
 * Integração com a API pública do CNJ DataJud.
 *
 * Variáveis de ambiente:
 *   CNJ_API_BASE_URL  (default: https://api-publica.datajud.cnj.jus.br)
 *   CNJ_API_KEY       (chave pública DataJud — documentada no portal do CNJ)
 *   CNJ_API_TIMEOUT   (ms, default 10000)
 *
 * Se a consulta falhar (timeout, tribunal não suportado, erro de rede),
 * retorna dados simulados marcados com source = 'mock'.
 */

const DEFAULT_DATAJUD_KEY =
  "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";

// Modo dev — TODO: substituir por org real do usuário autenticado.
const DEV_ORG_ID = "00000000-0000-0000-0000-0000000000a1";

type Movement = {
  movement_date: string;
  description: string;
  external_id?: string;
};

type Party = {
  role: "ativo" | "passivo" | "outro";
  name: string;
  document?: string | null;
  person_type?: "fisica" | "juridica" | null;
  lawyers?: Array<{ name: string; oab?: string | null }>;
};

type CNJResult = {
  source: "datajud" | "mock";
  cnj_number: string;
  court: string;
  judicial_body: string | null;
  case_class: string | null;
  subject: string | null;
  distribution_date: string | null;
  claim_value: number | null;
  movements: Movement[];
  parties: Party[];
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
    claim_value: 25000,
    movements: [
      mk(2, "Conclusos para despacho"),
      mk(10, "Juntada de petição da parte autora"),
      mk(25, "Audiência de conciliação designada"),
      mk(60, "Citação expedida"),
      mk(120, "Distribuição por sorteio"),
    ],
    parties: [
      {
        role: "ativo",
        name: "Cliente Demo (simulado)",
        person_type: "fisica",
        lawyers: [{ name: "Adv. Demo", oab: "OAB/SP 000.000" }],
      },
      {
        role: "passivo",
        name: "Empresa Ré Ltda. (simulado)",
        person_type: "juridica",
        lawyers: [],
      },
    ],
  };
}

function normalizeRole(polo: string | undefined): Party["role"] {
  const p = (polo ?? "").toUpperCase();
  if (p.includes("AT")) return "ativo";
  if (p.includes("PA")) return "passivo";
  return "outro";
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
      valorCausa?: number;
      movimentos?: Array<{ nome?: string; dataHora?: string; codigo?: number }>;
      partes?: Array<{
        polo?: string;
        pessoa?: { nome?: string; tipoPessoa?: string; documento?: string };
        advogados?: Array<{ nome?: string; numeroOAB?: string; ufOAB?: string }>;
      }>;
    };

    const parties: Party[] = (src.partes ?? []).map((p) => {
      const pessoa = p.pessoa ?? {};
      const tipo = (pessoa.tipoPessoa ?? "").toUpperCase();
      return {
        role: normalizeRole(p.polo),
        name: pessoa.nome ?? "—",
        document: pessoa.documento ?? null,
        person_type: tipo.startsWith("F") ? "fisica" : tipo.startsWith("J") ? "juridica" : null,
        lawyers: (p.advogados ?? []).map((a) => ({
          name: a.nome ?? "—",
          oab: a.numeroOAB ? `OAB/${a.ufOAB ?? ""} ${a.numeroOAB}`.trim() : null,
        })),
      };
    });

    return {
      source: "datajud",
      cnj_number: src.numeroProcesso ?? cnjNumber,
      court: src.tribunal ?? alias.toUpperCase(),
      judicial_body: src.orgaoJulgador?.nome ?? null,
      case_class: src.classe?.nome ?? null,
      subject: src.assuntos?.map((a) => a.nome).filter(Boolean).join(", ") || null,
      distribution_date: src.dataAjuizamento ? src.dataAjuizamento.slice(0, 10) : null,
      claim_value: typeof src.valorCausa === "number" ? src.valorCausa : null,
      movements: (src.movimentos ?? [])
        .filter((m) => m.dataHora)
        .map((m) => ({
          movement_date: new Date(m.dataHora!).toISOString(),
          description: m.nome ?? "Movimentação",
          external_id: m.codigo != null ? String(m.codigo) : undefined,
        }))
        .sort((a, b) => b.movement_date.localeCompare(a.movement_date)),
      parties,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function queryDataJudWithRetry(cnjNumber: string, alias: string): Promise<CNJResult | null> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await queryDataJud(cnjNumber, alias);
      if (r) return r;
    } catch (e) {
      lastErr = e;
    }
    // backoff exponencial: 300ms, 900ms
    if (attempt < 2) await new Promise((r) => setTimeout(r, 300 * Math.pow(3, attempt)));
  }
  if (lastErr) console.warn("[CNJ] retry exhausted:", lastErr);
  return null;
}

/**
 * Lógica núcleo de sincronização de um processo.
 * Retorna sumário com #movimentos novos.
 */
export async function syncCaseInternal(opts: {
  cnjNumber: string;
  caseId?: string;
  organizationId: string;
}): Promise<{ source: "datajud" | "mock"; newMovements: number; result: CNJResult }> {
  const clean = normalizeCNJ(opts.cnjNumber);
  const seg = parseCNJ(clean);
  if (!seg) throw new Error("Número CNJ inválido.");
  const formatted = `${clean.slice(0, 7)}-${clean.slice(7, 9)}.${clean.slice(9, 13)}.${clean.slice(13, 14)}.${clean.slice(14, 16)}.${clean.slice(16, 20)}`;
  const alias = getDataJudAlias(seg);

  const t0 = Date.now();
  let result: CNJResult;
  let logStatus: "success" | "fallback_mock" = "success";
  let logError: string | null = null;

  if (alias) {
    const real = await queryDataJudWithRetry(formatted, alias);
    if (real) {
      result = real;
    } else {
      result = buildMock(formatted);
      logStatus = "fallback_mock";
      logError = "DataJud indisponível ou sem retorno.";
    }
  } else {
    result = buildMock(formatted);
    logStatus = "fallback_mock";
    logError = "Tribunal não suportado pela API pública.";
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let newMovementsCount = 0;

  if (opts.caseId) {
    // Atualiza dados do processo
    await supabaseAdmin
      .from("cases")
      .update({
        court: result.court,
        judicial_body: result.judicial_body,
        case_class: result.case_class,
        subject: result.subject,
        distribution_date: result.distribution_date,
        claim_value: result.claim_value,
        last_cnj_sync_at: new Date().toISOString(),
      })
      .eq("id", opts.caseId);

    // Movimentações: diff vs existentes
    const { data: existing } = await supabaseAdmin
      .from("case_movements")
      .select("movement_date, description")
      .eq("case_id", opts.caseId);
    const seen = new Set((existing ?? []).map((m) => `${m.movement_date}|${m.description}`));
    const newOnes = result.movements.filter((m) => !seen.has(`${m.movement_date}|${m.description}`));
    if (newOnes.length > 0) {
      await supabaseAdmin.from("case_movements").insert(
        newOnes.map((m) => ({
          organization_id: opts.organizationId,
          case_id: opts.caseId!,
          movement_date: m.movement_date,
          description: m.description,
          source: result.source,
          external_id: m.external_id ?? null,
          is_new: true,
        })),
      );
      newMovementsCount = newOnes.length;

      // Notificação
      const { data: caseRow } = await supabaseAdmin
        .from("cases")
        .select("cnj_number, title")
        .eq("id", opts.caseId)
        .maybeSingle();
      await supabaseAdmin.from("notifications").insert({
        organization_id: opts.organizationId,
        case_id: opts.caseId,
        type: "nova_movimentacao",
        title: `${newOnes.length} nova(s) movimentação(ões)`,
        body: `${caseRow?.cnj_number ?? "Processo"}${caseRow?.title ? ` — ${caseRow.title}` : ""}`,
      });
    }

    // Partes e advogados — substitui (sempre reflete o estado atual)
    if (result.parties.length > 0) {
      await supabaseAdmin.from("case_lawyers").delete().eq("case_id", opts.caseId);
      await supabaseAdmin.from("case_parties").delete().eq("case_id", opts.caseId);
      for (const p of result.parties) {
        const { data: partyRow } = await supabaseAdmin
          .from("case_parties")
          .insert({
            organization_id: opts.organizationId,
            case_id: opts.caseId,
            role: p.role,
            name: p.name,
            document: p.document ?? null,
            person_type: p.person_type ?? null,
          })
          .select("id")
          .single();
        if (partyRow && p.lawyers && p.lawyers.length > 0) {
          await supabaseAdmin.from("case_lawyers").insert(
            p.lawyers.map((l) => ({
              organization_id: opts.organizationId,
              case_id: opts.caseId!,
              party_id: partyRow.id,
              name: l.name,
              oab: l.oab ?? null,
            })),
          );
        }
      }
    }
  }

  await supabaseAdmin.from("cnj_query_logs").insert({
    organization_id: opts.organizationId,
    case_id: opts.caseId ?? null,
    user_id: null,
    cnj_number: formatted,
    status: logStatus,
    source: result.source,
    response_summary: `${result.movements.length} mov | ${result.parties.length} partes | ${result.court}`,
    error_message: logError,
    duration_ms: Date.now() - t0,
  });

  return { source: result.source, newMovements: newMovementsCount, result };
}

export const consultarProcessoCNJ = createServerFn({ method: "POST" })
  .inputValidator((input: { cnjNumber: string; caseId?: string }) =>
    z
      .object({
        cnjNumber: z.string().min(20).max(30),
        caseId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const r = await syncCaseInternal({
      cnjNumber: data.cnjNumber,
      caseId: data.caseId,
      organizationId: DEV_ORG_ID,
    });
    return r.result;
  });

export const consultarProcessosLote = createServerFn({ method: "POST" })
  .inputValidator((input: { caseIds: string[] }) =>
    z.object({ caseIds: z.array(z.string().uuid()).min(1).max(200) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("cases")
      .select("id, cnj_number, organization_id")
      .in("id", data.caseIds);
    const items = (rows ?? []).filter((c) => c.cnj_number);

    const summary = {
      total: items.length,
      success: 0,
      updated: 0,
      newMovements: 0,
      failed: [] as Array<{ caseId: string; error: string }>,
    };

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
          summary.success++;
          if (r.newMovements > 0) {
            summary.updated++;
            summary.newMovements += r.newMovements;
          }
        } catch (e) {
          summary.failed.push({ caseId: c.id, error: (e as Error).message });
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    return summary;
  });
