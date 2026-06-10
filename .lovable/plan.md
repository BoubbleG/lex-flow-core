# Implementação completa do DataJud (CNJ)

Hoje a integração já consulta a API pública do DataJud, salva movimentações novas e tem fallback mock. Este plano cobre os 4 eixos pedidos: **dados completos**, **consulta em lote**, **sincronização automática periódica** e **notificações de novidades**.

## 1. Dados completos do processo

Expandir `consultarProcessoCNJ` em `src/lib/cnj.functions.ts` para retornar e persistir:

- **Partes** (polo ativo / polo passivo) com nome, tipo de pessoa e papel
- **Advogados** vinculados (nome + OAB)
- **Valor da causa**, **órgão julgador**, **classe**, **assuntos** (já parcialmente capturados)
- **Grau** (1º/2º), **nível de sigilo**, **formato** (eletrônico/físico)
- **Movimentos** com complementos (já temos descrição/data, adicionar código e complementos)

Schema novo:

```text
case_parties      (id, organization_id, case_id, role, name, document, person_type)
case_lawyers      (id, organization_id, case_id, name, oab, party_id)
```

Em `cases`, popular automaticamente após sync: `case_class`, `subject`, `judicial_body`, `claim_value`, `distribution_date`, `court`.

UI: nova aba "Partes & Advogados" em `processos/$id.tsx` ao lado de "Movimentações".

## 2. Consulta em lote

Novo server fn `consultarProcessosLote({ caseIds })` em `cnj.functions.ts`:

- Itera com **concorrência 3** (evitar throttling do DataJud)
- Reutiliza a lógica de `consultarProcessoCNJ` por processo
- Retorna sumário `{ total, success, updated, novosMovimentos, falhas[] }`

UI em `processos.index.tsx`:

- Checkbox por linha + "selecionar todos"
- Botão "Atualizar selecionados" → chama o lote com toast de progresso
- Botão "Atualizar todos os ativos"

## 3. Sincronização automática periódica

**Backend (cron):**

- Nova rota pública `src/routes/api/public/hooks/cnj-sync.ts` (POST)
  - Autentica via header `apikey` (anon key — padrão do projeto)
  - Lê do banco todos os `cases` com `status='ativo'` e (`last_cnj_sync_at` nulo OU < now()-12h)
  - Limita a 50 processos por execução (evita rajada)
  - Reaproveita `consultarProcessoCNJ`
- Cron via `pg_cron` + `pg_net` a cada 6h:

```sql
select cron.schedule(
  'cnj-auto-sync', '0 */6 * * *',
  $$ select net.http_post(
    url:='https://project--163bed13-893e-4a42-86f9-055c430ed1b6.lovable.app/api/public/hooks/cnj-sync',
    headers:='{"Content-Type":"application/json","apikey":"<anon>"}'::jsonb,
    body:='{}'::jsonb) $$);
```

**UI:** badge "Auto-sync ativo" + última execução em `configuracoes.tsx`, com toggle para pausar (flag em `organizations.settings`).

## 4. Notificações de novidades

Schema:

```text
notifications (id, organization_id, user_id NULL, case_id, type, title, body,
               read_at NULL, created_at)
```

- Gerar notificação para cada batch de movimentos novos detectados (em `consultarProcessoCNJ` quando `newOnes.length > 0`)
- Tipo: `nova_movimentacao` com link para o processo
- UI:
  - Sino no header do `AppShell` com badge de não-lidas (count via React Query)
  - Popover lista as 10 mais recentes; clique navega ao processo e marca como lida
  - Página `/notificacoes` com histórico completo
- Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE notifications` + subscribe no `AppShell` para incrementar badge ao vivo

## 5. Robustez da integração

- Backoff exponencial (3 tentativas) em `queryDataJud` para 429/5xx
- Timeout configurável já existe (`CNJ_API_TIMEOUT`)
- `cnj_query_logs` ganha coluna `duration_ms` para diagnóstico
- Mantém fallback mock (conforme escolhido)
- Badge "fonte: DataJud" vs "fonte: simulado" mais visível na UI de processo

## Arquivos a criar / alterar

**Migrações** (uma única):
- Criar `case_parties`, `case_lawyers`, `notifications`
- Adicionar `duration_ms` em `cnj_query_logs`
- Habilitar `pg_cron` + `pg_net`, agendar `cnj-auto-sync`
- Adicionar `notifications` na publication `supabase_realtime`
- GRANTs + RLS (incluindo policy `dev anon` consistente com o modo dev atual)

**Backend:**
- `src/lib/cnj.functions.ts` — expandir parser DataJud, persistir partes/advogados, gerar notificações, novo `consultarProcessosLote`
- `src/routes/api/public/hooks/cnj-sync.ts` — endpoint do cron

**Frontend:**
- `src/routes/_authenticated/processos.$id.tsx` — aba Partes & Advogados, badge da fonte
- `src/routes/_authenticated/processos.index.tsx` — seleção múltipla + ações em lote
- `src/routes/_authenticated/configuracoes.tsx` — toggle auto-sync + última execução
- `src/components/AppShell.tsx` — sino de notificações
- `src/routes/_authenticated/notificacoes.tsx` — página de histórico
- `src/components/NotificationsBell.tsx` — popover + realtime

## Fora do escopo (perguntar depois se quiser)

- Envio de notificação por **email** (precisaria connector tipo Resend)
- Exportação de movimentações em PDF
- Histórico/diff visual de alterações em campos do processo
