
## Diagnóstico — o que já testei agora

| Item | Status | Observação |
|---|---|---|
| API DataJud online | ✅ | HTTP 200 em TJRS/TRF4/TRT4 com a chave pública padrão |
| Consulta por **número CNJ** | ✅ | Processo real 5067960-22.2025.8.21.0010 retornou classe, tribunal, órgão julgador e 57 movimentos |
| Sync automático (cron 6h) | ✅ | pg_cron + pg_net já agendados, endpoint `/api/public/hooks/cnj-sync` operacional |
| Notificações em tempo real | ✅ | Tabela `notifications` na publication `supabase_realtime` |
| Consulta em lote | ✅ | `consultarProcessosLote` com concorrência 3 + retry |
| **Busca por OAB** | ❌ | **Impossível na API pública** — ver abaixo |
| Aba "Partes & Advogados" com dados reais | ❌ | Sempre vazia quando `source=datajud` |

## Por que não dá pra buscar por OAB na API pública

Inspecionei o `_source` dos documentos do índice DataJud. Os campos disponíveis são apenas:

```text
numeroProcesso, classe, sistema, formato, tribunal, grau,
dataAjuizamento, movimentos, orgaoJulgador, assuntos, nivelSigilo
```

Não existe `partes` nem `advogados` no schema indexado. Testei 4 variações do campo (`numeroOAB`, `numero_oab`, `.keyword`, numérico) em 3 tribunais — todas retornaram `total: 0`. O CNJ deliberadamente não expõe dados pessoais na API pública (LGPD).

**Conclusão:** com a OAB/RS 084457 não é possível listar processos via DataJud. É uma limitação do CNJ, não do nosso código.

## Caminho para habilitar busca por OAB

A única forma é integrar com um **provedor pago** que faz raspagem/agregação dos sistemas de tribunais e expõe consulta por OAB. Opções principais no mercado BR:

| Provedor | Consulta por OAB | Preço aproximado | Observação |
|---|---|---|---|
| **Escavador API** | ✅ | a partir de ~R$ 200/mês | API REST estável, retorna partes e movimentações |
| **Judit.io** | ✅ | sob consulta, plano por volume | Foco em monitoramento automático |
| **Codilo** | ✅ | ~R$ 300/mês | Bem documentada |
| **Jusbrasil API** | ✅ | corporativo, sob consulta | Mais cara, dados mais ricos |

Recomendo **Escavador** como ponto de partida (custo-benefício e docs abertas: `https://api.escavador.com/docs/`).

## Plano de implementação (após escolha do provedor)

### 1. Setup do provedor (você faz)
- Criar conta no provedor escolhido
- Pegar o API token
- Me passar o token via secret (`ESCAVADOR_API_KEY` ou similar)

### 2. Schema do banco (1 migration)
- Tabela `oab_watches` — OABs monitoradas pelo escritório (uf, numero, lawyer_name, organization_id)
- Coluna `cases.discovered_via` — `manual | oab_search | sync`
- Coluna `cases.source_provider` — `datajud | escavador | mock`

### 3. Server functions (`src/lib/oab.functions.ts`)
- `buscarProcessosPorOAB({ uf, numero })` — chama o provedor, retorna lista de CNJs encontrados
- `importarProcessosPorOAB({ uf, numero, autoImport })` — busca + cria cases novos (skip duplicados), liga ao escritório
- `cadastrarOAB({ uf, numero, lawyerName })` — adiciona OAB ao monitoramento periódico

### 4. UI nova
- Em **Configurações** → seção "Minhas OABs monitoradas" (adicionar/remover)
- Em **Processos** → botão "Importar pela minha OAB" (modal com seletor de OAB + preview da lista)
- Indicador na lista de processos: badge "Descoberto via OAB"

### 5. Sync periódico estendido
- Estender o cron existente para também varrer cada `oab_watch` ativa
- Notificar quando aparecem **processos novos** vinculados à OAB (não só novas movimentações)

### 6. Fallback de partes/advogados
- Quando o provedor retornar partes/advogados, preencher `case_parties` e `case_lawyers` (a aba "Partes & Advogados" passa a mostrar dados reais — hoje só funciona em mock)

## O que decidir antes de implementar

1. **Qual provedor?** (Escavador, Judit, Codilo, Jusbrasil, ou outro)
2. **Importação automática ou manual?** Quando aparecer processo novo na sua OAB, ele deve entrar automaticamente no sistema ou ficar numa "caixa de entrada" pra você aprovar?
3. **Quantas OABs por escritório?** Apenas a sua, ou várias (sócios/associados)?

Enquanto isso o sistema atual funciona 100% para o fluxo: **cadastrar processo pelo número CNJ → sync automático traz movimentações reais do DataJud → notificações em tempo real**.
