# Painel AgroSmart

Painel web (Next.js + Recharts) com os indicadores das tabelas gold do pipeline.

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

## Fonte de dados

A página abre com o snapshot local (`src/data/snapshot.json`) e, em seguida, consulta
`/api/painel`. Essa rota roda no servidor e lê as tabelas gold pela API de SQL do Databricks
quando as variáveis de `.env.example` estão definidas. Sem credenciais, ou se o Databricks não
responder, o painel continua com o snapshot e indica a fonte no cabeçalho.

Para atualizar o snapshot com o estado atual do Databricks (usa o login do Databricks CLI):

```bash
python3 ../pipeline/exportar_snapshot.py
```

## Organização

| Arquivo | Conteúdo |
| --- | --- |
| `src/app/api/painel/route.ts` | Rota que entrega os dados ao navegador |
| `src/lib/databricks.ts` | Cliente da API de SQL do Databricks (somente servidor) |
| `src/lib/dados.ts` | Escolha da fonte (Databricks ou snapshot) e conversão de tipos |
| `src/lib/consultas.json` | Consultas às tabelas gold, compartilhadas com o exportador do snapshot |
| `src/lib/agregacoes.ts` | Filtros e agregações feitos no navegador |
| `src/components/` | Seções do painel |
