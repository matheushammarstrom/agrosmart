# Roteiro do vídeo (≈ 3 min 30 s)

O enunciado pede de 2 a 4 minutos explicando **os indicadores do painel e como eles ajudam o
agricultor a decidir**. A tecnologia aparece só como contexto; o foco são as decisões.

Antes de gravar: abra o painel com o filtro padrão (90 dias), deixe o job do Databricks aberto em
outra aba e tenha o terminal pronto na pasta `classificador/`. Se já tiver ensaiado a demonstração,
remova o lote com `python3 pipeline/remover_lote.py <arquivo>.csv`.

| Tempo | Quem | Tela | Fala (resumo) |
| --- | --- | --- | --- |
| 0:00 a 0:20 | Integrante 1 | Painel, topo | O AgroSmart transforma fotos de folhas de batata em decisões. Monitoramos 12 talhões em 3 fazendas de regiões produtoras (Sul de Minas, Guarapuava e Cerrado mineiro). Os dados de campo são simulados; o classificador é o da Fase 1. |
| 0:20 a 0:50 | Integrante 2 | Job no Databricks → tabela "Cargas de dados" | Cada lote de fotos classificadas chega ao Databricks e dispara sozinho o pipeline: bronze guarda o dado bruto, silver limpa e valida (aqui, 12 registros inválidos foram para a quarentena e 40 reenvios duplicados foram descartados) e gold calcula indicadores e alertas. O painel lê o gold. |
| 0:50 a 1:25 | Integrante 3 | Indicadores e "Evolução das anomalias" (Safra) | Indicadores principais: fotos analisadas, % de folhas saudáveis × com anomalia e a anomalia mais frequente. Na evolução semanal aparecem os eventos da safra: requeima em maio na Boa Vista, o surto do fim de junho na Santa Clara (metade das folhas do SC-02) e o avanço de pragas no Cerrado em setembro. |
| 1:25 a 2:10 | Integrante 4 | "Clima e risco de requeima" + alerta de clima | **Decisão preventiva.** Em junho, a Santa Clara teve 9 dias seguidos de umidade acima de 90%; uma semana depois veio o surto. Agora a Boa Vista está com 5 de 5 dias favoráveis. As fotos ainda mostram pouca requeima (3 de 38 no BV-03), mas o painel já recomenda fungicida preventivo em toda a fazenda e evitar aspersão no fim do dia: agir **antes** de a doença se espalhar. |
| 2:10 a 2:40 | Integrante 1 | "Situação atual dos talhões" (clicar em TI-02 e TI-01) | **Controle direcionado.** Na Três Irmãos, pinta-preta em 20% das folhas do TI-02 e vaquinha em cerca de 14% do TI-01 e do TI-04. O controle vai só para esses talhões, economizando insumo nos demais. A Santa Clara, já recuperada do surto, está normal. |
| 2:40 a 3:15 | Integrante 2 | Terminal → Databricks → painel | **Dados novos.** Rodamos o classificador da Fase 1 sobre 35 fotos tiradas hoje no BV-03 e enviamos o lote. O job dispara sozinho; ao clicar em Atualizar, o lote aparece em "Cargas de dados", o BV-03 passa a **crítico** e surge o alerta "Requeima em 17% das folhas": a previsão do clima se confirmou. |
| 3:15 a 3:35 | Integrante 3 | Fila de revisão | Fotos com confiança abaixo de 80% vão para revisão de um agrônomo: o painel apoia a decisão, não substitui o profissional. Encerramento. |

## Dicas de gravação

- Grave a tela em 1080p com o navegador em tela cheia e zoom de 110% a 125% para os números ficarem legíveis.
- A demonstração ao vivo depende do gatilho do Databricks (cerca de 1 min) e do job (cerca de 3 min). Grave essa parte separada e corte a espera na edição.
- Suba o vídeo no YouTube como "não listado" e coloque o link em `docs/video.md` antes de gerar o zip.
