# Painel AgroSmart

Painel web (Next.js + Recharts) com os indicadores das tabelas gold do pipeline.

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

## Navegação, métricas e filtros

- O panorama compara fazendas com quantidade analisada, saudáveis/com problemas e tipos de problema.
  **Explorar** abre o detalhe da fazenda; **Voltar ao panorama** preserva o período.
- No detalhe, selecionar um talhão filtra o resumo, a evolução, os tipos e a fila de revisão.
  O comparativo mantém os outros talhões da mesma fazenda; o clima pertence à fazenda.
- O período inicial é 30 dias, contados a partir da última análise disponível. Há presets de
  7/30/90 dias, **Todo o período** e intervalo personalizado inclusivo dentro das datas da base.
- Saudáveis/com problemas usam todas as amostras do local e período como denominador.
  Tipos de problema usam somente as amostras com problemas; a tabela também informa o percentual
  sobre todas as amostras. Ausência de análises é “—”, não saúde comprovada.
- A evolução mantém o gráfico empilhado por tipo: até 30 dias, por dia de inspeção; intervalos
  maiores, por semana. As semanas extremas podem ser parciais. As tabelas permitem consultar
  quantidade e percentuais sem depender de tooltip ou cor.
- **Dados e atualização** reúne origem das amostras, fila de revisão e cargas.
  A premissa de coleta e as limitações metodológicas estão no README da raiz.
  A revisão é filtrada por período/local e pode mostrar somente 12 linhas, com total explícito.
- O visual permanece claro mesmo quando o sistema operacional está em modo escuro.
- O histórico incluído é inteiramente simulado; os 200 resultados arquivados em
  `docs/fase1/resultados_fase1.csv` não alimentam o snapshot. Zero amostras classificadas pelo
  modelo é esperado até que um lote dessa origem seja incorporado. O classificador real da Fase 1 reconhece saudável/doente;
  a classe doente é mapeada para requeima no gerador de lotes, sem reconhecimento multiclasses.

## Verificação local

```bash
pnpm typecheck    # gera tipos de rotas do Next.js e verifica TypeScript
pnpm test        # agregações e componentes reais, com dados controlados e sem acesso ao Databricks
pnpm lint
```

Para conferir no navegador sem consultar o Databricks, mesmo com credenciais locais:

```bash
DATABRICKS_HOST= DATABRICKS_TOKEN= DATABRICKS_WAREHOUSE_ID= pnpm dev
```

O snapshot regenerado contém 28.316 análises válidas. Nos 30 dias iniciais: 4.766 amostras,
4.370 saudáveis e 396 com problemas. A soma por fazenda reconcilia com o panorama.

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

Cada rota guarda o resultado por 60 segundos. O parâmetro `?atualizar=1` pede uma nova consulta,
mas ainda reutiliza o cache quando a última consulta ocorreu há menos de 15 segundos.
O botão **Atualizar** apenas consulta dados: não envia lotes nem executa jobs.

## Fonte de dados

A página abre com o snapshot local (`src/data/snapshot.json`) e, em seguida, chama as seis rotas em
paralelo. As rotas leem o Databricks quando as variáveis de `.env.example` estão definidas. Se o
Databricks não responder, cada rota pode devolver sua tabela do snapshot com um aviso de erro.

O navegador só substitui o painel quando recebe seis respostas completas com fonte compatível.
Snapshots precisam ter a mesma data de geração. Resposta ausente, falha ou mistura de fontes
preserva integralmente o último conjunto completo e sinaliza a tentativa malsucedida no cabeçalho.
Um snapshot completo é aceito como **Snapshot local**, sem esconder avisos sobre a consulta ao vivo.

A fonte e a data pertencem ao conjunto exibido, não à última tentativa. No Databricks, a data
mostrada é a consulta mais antiga entre as seis respostas, inclusive resultados vindos do cache.
O resultado da última tentativa aparece separadamente; uma falha não recebe a indicação “ao vivo”.

**Garantia alcançada:** substituição completa no navegador, com uma única fonte e envelopes contendo
tabela e metadados válidos. As tabelas gold e suas APIs são atualizadas separadamente: mesmo seis
respostas do Databricks não comprovam a mesma execução do pipeline. Não há atomicidade distribuída,
versionamento de execução nem validação de consistência entre as linhas das tabelas.

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
