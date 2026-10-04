"use client";

import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { ReactNode } from "react";

import type { Filtros, Resumo } from "@/lib/agregacoes";
import {
  ANOMALIAS,
  COR_ANOMALIA,
  NOME_ANOMALIA,
  formatarNumero,
  formatarPct,
  formatarPontos,
} from "@/lib/formatos";
import type { Talhao } from "@/lib/tipos";

function Indicador({ rotulo, valor, detalhe }: { rotulo: string; valor: ReactNode; detalhe?: ReactNode }) {
  return (
    <div className="rounded-xl border border-borda bg-superficie p-4">
      <p className="text-xs text-tinta-2">{rotulo}</p>
      <div className="mt-1 text-2xl font-semibold text-tinta">{valor}</div>
      {detalhe && <div className="mt-1 text-xs text-tinta-2">{detalhe}</div>}
    </div>
  );
}

function descreverVariacao(variacao: number) {
  if (Math.abs(variacao) < 0.005) return "estável";
  return `${variacao > 0 ? "+" : "−"}${formatarPct(Math.abs(variacao))}`;
}

function Variacao({ pontos, subirEhRuim = true }: { pontos: number; subirEhRuim?: boolean }) {
  const neutro = Math.abs(pontos) < 0.05;
  const ruim = subirEhRuim ? pontos > 0 : pontos < 0;
  const Icone = neutro ? Minus : pontos > 0 ? ArrowUp : ArrowDown;
  const cor = neutro ? "text-tinta-3" : ruim ? "text-texto-negativo" : "text-texto-positivo";
  return (
    <span className={`inline-flex items-center gap-0.5 font-medium ${cor}`}>
      <Icone size={12} aria-hidden />
      {formatarPontos(pontos)}
    </span>
  );
}

export function Indicadores({
  resumo,
  resumoAnterior,
  totalRevisao,
  filtros,
  talhoes,
  periodo,
}: {
  resumo: Resumo;
  resumoAnterior: Resumo | null;
  totalRevisao: number;
  filtros: Filtros;
  talhoes: Talhao[];
  periodo: number;
}) {
  const pctAnomalia = resumo.total ? resumo.comAnomalia / resumo.total : null;
  const pctSaudaveis = resumo.total ? resumo.saudaveis / resumo.total : null;
  const pctAnterior = resumoAnterior?.total ? resumoAnterior.comAnomalia / resumoAnterior.total : null;
  const rotuloAnomalia = filtros.anomalia ? NOME_ANOMALIA[filtros.anomalia].toLowerCase() : "anomalia";
  const comparacao = periodo ? `vs. ${periodo} dias anteriores` : "";

  const [maisFrequente, qtdMaisFrequente] = ANOMALIAS.map((a) => [a, resumo.porAnomalia[a]] as const).reduce(
    (maior, atual) => (atual[1] > maior[1] ? atual : maior),
  );

  const selecionados = talhoes.filter(
    (t) => (!filtros.fazenda || t.fazenda_id === filtros.fazenda) && (!filtros.talhao || t.talhao_id === filtros.talhao),
  );
  const criticos = selecionados.filter((t) => t.status === "critico").length;
  const atencao = selecionados.filter((t) => t.status === "atencao").length;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Indicador
        rotulo="Imagens analisadas"
        valor={formatarNumero(resumo.total)}
        detalhe={resumoAnterior?.total ? `${descreverVariacao(resumo.total / resumoAnterior.total - 1)} ${comparacao}` : "no período selecionado"}
      />

      <div className="col-span-2 rounded-xl border border-borda bg-superficie p-4 lg:col-span-1">
        <p className="text-xs text-tinta-2">Folhas saudáveis × com {rotuloAnomalia}</p>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-tinta">{pctSaudaveis === null ? "—" : formatarPct(pctSaudaveis)}</span>
          <span className="text-sm text-tinta-2">× {pctAnomalia === null ? "—" : formatarPct(pctAnomalia, 1)}</span>
        </div>
        <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-superficie-2" aria-hidden>
          <div className="h-full bg-tinta-2" style={{ width: `${(pctAnomalia ?? 0) * 100}%` }} />
        </div>
        {pctAnomalia !== null && pctAnterior !== null && (
          <p className="mt-1.5 text-xs text-tinta-2">
            Com {rotuloAnomalia}: <Variacao pontos={(pctAnomalia - pctAnterior) * 100} /> {comparacao}
          </p>
        )}
      </div>

      <Indicador
        rotulo="Anomalia mais frequente"
        valor={
          qtdMaisFrequente ? (
            <span className="inline-flex items-center gap-2">
              <span className="size-3 rounded-sm" style={{ background: COR_ANOMALIA[maisFrequente] }} aria-hidden />
              {NOME_ANOMALIA[maisFrequente]}
            </span>
          ) : (
            "-"
          )
        }
        detalhe={
          qtdMaisFrequente
            ? `${formatarNumero(qtdMaisFrequente)} imagens · ${formatarPct(qtdMaisFrequente / resumo.total, 1)} do total`
            : "nenhuma anomalia no período"
        }
      />

      <Indicador
        rotulo="Talhões em alerta (agora)"
        valor={
          <>
            {criticos + atencao}
            <span className="text-base font-normal text-tinta-2"> de {selecionados.length}</span>
          </>
        }
        detalhe={`${criticos} críticos · ${atencao} em atenção`}
      />

      <Indicador
        rotulo="Imagens para revisão"
        valor={formatarNumero(totalRevisao)}
        detalhe={`confiança abaixo de 80% · ${resumo.total ? formatarPct(totalRevisao / resumo.total, 1) : "—"}`}
      />
    </div>
  );
}
