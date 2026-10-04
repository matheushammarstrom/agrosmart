# AgroSmart

Projeto acadêmico do Grupo 5 (FIAP · Engenharia de Software · Aplicações de Machine Learning no
Agronegócio) para monitorar a sanidade de lavouras de batata a partir de imagens de folhas.

- **Fase 1:** classificador de imagens (folha saudável × folha doente) treinado no Teachable Machine.
- **Fase 2:** pipeline de dados no Databricks e painel interativo para apoiar a decisão do agricultor.

**Painel publicado anteriormente:** https://agrosmart-gray-eight.vercel.app

A versão revista nesta entrega deve ser executada a partir deste pacote. A atualização do site publicado é uma etapa separada.

## Arquitetura da integração Databricks

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

## Dados simulados

Três fazendas em regiões produtoras de batata (Bom Repouso/MG, Guarapuava/PR e São Gotardo/MG),
12 talhões e seis meses de monitoramento (abril a setembro de 2026): 28.368 registros simulados
de análises de imagens, além do clima diário de cada fazenda. Após a limpeza, são 28.316 análises
válidas, 12 registros em quarentena e 40 duplicados removidos. Esses registros não correspondem
a 28 mil fotografias fornecidas com o projeto.

```bash
python3 dados/simulacao/gerar_dados.py
```

Premissa do cenário acadêmico: inspeções periódicas nos talhões, com folhas amostradas em diferentes
pontos sem selecionar apenas aquelas com sintomas. Cada folha amostrada gera uma imagem.
Os percentuais descrevem essas amostras, não a população de plantas. O simulador não demonstra
representatividade em campo. As curvas e o clima são simulados e não comprovam causalidade.
O modelo real da Fase 1 distingue saudável/doente; os tipos adicionais do histórico são simulados.

O gerador usa apenas a biblioteca padrão do Python e uma seed fixa, então produz sempre os mesmos
arquivos. O formato de cada arquivo está em `docs/contrato-de-dados.md`.

## Origem das classificações e limites

O histórico inicial incluído é **inteiramente simulado**. Os 200 resultados originais da Fase 1
estão preservados em `docs/fase1/resultados_fase1.csv`, como evidência da etapa anterior, e não
foram incorporados à base do painel. Por isso, mesmo em **Todo o período**, o snapshot incluído
mostra zero amostras classificadas pelo modelo. Esse número conta registros da base, não arquivos
arquivados de outras etapas.

O reaproveitamento da Fase 1 acontece pelo modelo, pelas imagens de teste e pelo gerador de
novos lotes. `classificador/gerar_lote.py` produz registros com `fonte=classificador_fase1`;
esses registros só aparecem no painel depois de entrar no pipeline e atualizar sua base.
Data, talhão e origem de captura atribuídos às imagens de teste são contexto de demonstração,
não metadados reais de campo. Incorporar o CSV arquivado exigiria atribuir esse contexto
simulado explicitamente; não há importação automática dos 200 resultados.

Relações entre clima, cultivar, irrigação e classificações apoiam investigação; não comprovam
causalidade nem determinam tratamento. As heurísticas de alertas do pipeline são acadêmicas,
sem validação agronômica, e não são apresentadas como prescrições na interface atual.

## Pipeline no Databricks

Requer o [Databricks CLI](https://docs.databricks.com/dev-tools/cli/install.html) autenticado no
workspace (`databricks auth login`). Na Free Edition, o catálogo padrão é `workspace`.

```bash
cd pipeline
databricks bundle deploy      # cria o schema, os volumes e o job agrosmart-pipeline
./enviar_dados.sh             # envia dados/entrada para o volume landing
```

O job está configurado com um gatilho de chegada de arquivo para executar as três etapas.
Também dá para rodar manualmente com `databricks bundle run pipeline`. A execução remota e
a latência do gatilho não foram verificadas nesta revisão; a validação disponível é local.

| Etapa | Notebook | O que faz |
| --- | --- | --- |
| Ingestão | `01_ingestao_bronze.py` | Auto Loader lê só os arquivos novos e grava o conteúdo bruto em Delta. |
| Transformação | `02_transformacao_silver.py` | Tipagem, remoção de duplicatas, validação e quarentena de registros inválidos. |
| Agregação | `03_agregacao_gold.py` | Indicadores diários, situação dos talhões e heurísticas de alertas. |

## Painel

```bash
cd dashboard
pnpm install
pnpm dev
```

Sem credenciais, o painel usa o snapshot das tabelas gold (`dashboard/src/data/snapshot.json`).
Para ler o Databricks ao vivo, copie `dashboard/.env.example` para `dashboard/.env.local` e preencha
o host, um token de acesso e o ID do SQL warehouse. Detalhes em [`dashboard/README.md`](dashboard/README.md).

## Atualização local sem credenciais

O JSON incluído funciona sem Databricks. Para acrescentar análises, coloque um CSV no formato do
contrato em `dados/entrada/analises/` e regenere o snapshot:

```bash
# Na raiz do projeto; requer Python 3.10+ e Java 17+ disponíveis no PATH
python3 -m venv .venv
.venv/bin/pip install -r pipeline/requirements-test.txt
.venv/bin/python pipeline/gerar_snapshot_local.py
```

O comando executa as transformações silver e gold dos mesmos notebooks em Spark local, atualiza
as seis tabelas do JSON e substitui o arquivo somente após concluir. Não conecta ao Databricks.
IDs repetidos são deduplicados; registros inválidos ficam em quarentena. Reexecutar o comando
não acrescenta contagens duplicadas. No painel em `pnpm dev`, recarregue a página após a geração.
Em produção, refaça `pnpm build` e reinicie `pnpm start`: o JSON é incorporado ao build.

A origem `simulado`/`classificador_fase1` é preservada nas ocorrências e exibida em **Dados e
atualização**. O script aceita `--entrada <pasta>` e `--saida <arquivo>` para ensaios isolados.

## Vídeo da entrega

Vídeo final de aproximadamente 2min43s:

https://drive.google.com/file/d/1aT2Z9dgdCa0_D5qXOgNc9f1Q2Ilvzpbq/view?usp=sharing

## Novos lotes do classificador

O ambiente original do classificador foi verificado com Python 3.9 e TensorFlow 2.13.1.
Use um ambiente separado do Spark local (que exige Python 3.10+):

```bash
cd classificador
python3.9 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python gerar_lote.py lote_demo_bv03 --talhao BV-03 --data 2026-09-30
../pipeline/enviar_dados.sh analises lotes/<arquivo-gerado>.csv
```

Para usar o lote sem Databricks, copie o CSV gerado para `dados/entrada/analises/` e execute
o comando de atualização local descrito acima, a partir da raiz.

Na integração Databricks, o envio alimenta o gatilho configurado. Após o término do job, **Atualizar** consulta as tabelas e aplica apenas um conjunto
completo e compatível; não envia lotes nem executa jobs e respeita o intervalo mínimo de 15 segundos entre consultas manuais por tabela. O cache normal
é de 60 segundos. As tabelas são consultadas separadamente: fonte compatível não comprova
que vieram da mesma execução do pipeline.
O script `pipeline/remover_lote.py` remove um lote remoto e recalcula as tabelas; ele é uma
operação destrutiva de manutenção, não uma etapa necessária para executar o painel.
