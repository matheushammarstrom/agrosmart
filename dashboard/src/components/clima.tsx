"use client";

import { Bar, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { climaPorFazenda, type Filtros } from "@/lib/agregacoes";
import { formatarData, formatarDiaMes, formatarNumero } from "@/lib/formatos";
import type { ClimaDiario, RiscoRequeima, StatusTalhao, Talhao } from "@/lib/tipos";

import { CaixaTooltip, CartaoGrafico, ChipStatus, Legenda, LinhaTooltip, Tabela } from "./ui";

const EIXO = { fill: "var(--tinta-3)", fontSize: 10 };
const STATUS_DO_RISCO: Record<RiscoRequeima, StatusTalhao> = { baixo: "normal", moderado: "atencao", alto: "critico" };
const NOME_RISCO: Record<RiscoRequeima, string> = { baixo: "Risco baixo", moderado: "Risco moderado", alto: "Risco alto" };

function media(valores: number[]) {
  return valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : 0;
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
  const porFazenda = [...climaPorFazenda(clima, filtros, inicio, fim).entries()];
  const nomes = new Map(talhoes.map((t) => [t.fazenda_id, `${t.fazenda_nome} · ${t.municipio}/${t.uf}`]));

  return (
    <CartaoGrafico
      className={className}
      titulo="Clima e risco de requeima"
      subtitulo="Umidade relativa diária. A requeima é favorecida por umidade ≥ 90% com temperatura média entre 10 e 25 °C; 3 desses dias em 5 indicam risco alto."
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
          {porFazenda.map(([fazenda, dias]) => {
            const riscoAtual = dias[dias.length - 1]?.risco_requeima ?? "baixo";
            const diasRisco = dias.filter((d) => d.risco_requeima === "alto").length;
            const serie = dias.map((d) => ({ ...d, faixa: d.risco_requeima === "alto" ? 100 : null }));
            return (
              <div key={fazenda}>
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-medium text-tinta">{nomes.get(fazenda)}</p>
                  <div className="flex items-center gap-2 text-xs text-tinta-2">
                    {diasRisco} dias de risco alto no período
                    <ChipStatus status={STATUS_DO_RISCO[riscoAtual]} rotulo={`Hoje: ${NOME_RISCO[riscoAtual].toLowerCase()}`} />
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={110}>
                  <ComposedChart data={serie} margin={{ top: 4, right: 4, left: -16, bottom: 0 }} barCategoryGap={0}>
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
                      cursor={{ stroke: "var(--eixo)" }}
                      content={({ active, payload }) => {
                        const dia = payload?.[0]?.payload as ClimaDiario | undefined;
                        if (!active || !dia) return null;
                        return (
                          <CaixaTooltip titulo={formatarData(dia.data)}>
                            <LinhaTooltip cor="var(--serie-requeima)" rotulo="Umidade relativa" valor={`${dia.umidade_relativa_pct}%`} />
                            <LinhaTooltip rotulo="Temperatura média" valor={`${dia.temp_media_c} °C`} />
                            <LinhaTooltip rotulo="Chuva" valor={`${dia.precipitacao_mm} mm`} />
                            <LinhaTooltip rotulo="Risco de requeima" valor={NOME_RISCO[dia.risco_requeima]} />
                          </CaixaTooltip>
                        );
                      }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
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
            { rotulo: "Risco hoje" },
          ]}
          linhas={porFazenda.map(([fazenda, dias]) => [
            nomes.get(fazenda),
            `${media(dias.map((d) => d.umidade_relativa_pct)).toFixed(0)}%`,
            `${media(dias.map((d) => d.temp_media_c)).toFixed(1)} °C`,
            `${formatarNumero(Math.round(dias.reduce((s, d) => s + d.precipitacao_mm, 0)))} mm`,
            dias.filter((d) => d.risco_requeima === "alto").length,
            NOME_RISCO[dias[dias.length - 1]?.risco_requeima ?? "baixo"],
          ])}
        />
      }
    />
  );
}
