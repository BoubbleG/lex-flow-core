## Objetivo
Permitir acessar o app sem precisar fazer login, temporariamente, enquanto você desenvolve/testa.

## Abordagem
Criar um modo "dev bypass" que injeta uma sessão fake e desativa o gate de autenticação, sem remover o código de auth (para reativar facilmente depois).

### Mudanças

1. **`src/routes/_authenticated/route.tsx`** (gate de auth)
   - Comentar o `beforeLoad` que chama `supabase.auth.getUser()` e redireciona para `/auth`.
   - Manter o `AppShell` + `<Outlet />` para que as rotas filhas continuem renderizando.
   - Adicionar comentário `// TODO: reativar auth antes de produção`.

2. **`src/routes/index.tsx`** (home redirect)
   - Trocar o redirect condicional por redirect direto para `/dashboard`.

3. **Organização/perfil mock para queries**
   - As páginas (clientes, processos, dashboard) usam `get_user_org(auth.uid())` via RLS, então sem usuário logado as queries retornam vazio.
   - Solução: criar uma seed SQL com 1 organização demo + 1 user_profile demo vinculados a um UUID fixo (ex: `00000000-0000-0000-0000-000000000001`), e expor esse UUID via um helper `getCurrentUserId()` em `src/lib/auth-dev.ts` que todas as páginas usam.
   - Como RLS exige `auth.uid()` real, a alternativa mais simples é: **desativar RLS temporariamente** nas tabelas do app OU usar `supabaseAdmin` via server functions para ler/escrever.

### Recomendação
Vou pelo caminho mais simples e reversível:
- Desativar o gate de auth no layout `_authenticated`.
- Criar org + perfil demo seed.
- Criar server functions com `supabaseAdmin` para CRUD durante o modo dev, usando o UUID fixo como `organization_id`.

## Aviso
Esse modo é **só para desenvolvimento**. Antes de publicar:
- Reativar o `beforeLoad` no `_authenticated/route.tsx`.
- Remover seeds demo.
- Voltar a usar `requireSupabaseAuth` nas server functions.

## Perguntas
1. Confirma que é só para testar agora (vamos reverter antes de publicar)?
2. Quer que eu já popule a org demo com alguns clientes/processos de exemplo para ver o dashboard com dados?
