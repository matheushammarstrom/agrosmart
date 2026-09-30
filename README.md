# AgroSmart

Projeto acadêmico do Grupo 5 (FIAP · Engenharia de Software · Aplicações de Machine Learning no
Agronegócio) para monitorar a sanidade de lavouras de batata a partir de imagens de folhas.

- **Fase 1:** classificador de imagens (folha saudável × requeima) treinado no Teachable Machine.
- **Fase 2:** pipeline de dados no Databricks e painel interativo para apoiar a decisão do agricultor.

**Painel publicado:** https://agrosmart-gray-eight.vercel.app

## Arquitetura da Fase 2

```
classificador (Fase 1) ──► lote CSV ──┐
simulador de campo ───────────────────┤
                                      ▼
                     Databricks · volume landing
                                      │  job agrosmart-pipeline (Spark + Delta)
                                      ▼
            bronze (bruto) ──► silver (limpo e validado) ──► gold (indicadores e alertas)
                                                                   │
                                                                   ▼
                                                           painel web (Next.js)
```

## Estrutura

| Pasta | Conteúdo |
| --- | --- |
| `classificador/` | Classificador da Fase 1 (`script.py`) e o gerador de lotes para o pipeline (`gerar_lote.py`). |
| `dados/simulacao/` | Gerador dos dados simulados de campo. |
| `dados/entrada/` | Arquivos CSV que alimentam o pipeline: análises, clima e cadastros. |
| `pipeline/` | Notebooks do Databricks e a definição do job (Databricks Asset Bundle). |
| `dashboard/` | Painel web. |
| `docs/` | Guia do grupo, contrato de dados, roteiro do vídeo e material da Fase 1. |

## Dados simulados

Três fazendas em regiões produtoras de batata (Bom Repouso/MG, Guarapuava/PR e São Gotardo/MG),
12 talhões e seis meses de monitoramento (abril a setembro de 2026): cerca de 28 mil imagens
classificadas, além do clima diário de cada fazenda.

```bash
python3 dados/simulacao/gerar_dados.py
```

O gerador usa apenas a biblioteca padrão do Python e uma seed fixa, então produz sempre os mesmos
arquivos. O formato de cada arquivo está em [`docs/contrato-de-dados.md`](docs/contrato-de-dados.md).

## Pipeline no Databricks

Requer o [Databricks CLI](https://docs.databricks.com/dev-tools/cli/install.html) autenticado no
workspace (`databricks auth login`). Na Free Edition, o catálogo padrão é `workspace`.

```bash
cd pipeline
databricks bundle deploy      # cria o schema, os volumes e o job agrosmart-pipeline
./enviar_dados.sh             # envia dados/entrada para o volume landing
```

O job tem um gatilho de chegada de arquivo: cerca de um minuto depois do envio, ele executa
sozinho as três etapas. Também dá para rodar manualmente com `databricks bundle run pipeline`.

| Etapa | Notebook | O que faz |
| --- | --- | --- |
| Ingestão | `01_ingestao_bronze.py` | Auto Loader lê só os arquivos novos e grava o conteúdo bruto em Delta. |
| Transformação | `02_transformacao_silver.py` | Tipagem, remoção de duplicatas, validação e quarentena de registros inválidos. |
| Agregação | `03_agregacao_gold.py` | Indicadores diários, situação dos talhões, alertas e ações recomendadas. |

## Painel

```bash
cd dashboard
pnpm install
pnpm dev
```

Sem credenciais, o painel usa o snapshot das tabelas gold (`dashboard/src/data/snapshot.json`).
Para ler o Databricks ao vivo, copie `dashboard/.env.example` para `dashboard/.env.local` e preencha
o host, um token de acesso e o ID do SQL warehouse. Detalhes em [`dashboard/README.md`](dashboard/README.md).

## Novos lotes do classificador

O classificador da Fase 1 roda com Python 3.11 e TensorFlow 2.13:

```bash
cd classificador
python3.11 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python gerar_lote.py lote_demo_bv03 --talhao BV-03 --data 2026-09-30
../pipeline/enviar_dados.sh analises lotes/<arquivo-gerado>.csv
```

O envio dispara o job, e o painel mostra o lote novo ao clicar em **Atualizar**. Para ensaiar a
demonstração de novo, `python3 pipeline/remover_lote.py <arquivo-gerado>.csv` desfaz o envio.
