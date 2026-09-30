# Guia do grupo · AgroSmart Fase 2

Explicação de cada parte do projeto em linguagem simples, para que todos consigam apresentar e
responder perguntas sem precisar ler o código.

## Em uma frase

Fotos de folhas classificadas pelo modelo da Fase 1 viram arquivos CSV; o Databricks limpa esses
dados e calcula indicadores e alertas; um painel web mostra ao agricultor **o que está acontecendo**
em cada talhão e **o que fazer**.

## Onde está cada requisito do enunciado

| Requisito | Onde está |
| --- | --- |
| Painel interativo com dados simulados | `dashboard/` (painel web), dados em `dados/entrada/` |
| Quantidade de imagens analisadas | Primeiro indicador do painel |
| % de folhas saudáveis × doentes | Segundo indicador do painel |
| Frequência por tipo de praga ou anomalia | Gráfico "Frequência por tipo de anomalia" |
| Tendência por período e localidade | Gráfico "Evolução das anomalias", "Comparativo por localidade" e os filtros |
| Integração com base de dados + atualização simples | CSV enviado ao Databricks dispara o pipeline sozinho; o painel lê o resultado |
| Diferencial: pipeline ETL com Spark no Databricks | `pipeline/` (três notebooks e o job) |
| Vídeo | Roteiro em `docs/roteiro-video.md` |

## O caminho de um dado, passo a passo

Exemplo: 35 fotos tiradas hoje no talhão BV-03.

1. **Classificação:** `classificador/gerar_lote.py` usa o modelo da Fase 1 e gera um CSV com uma
   linha por foto: talhão, data, "saudável" ou "requeima" e a confiança.
2. **Envio:** o CSV é copiado para uma pasta do Databricks chamada *volume landing*
   (`pipeline/enviar_dados.sh`, ou pela interface do Databricks).
3. **Gatilho:** o Databricks percebe o arquivo novo e roda o job `agrosmart-pipeline` sozinho,
   cerca de um minuto depois.
4. **Bronze:** o arquivo é copiado como está para uma tabela. Nada é alterado.
5. **Silver:** os dados são limpos: tipos corrigidos, reenvios duplicados removidos e linhas
   inválidas separadas em uma tabela de quarentena.
6. **Gold:** os indicadores são calculados: fotos por dia e talhão, risco climático, situação de
   cada talhão e alertas com a ação recomendada.
7. **Painel:** ao clicar em *Atualizar*, o painel consulta as tabelas gold e mostra os números novos.

## Cada parte explicada

### Dados simulados (`dados/simulacao/gerar_dados.py`)

O enunciado pede dados simulados de campo. O gerador cria:

- **3 fazendas inventadas** em municípios que realmente produzem batata, cada uma com um clima
  diferente: Boa Vista (Bom Repouso/MG, frio e úmido), Santa Clara (Guarapuava/PR, chuvosa) e Três
  Irmãos (São Gotardo/MG, Cerrado seco). Isso permite comparar localidades.
- **12 talhões** (4 por fazenda), com cultivar, área e tipo de irrigação.
- **Inspeções** às segundas, quartas e sextas, de abril a setembro de 2026: cerca de 28 mil fotos
  classificadas como saudável, requeima, pinta-preta, vaquinha ou mosca-minadora.
- **Clima diário** de cada fazenda: temperatura, umidade e chuva.

Os dados **não são aleatórios**: o gerador tem eventos planejados para o painel contar uma
história, como uma semana de chuva em junho seguida de surto de requeima na Santa Clara e pragas
avançando no Cerrado em setembro. Ele também insere de propósito alguns registros duplicados e
inválidos, para a etapa de limpeza ter o que fazer. A *seed* fixa faz o gerador produzir sempre os
mesmos dados.

### Classificador e lotes novos (`classificador/`)

`script.py` é o classificador entregue na Fase 1, sem alterações. `gerar_lote.py` reaproveita o
mesmo modelo e gera o CSV no formato que o pipeline espera. O modelo da Fase 1 só reconhece folha
saudável e requeima; as outras anomalias aparecem apenas nos dados simulados.

### Pipeline no Databricks (`pipeline/`)

- **Databricks** é uma plataforma na nuvem para processar dados. Usamos a Free Edition.
- **Apache Spark** é o motor que processa os dados; escrevemos o código em Python (PySpark).
- **Delta Lake** é o formato das tabelas onde os dados ficam salvos (a nossa "base de dados").
- **Auto Loader** lê apenas os arquivos novos de cada execução, sem reprocessar os antigos.
- **Job** é a sequência de três notebooks (bronze → silver → gold), com um **gatilho de chegada de
  arquivo** que o dispara sozinho.
- **Bronze, silver e gold** são as camadas da "arquitetura medalhão": dado bruto, dado limpo e dado
  pronto para uso. Separar assim permite refazer a limpeza sem perder o dado original.
- `databricks.yml` descreve o job, as tabelas e as pastas como código. Um comando
  (`databricks bundle deploy`) cria tudo em qualquer workspace.

### Alertas e ações recomendadas (`pipeline/notebooks/03_agregacao_gold.py`)

Não é inteligência artificial: são duas regras simples, avaliadas nos últimos 7 dias.

| Alerta | Regra | Ação recomendada |
| --- | --- | --- |
| **Incidência** | Uma anomalia em 8% ou mais das fotos do talhão (alta a partir de 15%) | Texto por anomalia, definido no cadastro de anomalias |
| **Clima** | 3 ou mais dos últimos 5 dias com umidade ≥ 90% e temperatura média entre 10 e 25 °C | Fungicida preventivo na fazenda e evitar irrigação por aspersão no fim do dia |

O alerta de clima é o mais importante: a requeima se espalha com umidade alta e temperatura amena,
então o painel avisa **antes** de a doença aparecer nas fotos. O **status** de cada talhão segue as
mesmas regras: crítico com 15% ou mais de folhas com anomalia; atenção com 8% ou mais, ou com risco
climático alto.

### Painel (`dashboard/`)

- **Frontend:** Next.js (React com TypeScript), Tailwind CSS para o visual e Recharts para os
  gráficos. Tudo é filtrado no navegador: período, fazenda, talhão e anomalia.
- **Backend:** seis rotas em TypeScript, uma por tabela gold: `/api/ocorrencias`, `/api/clima`,
  `/api/talhoes`, `/api/alertas`, `/api/revisao` e `/api/cargas`. Elas rodam no servidor, consultam
  o Databricks pela API de SQL e devolvem os dados ao navegador, que chama as seis em paralelo. O
  token do Databricks fica só no servidor.
- **Snapshot:** uma cópia das tabelas gold em JSON (`dashboard/src/data/snapshot.json`). Se o
  Databricks não responder, as rotas devolvem essa cópia e o cabeçalho mostra "Databricks fora do
  ar", com a data da cópia.

| Seção do painel | Pergunta que responde |
| --- | --- |
| Indicadores | Quantas fotos analisamos e quanto da lavoura está com problema? |
| Alertas e ações | O que preciso fazer agora, e onde? |
| Situação dos talhões | Qual talhão está pior e está piorando ou melhorando? |
| Evolução das anomalias | Como os problemas mudaram ao longo da safra? |
| Frequência por tipo | Qual praga ou doença é mais comum? |
| Comparativo por localidade | Qual fazenda ou talhão tem mais problemas? |
| Clima e risco de requeima | O clima está favorecendo a requeima? |
| Fila de revisão | Quais fotos o modelo classificou com pouca certeza? |
| Cargas de dados | Quais arquivos entraram no pipeline e quantos registros foram descartados? |

## Tecnologias e linguagens

| Linguagem | Onde |
| --- | --- |
| Python | Gerador de dados, classificador, notebooks do pipeline (PySpark), scripts de apoio |
| SQL | Consultas do painel às tabelas gold |
| TypeScript | Painel (frontend) e as seis rotas `/api/...` (backend) |
| YAML e Bash | Definição do job (`databricks.yml`) e script de envio de arquivos |

## Perguntas prováveis e respostas

**Por que os dados são simulados?** O enunciado pede dados simulados. Usamos o modelo real da Fase 1
para os lotes novos e simulamos o histórico de seis meses, com clima e eventos plausíveis.

**Os limites dos alertas são validados?** Não. São simplificações baseadas no comportamento
conhecido da requeima (umidade alta e temperatura amena). Um uso real exigiria calibrar com um
agrônomo e dados de campo.

**Onde fica o banco de dados?** Nas tabelas Delta do Databricks, no schema `workspace.agrosmart`.
Os CSVs em `dados/entrada/` são a origem, e o snapshot é uma cópia das tabelas finais.

**É ETL ou ELT?** Carregamos o dado bruto primeiro (bronze) e transformamos dentro do Databricks
(silver e gold), o que se aproxima de um ELT na arquitetura medalhão.

**O que acontece se o Databricks estiver fora do ar?** O painel continua funcionando com o snapshot,
a última cópia das tabelas gold, e o cabeçalho mostra "Databricks fora do ar" com a data da cópia.

**Por que uma rota por tabela?** Cada rota tem uma responsabilidade só e pode ser consultada
separadamente. O navegador chama as seis em paralelo e faz os filtros localmente, então clicar num
filtro não gera consulta nova ao Databricks.

**Como o dado novo chega?** Um CSV novo no volume landing dispara o job sozinho. Não é preciso
mexer em código nem rodar nada manualmente.

**Por que um painel próprio em vez de uma ferramenta pronta?** O enunciado não define a ferramenta.
Um painel web tem link público, que qualquer pessoa abre sem instalar nada ou ter conta no
Databricks.

**O modelo detecta pinta-preta e vaquinha?** Não: o modelo da Fase 1 só distingue folha saudável de
requeima. As outras anomalias existem apenas nos dados simulados, representando o que um modelo
futuro, treinado com mais classes, poderia detectar.

## Limitações

- Dados de campo simulados; os números não representam lavouras reais.
- Limites de alerta simplificados, sem validação agronômica.
- O modelo da Fase 1 reconhece só uma doença e foi testado em imagens de laboratório.
