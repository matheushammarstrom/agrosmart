"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  anomaliasVisiveis,
  comparativoPorLocal,
  serieTendencia,
  type Filtros,
  type PontoTendencia,
  type Resumo,
} from "@/lib/agregacoes";
import {
  ANOMALIAS,
  COR_ANOMALIA,
  GRUPO_ANOMALIA,
  NOME_ANOMALIA,
  formatarDiaMes,
  formatarNumero,
  formatarPct,
} from "@/lib/formatos";
import type { OcorrenciaDiaria, Talhao } from "@/lib/tipos";

import { CaixaTooltip, CartaoGrafico, Legenda, LinhaTooltip, Tabela } from "./ui";

const EIXO = { fill: "var(--tinta-3)", fontSize: 11 };

export function GraficoTendencia({
  ocorrencias,
  filtros,
  className,
}: {
  ocorrencias: OcorrenciaDiaria[];
  filtros: Filtros;
  className?: string;
}) {
  const porSemana = filtros.periodo === 0 || filtros.periodo > 30;
  const serie = serieTendencia(ocorrencias, filtros, porSemana);
  const anomalias = anomaliasVisiveis(filtros);
  const rotuloPeriodo = (chave: string) => (porSemana ? `Semana de ${formatarDiaMes(chave)}` : formatarDiaMes(chave));

  return (
    <CartaoGrafico
      className={className}
      titulo="Evolução das anomalias"
      subtitulo={`Percentual das imagens com cada anomalia, ${porSemana ? "por semana" : "por dia de inspeção"}`}
      legenda={<Legenda itens={anomalias.map((a) => ({ rotulo: NOME_ANOMALIA[a], cor: COR_ANOMALIA[a] }))} />}
      grafico={
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={serie} margin={{ top: 4, right: 4, left: -8, bottom: 0 }} barCategoryGap="18%">
            <CartesianGrid vertical={false} stroke="var(--grade)" />
            <XAxis
              dataKey="chave"
              tickFormatter={formatarDiaMes}
              tick={EIXO}
              axisLine={{ stroke: "var(--eixo)" }}
              tickLine={false}
              minTickGap={18}
            />
            <YAxis
              tickFormatter={(valor: number) => formatarPct(valor)}
              tick={EIXO}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <Tooltip
              cursor={{ fill: "var(--superficie-2)" }}
              content={({ active, payload }) => {
                const ponto = payload?.[0]?.payload as PontoTendencia | undefined;
                if (!active || !ponto) return null;
                return (
                  <CaixaTooltip titulo={`${rotuloPeriodo(ponto.chave)} · ${formatarNumero(ponto.total)} imagens`}>
                    {[...anomalias].reverse().map((a) => (
                      <LinhaTooltip
                        key={a}
                        cor={COR_ANOMALIA[a]}
                        rotulo={NOME_ANOMALIA[a]}
                        valor={`${formatarPct(ponto[a], 1)} (${ponto[`qtd_${a}`]})`}
                      />
                    ))}
                  </CaixaTooltip>
                );
              }}
            />
            {anomalias.map((a, indice) => (
              <Bar
                key={a}
                dataKey={a}
                stackId="anomalias"
                fill={COR_ANOMALIA[a]}
                stroke="var(--superficie)"
                strokeWidth={1}
                radius={indice === anomalias.length - 1 ? [4, 4, 0, 0] : 0}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      }
      tabela={
        <Tabela
          colunas={[
            { rotulo: porSemana ? "Semana" : "Dia" },
            { rotulo: "Imagens", numerica: true },
            ...anomalias.map((a) => ({ rotulo: NOME_ANOMALIA[a], numerica: true })),
          ]}
          linhas={serie.map((ponto) => [
            rotuloPeriodo(ponto.chave),
            formatarNumero(ponto.total),
            ...anomalias.map((a) => formatarPct(ponto[a], 1)),
          ])}
        />
      }
    />
  );
}

export function GraficoFrequencia({ resumo, filtros }: { resumo: Resumo; filtros: Filtros }) {
  const totalAnomalias = ANOMALIAS.reduce((soma, a) => soma + resumo.porAnomalia[a], 0);
  const dados = ANOMALIAS.map((a) => ({
    anomalia: a,
    nome: NOME_ANOMALIA[a],
    qtd: resumo.porAnomalia[a],
    rotulo: `${formatarNumero(resumo.porAnomalia[a])} · ${formatarPct(resumo.porAnomalia[a] / (resumo.total || 1), 1)}`,
  })).sort((a, b) => b.qtd - a.qtd);

  return (
    <CartaoGrafico
      titulo="Frequência por tipo de anomalia"
      subtitulo={`${formatarNumero(totalAnomalias)} imagens com anomalia no período · % sobre todas as imagens`}
      grafico={
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={dados} layout="vertical" margin={{ top: 0, right: 92, left: 0, bottom: 0 }} barSize={22}>
            <XAxis type="number" hide domain={[0, "dataMax"]} />
            <YAxis
              type="category"
              dataKey="nome"
              width={104}
              tick={{ fill: "var(--tinta-2)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "var(--superficie-2)" }}
              content={({ active, payload }) => {
                const item = payload?.[0]?.payload as (typeof dados)[number] | undefined;
                if (!active || !item) return null;
                return (
                  <CaixaTooltip titulo={`${item.nome} (${GRUPO_ANOMALIA[item.anomalia]})`}>
                    <LinhaTooltip rotulo="Imagens" valor={formatarNumero(item.qtd)} />
                    <LinhaTooltip rotulo="Das imagens analisadas" valor={formatarPct(item.qtd / (resumo.total || 1), 1)} />
                    <LinhaTooltip rotulo="Das anomalias" valor={formatarPct(item.qtd / (totalAnomalias || 1), 1)} />
                  </CaixaTooltip>
                );
              }}
            />
            <Bar dataKey="qtd" radius={[0, 4, 4, 0]} isAnimationActive={false}>
              {dados.map((item) => (
                <Cell
                  key={item.anomalia}
                  fill={!filtros.anomalia || filtros.anomalia === item.anomalia ? COR_ANOMALIA[item.anomalia] : "var(--eixo)"}
                />
              ))}
              <LabelList dataKey="rotulo" position="right" style={{ fill: "var(--tinta-2)", fontSize: 11 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      }
      tabela={
        <Tabela
          colunas={[
            { rotulo: "Anomalia" },
            { rotulo: "Grupo" },
            { rotulo: "Imagens", numerica: true },
            { rotulo: "% das imagens", numerica: true },
            { rotulo: "% das anomalias", numerica: true },
          ]}
          linhas={dados.map((item) => [
            item.nome,
            GRUPO_ANOMALIA[item.anomalia],
            formatarNumero(item.qtd),
            formatarPct(item.qtd / (resumo.total || 1), 1),
            formatarPct(item.qtd / (totalAnomalias || 1), 1),
          ])}
        />
      }
    />
  );
}

export function GraficoComparativo({
  ocorrencias,
  talhoes,
  filtros,
  inicio,
  fim,
}: {
  ocorrencias: OcorrenciaDiaria[];
  talhoes: Talhao[];
  filtros: Filtros;
  inicio: string;
  fim: string;
}) {
  const linhas = comparativoPorLocal(ocorrencias, talhoes, filtros, inicio, fim).map((linha) => ({
    ...linha,
    ...linha.pct,
    rotulo: formatarPct(linha.pctComAnomalia, 1),
  }));
  const anomalias = anomaliasVisiveis(filtros);
  const nomeFazenda = talhoes.find((t) => t.fazenda_id === filtros.fazenda)?.fazenda_nome;

  return (
    <CartaoGrafico
      titulo={nomeFazenda ? `Comparativo entre talhões · ${nomeFazenda}` : "Comparativo por localidade"}
      subtitulo="Percentual das imagens com anomalia no período"
      legenda={<Legenda itens={anomalias.map((a) => ({ rotulo: NOME_ANOMALIA[a], cor: COR_ANOMALIA[a] }))} />}
      grafico={
        <ResponsiveContainer width="100%" height={Math.max(150, linhas.length * 34 + 20)}>
          <BarChart data={linhas} layout="vertical" margin={{ top: 0, right: 48, left: 0, bottom: 0 }} barSize={18}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="nome"
              width={nomeFazenda ? 52 : 92}
              tick={{ fill: "var(--tinta-2)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "var(--superficie-2)" }}
              content={({ active, payload }) => {
                const linha = payload?.[0]?.payload as (typeof linhas)[number] | undefined;
                if (!active || !linha) return null;
                return (
                  <CaixaTooltip titulo={`${linha.nome} · ${formatarNumero(linha.total)} imagens`}>
                    {[...anomalias].reverse().map((a) => (
                      <LinhaTooltip key={a} cor={COR_ANOMALIA[a]} rotulo={NOME_ANOMALIA[a]} valor={formatarPct(linha.pct[a], 1)} />
                    ))}
                  </CaixaTooltip>
                );
              }}
            />
            {anomalias.map((a, indice) => (
              <Bar
                key={a}
                dataKey={a}
                stackId="local"
                fill={COR_ANOMALIA[a]}
                stroke="var(--superficie)"
                strokeWidth={1}
                radius={indice === anomalias.length - 1 ? [0, 4, 4, 0] : 0}
                isAnimationActive={false}
              >
                {indice === anomalias.length - 1 && (
                  <LabelList dataKey="rotulo" position="right" style={{ fill: "var(--tinta-2)", fontSize: 11 }} />
                )}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      }
      tabela={
        <Tabela
          colunas={[
            { rotulo: nomeFazenda ? "Talhão" : "Fazenda" },
            { rotulo: "Imagens", numerica: true },
            { rotulo: "Com anomalia", numerica: true },
            ...anomalias.map((a) => ({ rotulo: NOME_ANOMALIA[a], numerica: true })),
          ]}
          linhas={linhas.map((linha) => [
            linha.nome,
            formatarNumero(linha.total),
            formatarPct(linha.pctComAnomalia, 1),
            ...anomalias.map((a) => formatarPct(linha.pct[a], 1)),
          ])}
        />
      }
    />
  );
}
