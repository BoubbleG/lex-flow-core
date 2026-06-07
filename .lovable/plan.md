
# JusFlow — Plano do MVP (Fase 1)

SaaS jurídico para advogados e pequenos escritórios. Visual limpo profissional, sidebar + topbar, fundo claro, cards e timeline. Multi-tenant por organização, isolamento via RLS.

## Fase 1 (esta entrega)

Auth + organização + onboarding, CRUD de Clientes, CRUD de Processos, consulta DataJud (real com fallback mock), timeline de movimentações, Dashboard. Tarefas/Prazos, Documentos e Busca Global ficam para a Fase 2 (estrutura de DB já criada para suportar).

## Stack

- TanStack Start (já no template), Tailwind v4, shadcn/ui.
- Lovable Cloud (Supabase) para Auth, DB, Storage.
- Server functions (`createServerFn`) para integração CNJ — chave nunca exposta no frontend.

## Banco de dados (migração inicial completa)

Crio todas as tabelas listadas no briefing já na primeira migração (clients, cases, case_movements, tasks, documents, cnj_query_logs, organizations, users_profile) com RLS + GRANTs. Assim a Fase 2 só adiciona UI.

Padrão de isolamento:
- Função `security definer` `public.get_user_org(uuid)` retorna a `organization_id` do usuário logado.
- Toda policy: `organization_id = public.get_user_org(auth.uid())`.
- Trigger `on_auth_user_created` cria `organizations` + `users_profile` automaticamente no signup.

## Integração DataJud

Server function `consultarProcessoCNJ` (protegida por `requireSupabaseAuth`):
1. Valida número CNJ (regex 20 dígitos, formato NNNNNNN-DD.AAAA.J.TR.OOOO).
2. Resolve tribunal pelo segmento do número (TJSP, TRF, TST, etc.) → endpoint `api-publica.datajud.cnj.jus.br/api_publica_<tribunal>/_search`.
3. Faz POST autenticado com `Authorization: APIKey <CNJ_API_KEY>` (chave pública DataJud documentada — adiciono via `secrets--add_secret` com valor padrão público; usuário pode trocar).
4. Se falhar (timeout, 4xx/5xx, tribunal não suportado): retorna dados mock realistas e marca `source: 'mock'` em `case_movements`.
5. Persiste processo + movimentações, grava `cnj_query_logs`, atualiza `last_cnj_sync_at`.

Variáveis: `CNJ_API_BASE_URL`, `CNJ_API_KEY`, `CNJ_API_TIMEOUT` — comentadas no código.

## Rotas

```
/auth                     login + signup (uma tela, abas)
/onboarding               nome escritório, OAB, UF, área
/_authenticated/
  dashboard               cards + últimos andamentos + atalhos
  clientes                lista + busca
  clientes/novo
  clientes/$id            detalhe + processos vinculados
  processos               lista + filtros
  processos/novo          form + botão "Consultar no CNJ"
  processos/$id           dados + timeline de movimentações + botão "Atualizar"
  configuracoes           perfil + organização
```

Placeholders prontos (sem UI funcional na Fase 1): `/prazos`, `/documentos`.

## Componentes principais

- `AppSidebar` (shadcn sidebar, collapsible icon).
- `Topbar` com busca global (input — handler stub na Fase 1) e menu de perfil.
- `StatCard`, `MovementTimeline`, `CNJNumberInput` (com máscara + validação), `EmptyState`.
- `DisclaimerBanner` fixo: "As informações processuais exibidas devem ser conferidas nas fontes oficiais…"

## Segurança / LGPD

- RLS em todas as tabelas, `service_role` apenas em server functions.
- Chave CNJ nunca chega ao bundle do cliente (lida só no `.handler()`).
- `cnj_query_logs` registra usuário, processo, status, timestamp.
- Sem coleta de dados sensíveis além do necessário.

## Design

Fundo `oklch(0.99 0 0)`, primário azul-escuro sóbrio (`oklch(0.35 0.08 250)`), acento âmbar para alertas de prazo, tipografia Inter. Tabelas densas mas com respiro, badges de status (ativo/arquivado/suspenso), timeline vertical com bullets coloridos por tipo de movimentação.

## Ordem de implementação

1. Migração SQL completa (todas as tabelas + RLS + GRANTs + trigger de signup).
2. Auth (`/auth`) e gate `_authenticated`.
3. Onboarding.
4. Layout (sidebar + topbar + disclaimer).
5. CRUD Clientes.
6. CRUD Processos + server function `consultarProcessoCNJ` (DataJud + fallback mock).
7. Detalhe do processo com timeline de movimentações.
8. Dashboard com queries agregadas.
9. Configurações (editar perfil/organização).

## Fora do escopo desta entrega

Financeiro, peticionamento, assinatura digital, IA, mobile nativo, editor de documentos, calendário de prazos completo, busca global funcional, upload de documentos (Fase 2).

## O que você precisará fazer depois

- Trocar `CNJ_API_KEY` se quiser usar uma chave própria (a pública do DataJud já vem configurada).
- Revisar políticas RLS se adicionar novos papéis (hoje todos os usuários da org veem tudo da org).
