# Painel AgroSmart

Painel web (Next.js + Recharts) com os indicadores das tabelas gold do pipeline.

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

## API

O backend tem uma rota por tabela gold. Todas aceitam `GET` e devolvem
`{ fonte, atualizadoEm, erro?, dados }`.

| Rota | Tabela no Databricks |
| --- | --- |
| `/api/ocorrencias` | `gold_ocorrencias_diarias` |
| `/api/clima` | `gold_clima_diario` |
| `/api/talhoes` | `gold_status_talhoes` |
| `/api/alertas` | `gold_alertas` |
| `/api/revisao` | `gold_revisao` |
| `/api/cargas` | `gold_cargas` |

Cada rota guarda o resultado por 60 segundos. O parâmetro `?atualizar=1` força uma nova consulta,
no máximo uma a cada 15 segundos.

## Fonte de dados

A página abre com o snapshot local (`src/data/snapshot.json`) e, em seguida, chama as seis rotas em
paralelo. As rotas leem o Databricks quando as variáveis de `.env.example` estão definidas. Se o
Databricks não responder, cada rota devolve a tabela do snapshot e o cabeçalho mostra
"Databricks fora do ar", com a data da cópia exibida.

Para atualizar o snapshot com o estado atual do Databricks (usa o login do Databricks CLI):

```bash
python3 ../pipeline/exportar_snapshot.py
```

## Organização

| Arquivo | Conteúdo |
| --- | --- |
| `src/app/api/*/route.ts` | As seis rotas da API |
| `src/lib/dados.ts` | Consulta ao Databricks ou ao snapshot, cache e conversão de tipos (servidor) |
| `src/lib/databricks.ts` | Cliente da API de SQL do Databricks (servidor) |
| `src/lib/consultas.json` | Consultas às tabelas gold, compartilhadas com o exportador do snapshot |
| `src/lib/api.ts` | Chamada às seis rotas a partir do navegador |
| `src/lib/agregacoes.ts` | Filtros e agregações feitos no navegador |
| `src/components/` | Seções do painel |
