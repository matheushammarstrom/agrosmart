"use client";

import { Bar, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { climaPorFazenda, type Filtros } from "@/lib/agregacoes";
import { descricaoClima, formatarData, formatarDiaMes, formatarNumero, nomeRisco } from "@/lib/formatos";
import type { ClimaDiario, Talhao } from "@/lib/tipos";

import { CaixaTooltip, CartaoGrafico, Legenda, LinhaTooltip, Tabela } from "./ui";

const EIXO = { fill: "var(--tinta-3)", fontSize: 10 };

function media(valores: (number | null)[]) {
  const observados = valores.filter((valor): valor is number => valor !== null);
  return observados.length ? observados.reduce((a, b) => a + b, 0) / observados.length : null;
}

export function GraficoClima({
  clima,
  talhoes,
  filtros,
  inicio,
  fim,
  className,
}: {
  clima: ClimaDiario[];
  talhoes: Talhao[];
  filtros: Filtros;
  inicio: string;
  fim: string;
  className?: string;
}) {
  const climaAgrupado = climaPorFazenda(clima, filtros, inicio, fim);
  const fazendas = new Set(
    talhoes
      .filter((talhao) => !filtros.fazenda || talhao.fazenda_id === filtros.fazenda)
      .map((talhao) => talhao.fazenda_id),
  );
  climaAgrupado.forEach((_, fazenda) => fazendas.add(fazenda));
  const linhasPorFazenda = [...fazendas].map((fazenda) => {
    const dias = climaAgrupado.get(fazenda) ?? [];
    const dadosClimaticos = talhoes.find((talhao) => talhao.fazenda_id === fazenda);
    const riscosCalculados = dias.filter((dia) => dia.risco_requeima !== null).length;
    const diasRiscoAlto = dias.filter((dia) => dia.risco_requeima === "alto").length;
    const resumoDiasRisco =
      riscosCalculados === 0
        ? "Risco alto indisponível no período"
        : `${diasRiscoAlto} dias de risco alto${riscosCalculados < dias.length ? ` · calculado em ${riscosCalculados}/${dias.length} dias` : " no período"}`;
    const diasRiscoTabela =
      riscosCalculados === 0
        ? "indisponível"
        : riscosCalculados < dias.length
          ? `${diasRiscoAlto} (${riscosCalculados}/${dias.length} calculáveis)`
          : diasRiscoAlto;
    const riscoAtual =
      dadosClimaticos?.situacao_clima === "valido" ? dadosClimaticos.risco_requeima_atual : null;
    return { fazenda, dias, dadosClimaticos, riscosCalculados, diasRiscoAlto, resumoDiasRisco, diasRiscoTabela, riscoAtual };
  });
  const nomes = new Map(talhoes.map((talhao) => [talhao.fazenda_id, `${talhao.fazenda_nome} · ${talhao.municipio}/${talhao.uf}`]));

  return (
    <CartaoGrafico
      className={className}
      titulo="Clima no período"
      subtitulo="Observações diárias da fazenda. Relações com os resultados das inspeções são exploratórias."
      legenda={
        <Legenda
          itens={[
            { rotulo: "Umidade relativa (%)", cor: "var(--serie-requeima)" },
            { rotulo: "Dia com risco alto de requeima", cor: "var(--faixa-risco)" },
          ]}
        />
      }
      grafico={
        <div className="space-y-4">
          {linhasPorFazenda.map(({ fazenda, dias, resumoDiasRisco }) => {
            const serie = dias.map((dia) => ({ ...dia, faixa: dia.risco_requeima === "alto" ? 100 : null }));
            return (
              <div key={fazenda}>
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-medium text-tinta">{nomes.get(fazenda) ?? fazenda}</p>
                  <div className="flex items-center gap-2 text-xs text-tinta-2">
                    {resumoDiasRisco}

                  </div>
                </div>
                <p className="mb-2 text-xs text-tinta-3">
                  {dias.length > 0 && `${formatarData(dias[0].data)} a ${formatarData(dias[dias.length - 1].data)} · `}
                  Medidas disponíveis: umidade {dias.filter((d) => d.umidade_relativa_pct !== null).length}, temperatura {dias.filter((d) => d.temp_media_c !== null).length}, chuva {dias.filter((d) => d.precipitacao_mm !== null).length} de {inicio && fim ? Math.round((Date.parse(fim) - Date.parse(inicio)) / 86400000) + 1 : 0} dias do período.
                </p>
                {dias.length === 0 ? (
                  <p className="py-8 text-center text-xs text-tinta-3">Sem registros climáticos neste período.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={110}>
                    <ComposedChart data={serie} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap={0}>
                      <XAxis
                        dataKey="data"
                        tickFormatter={formatarDiaMes}
                        tick={EIXO}
                        axisLine={{ stroke: "var(--eixo)" }}
                        tickLine={false}
                        minTickGap={24}
                      />
                      <YAxis domain={[20, 100]} ticks={[40, 70, 100]} tick={EIXO} axisLine={false} tickLine={false} width={36} />
                      <ReferenceLine y={90} stroke="var(--eixo)" />
                      <Bar dataKey="faixa" fill="var(--faixa-risco)" isAnimationActive={false} />
                      <Line
                        dataKey="umidade_relativa_pct"
                        stroke="var(--serie-requeima)"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, stroke: "var(--superficie)", strokeWidth: 2 }}
                        isAnimationActive={false}
                      />
                      <Tooltip
                        filterNull={false}
                        cursor={{ stroke: "var(--eixo)" }}
                        content={({ active, payload }) => {
                          const dia = payload?.[0]?.payload as ClimaDiario | undefined;
                          if (!active || !dia) return null;
                          return (
                            <CaixaTooltip titulo={formatarData(dia.data)}>
                              <LinhaTooltip
                                cor="var(--serie-requeima)"
                                rotulo="Umidade relativa"
                                valor={dia.umidade_relativa_pct === null ? "—" : `${dia.umidade_relativa_pct}%`}
                              />
                              <LinhaTooltip
                                rotulo="Temperatura média"
                                valor={dia.temp_media_c === null ? "—" : `${dia.temp_media_c} °C`}
                              />
                              <LinhaTooltip
                                rotulo="Chuva"
                                valor={dia.precipitacao_mm === null ? "—" : `${dia.precipitacao_mm} mm`}
                              />
                              <LinhaTooltip rotulo="Risco de requeima" valor={`Risco ${nomeRisco(dia.risco_requeima)}`} />
                            </CaixaTooltip>
                          );
                        }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>
            );
          })}
        </div>
      }
      tabela={
        <Tabela
          colunas={[
            { rotulo: "Fazenda" },
            { rotulo: "Umidade média", numerica: true },
            { rotulo: "Temp. média", numerica: true },
            { rotulo: "Chuva total", numerica: true },
            { rotulo: "Dias de risco alto", numerica: true },
            { rotulo: "Clima na referência geral" },
            { rotulo: "Risco na referência geral" },
          ]}
          linhas={linhasPorFazenda.map(
            ({ fazenda, dias, dadosClimaticos, riscoAtual, diasRiscoTabela }) => {
              const umidade = media(dias.map((dia) => dia.umidade_relativa_pct));
              const temperatura = media(dias.map((dia) => dia.temp_media_c));
              const chuvas = dias
                .map((dia) => dia.precipitacao_mm)
                .filter((chuva): chuva is number => chuva !== null);
              return [
                nomes.get(fazenda) ?? fazenda,
                umidade === null ? "—" : `${umidade.toFixed(0)}%`,
                temperatura === null ? "—" : `${temperatura.toFixed(1)} °C`,
                chuvas.length === 0 ? "—" : `${formatarNumero(Math.round(chuvas.reduce((total, chuva) => total + chuva, 0)))} mm`,
                diasRiscoTabela,
                `${dadosClimaticos?.data_referencia ? formatarData(dadosClimaticos.data_referencia) + ": " : ""}${descricaoClima(dadosClimaticos?.situacao_clima, dadosClimaticos?.data_clima_disponivel)}`,
                nomeRisco(riscoAtual),
              ];
            },
          )}
        />
      }
    />
  );
}
