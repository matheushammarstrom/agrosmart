"use client";

import { ArrowRight } from "lucide-react";
import { resultadosPorLocal, resumirOrigens, type Filtros, type Resumo } from "@/lib/agregacoes";
import { ANOMALIAS, COR_ANOMALIA, NOME_ANOMALIA, formatarNumero, formatarPct } from "@/lib/formatos";
import type { OcorrenciaDiaria, Talhao } from "@/lib/tipos";
import { Cartao, Tabela } from "./ui";

export function ResumoInspecoes({ resumo }: { resumo: Resumo }) {
  const itens = [
    { rotulo: "Amostras analisadas", valor: formatarNumero(resumo.total), detalhe: "imagens de folhas no período" },
    { rotulo: "Folhas saudáveis", valor: resumo.total ? formatarPct(resumo.saudaveis / resumo.total, 1) : "—", detalhe: `${formatarNumero(resumo.saudaveis)} amostras` },
    { rotulo: "Folhas com problemas", valor: resumo.total ? formatarPct(resumo.comAnomalia / resumo.total, 1) : "—", detalhe: `${formatarNumero(resumo.comAnomalia)} amostras · doenças ou danos de pragas` },
  ];
  return <div className="grid gap-3 sm:grid-cols-3">{itens.map((item) =>
    <div key={item.rotulo} className="rounded-xl border border-borda bg-superficie p-5">
      <p className="text-sm text-tinta-2">{item.rotulo}</p>
      <p className="numeros-tabulares mt-2 text-3xl font-semibold">{item.valor}</p>
      <p className="mt-2 text-xs text-tinta-3">{item.detalhe}</p>
    </div>)}</div>;
}

export function ComparacaoFazendas({ ocorrencias, talhoes, filtros, inicio, fim, onExplorar }: {
  ocorrencias: OcorrenciaDiaria[]; talhoes: Talhao[]; filtros: Filtros; inicio: string; fim: string;
  onExplorar: (id: string) => void;
}) {
  const linhas = resultadosPorLocal(ocorrencias, talhoes, filtros, inicio, fim);
  return <Cartao titulo="Resultados por fazenda" subtitulo="Compare as amostras analisadas e explore os talhões de cada fazenda.">
    <p className="mb-3 text-xs text-tinta-3 sm:hidden">Deslize a comparação para ver os tipos e explorar a fazenda.</p><div className="overflow-x-auto"><table className="w-full text-left text-sm">
      <thead className="text-xs text-tinta-3"><tr>
        <th scope="col" className="pb-3 pr-6 font-medium">Fazenda / amostras</th>
        <th scope="col" className="pb-3 pr-6 font-medium">Saudáveis × com problemas</th>
        <th scope="col" className="pb-3 pr-6 font-medium">Tipos entre as amostras com problemas</th>
        <th scope="col" aria-label="Explorar fazenda" className="pb-3 font-medium" />
      </tr></thead>
      <tbody>{linhas.map(({ id, nome, resumo }) => <tr key={id} className="border-t border-borda">
        <td className="min-w-40 py-5 pr-6"><p className="font-semibold">{nome}</p><p className="mt-1 text-xs text-tinta-3">{formatarNumero(resumo.total)} amostras</p></td>
        <td className="min-w-60 py-5 pr-6">{resumo.total ? <>
          <div className="flex items-center justify-between gap-3 text-xs"><span>{formatarPct(resumo.saudaveis / resumo.total, 1)} saudáveis</span><span>{formatarPct(resumo.comAnomalia / resumo.total, 1)} com problemas</span></div>
          <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-emerald-100" aria-hidden><div className="ml-auto bg-amber-500" style={{ width: `${resumo.comAnomalia / resumo.total * 100}%` }} /></div>
        </> : <span className="text-xs text-tinta-3">Sem análises no período · —</span>}</td>
        <td className="min-w-72 py-5 pr-6">{resumo.comAnomalia ? <><div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">{ANOMALIAS.map((a) => <span key={a} className="flex items-center gap-1.5"><i className="size-2 shrink-0 rounded-sm" style={{ background: COR_ANOMALIA[a] }} aria-hidden />{NOME_ANOMALIA[a]} <b className="ml-auto font-medium">{formatarPct(resumo.porAnomalia[a] / resumo.comAnomalia, 1)}</b></span>)}</div><p className="mt-2 text-xs text-tinta-3">Base: {formatarNumero(resumo.comAnomalia)} amostras com problemas</p></> : <span className="text-xs text-tinta-3">{resumo.total ? "Nenhum problema nas amostras" : "Sem análises no período"}</span>}</td>
        <td className="py-5"><button type="button" aria-label={`Explorar ${nome}`} onClick={() => onExplorar(id)} className="inline-flex items-center gap-2 rounded-lg border border-borda px-3 py-2 text-xs font-medium hover:bg-superficie-2">Explorar <ArrowRight size={14} aria-hidden /></button></td>
      </tr>)}</tbody>
    </table></div>
  </Cartao>;
}

export function CaracteristicasTalhoes({ talhoes, filtros }: { talhoes: Talhao[]; filtros: Filtros }) {
  const selecionados = talhoes.filter((t) => t.fazenda_id === filtros.fazenda && (!filtros.talhao || t.talhao_id === filtros.talhao));
  return <Cartao titulo="Características dos talhões" subtitulo="Contexto de cultivo para acompanhar os resultados das inspeções.">
    <div className="overflow-auto"><Tabela colunas={[{ rotulo: "Talhão" }, { rotulo: "Cultivar" }, { rotulo: "Irrigação" }, { rotulo: "Área (ha)", numerica: true }]} linhas={selecionados.map((t) => [t.talhao_id, t.cultivar, t.sistema_irrigacao, formatarNumero(t.area_ha)])} /></div>
    <p className="mt-3 text-xs text-tinta-3">{selecionados[0]?.municipio}/{selecionados[0]?.uf} · O clima é medido por fazenda e compartilhado pelos talhões.</p>
  </Cartao>;
}

export function OrigemAmostras({ ocorrencias }: { ocorrencias: OcorrenciaDiaria[] }) {
  const origens = resumirOrigens(ocorrencias);
  return <p className="text-xs text-tinta-2">Origem das amostras no recorte: {formatarNumero(origens.simulado)} simuladas · {formatarNumero(origens.classificador_fase1)} classificadas pelo modelo{origens.nao_informada > 0 && ` · ${formatarNumero(origens.nao_informada)} com origem não informada`}.</p>;
}
