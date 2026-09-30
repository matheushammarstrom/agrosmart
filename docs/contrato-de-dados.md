# Contrato de dados

Este documento define o formato dos dados em cada etapa do pipeline. Ele é o acordo entre quem
gera os dados (simulador e classificador), quem os processa (pipeline no Databricks) e quem os
exibe (painel). Mudanças aqui precisam ser refletidas nas três partes.

Os dados vivem no Unity Catalog do Databricks, em `workspace.agrosmart`.

```
dados/entrada (CSV) ──► volume landing ──► bronze_* ──► silver_* ──► gold_* ──► painel
```

## 1. Entrada (volume `landing`)

Arquivos CSV com cabeçalho, UTF-8, separados por vírgula. **A ordem das colunas importa**: o
pipeline lê as colunas pela posição.

### `landing/analises/*.csv`: uma linha por imagem classificada

| Coluna | Exemplo | Descrição |
| --- | --- | --- |
| `id_imagem` | `b1c37544-e64c-…` | Identificador único da imagem. Reenvios repetem o id. |
| `nome_imagem` | `BV-04_20260601_0001.jpg` | Nome do arquivo de imagem. |
| `data_captura` | `2026-06-01 07:03:59` | Data e hora da captura (`yyyy-MM-dd HH:mm:ss`). |
| `talhao_id` | `BV-04` | Talhão onde a imagem foi capturada. |
| `origem` | `smartphone` | `smartphone` ou `drone`. |
| `categoria` | `saudavel` | `saudavel` ou `doente` (doença ou dano de praga). |
| `tipo_anomalia` | `requeima` | Código de `referencia/anomalias.csv`. |
| `confianca` | `0.9731` | Confiança do modelo, de 0 a 1. |
| `modelo_versao` | `agrosmart-v1` | Versão do modelo que classificou. |
| `fonte` | `simulado` | `simulado` ou `classificador_fase1`. |
| `lote_id` | `sim-2026-06` | Identificador do envio. |

### `landing/clima/*.csv`: uma linha por fazenda e dia

`data`, `fazenda_id`, `temp_min_c`, `temp_max_c`, `umidade_relativa_pct`, `precipitacao_mm`

### `landing/referencia/talhoes.csv` e `anomalias.csv`

Cadastros. São relidos por completo a cada execução.

- **talhoes**: `talhao_id`, `talhao_nome`, `fazenda_id`, `fazenda_nome`, `municipio`, `uf`,
  `latitude`, `longitude`, `area_ha`, `cultivar`, `sistema_irrigacao`
- **anomalias**: `codigo`, `nome`, `nome_cientifico`, `grupo` (`nenhum`, `doenca`, `praga`),
  `acao_recomendada`

## 2. Bronze: dado bruto

Tabelas Delta com o conteúdo dos arquivos, sem alteração (todas as colunas como texto), mais
`_arquivo_origem` e `_ingerido_em`. A ingestão usa **Auto Loader**: cada arquivo novo no volume é
lido uma única vez.

`bronze_analises`, `bronze_clima`, `bronze_talhoes`, `bronze_anomalias`

## 3. Silver: dado limpo e validado

Recalculada a partir do bronze a cada execução (idempotente).

| Tabela | Regras |
| --- | --- |
| `silver_analises` | Tipagem; remoção de duplicatas por `id_imagem`; enriquecida com `fazenda_id`, `grupo`, `data` e `baixa_confianca` (`confianca < 0.80`); `categoria` recalculada a partir de `tipo_anomalia`. |
| `silver_analises_quarentena` | Linhas rejeitadas e o `motivo_rejeicao`: data inválida, talhão desconhecido, anomalia desconhecida ou confiança fora do intervalo de 0 a 1. |
| `silver_clima` | Tipagem, `temp_media_c` e `dia_favoravel_requeima` (UR ≥ 90% e temperatura média entre 10 e 25 °C). |
| `silver_talhoes`, `silver_anomalias` | Cadastros tipados. |

## 4. Gold: dado pronto para o painel

A **data de referência** é a última data com análises. Janelas como "últimos 7 dias" são
contadas a partir dela, não do relógio, para o painel continuar coerente em qualquer dia.

| Tabela | Grão | Colunas principais |
| --- | --- | --- |
| `gold_ocorrencias_diarias` | dia × talhão × anomalia | `data`, `fazenda_id`, `talhao_id`, `tipo_anomalia`, `grupo`, `qtd_imagens`, `confianca_media`, `qtd_baixa_confianca` |
| `gold_clima_diario` | dia × fazenda | clima do dia, `dias_favoraveis_5d`, `risco_requeima` (`baixo`, `moderado`, `alto`) |
| `gold_status_talhoes` | talhão | cadastro + indicadores dos últimos 7 dias, variação em relação aos 7 anteriores, anomalia principal, risco climático e `status` (`normal`, `atencao`, `critico`) |
| `gold_alertas` | alerta | `tipo` (`incidencia`, `clima`), `severidade` (`alta`, `media`), `titulo`, `descricao`, `acao_recomendada` |
| `gold_revisao` | imagem | imagens com baixa confiança, para revisão manual |
| `gold_cargas` | arquivo | registros recebidos, válidos, em quarentena e duplicados por arquivo ingerido |

### Regras de negócio

| Regra | Limite |
| --- | --- |
| Risco de requeima | `alto`: 3+ dias favoráveis nos últimos 5 · `moderado`: 2 · `baixo`: 0 ou 1 |
| Alerta de incidência | anomalia com 8%+ das imagens do talhão em 7 dias (`alta` a partir de 15%) |
| Alerta de clima | risco de requeima `alto` na fazenda (vale para todos os talhões dela) |
| Revisão manual | imagens com confiança abaixo de 80% vão para `gold_revisao` |
| Status do talhão | `critico`: 15%+ de folhas com anomalia · `atencao`: 8%+ com anomalia ou risco de requeima alto |

## 5. Como entram dados novos

1. O classificador da Fase 1 processa uma pasta de imagens e grava um CSV no formato de
   `landing/analises`.
2. O CSV é enviado para o volume `landing/analises/` pela interface do Databricks ou pelo CLI.
3. O job `agrosmart-pipeline` roda (gatilho de chegada de arquivo ou execução manual) e
   atualiza bronze → silver → gold.
4. O painel lê as tabelas gold na próxima atualização.
