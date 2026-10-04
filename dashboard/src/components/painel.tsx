"use client";

import { ArrowLeft, CloudOff, Database, HardDrive, RefreshCw, Sprout } from "lucide-react";
import { useEffect, useMemo, useState, type SetStateAction } from "react";

import {
  FILTROS_INICIAIS,
  calcularJanela,
  dataReferencia,
  filtrarOcorrencias,
  filtrarRevisao,
  resumir,
  type Filtros,
} from "@/lib/agregacoes";
import { buscarPainel, type TentativaConsulta, type ResultadoConsultaPainel } from "@/lib/api";
import { formatarData, formatarDataHora } from "@/lib/formatos";
import type { DadosPainel } from "@/lib/tipos";

import { GraficoClima } from "./clima";
import { GraficoComparativo, GraficoFrequencia, GraficoTendencia } from "./graficos";
import { ComparacaoFazendas, ResumoInspecoes, CaracteristicasTalhoes, OrigemAmostras } from "./resultados";
import { TabelaCargas, TabelaRevisao } from "./operacao";


const PERIODOS = [
  { dias: 7, rotulo: "7 dias" },
  { dias: 30, rotulo: "30 dias" },
  { dias: 90, rotulo: "90 dias" },
  { dias: 0, rotulo: "Todo o período" },
];

interface EstadoPainel {
  dados: DadosPainel;
  tentativa: TentativaConsulta | null;
  filtros: Filtros;
  avisoPeriodo: string;
}

function receberConsulta(atual: EstadoPainel, consulta: ResultadoConsultaPainel): EstadoPainel {
  let filtros = atual.filtros;
  let avisoPeriodo = "";
  if (filtros.periodo === -1) {
    try {
      calcularJanela(consulta.dados, -1, filtros.inicio && filtros.fim ? { inicio: filtros.inicio, fim: filtros.fim } : undefined);
    } catch {
      filtros = { ...filtros, periodo: 30, inicio: undefined, fim: undefined };
      avisoPeriodo = "A cobertura da base mudou. Exibindo os últimos 30 dias disponíveis.";
    }
  }
  return { ...consulta, filtros, avisoPeriodo };
}

export function Painel({ inicial }: { inicial: DadosPainel }) {
  const [{ dados, tentativa, filtros, avisoPeriodo }, setPainel] = useState<EstadoPainel>({
    dados: inicial, tentativa: null, filtros: FILTROS_INICIAIS, avisoPeriodo: "",
  });
  const [carregando, setCarregando] = useState(true);
  function setFiltros(alteracao: SetStateAction<Filtros>) {
    setPainel((atual) => ({ ...atual, filtros: typeof alteracao === "function" ? alteracao(atual.filtros) : alteracao, avisoPeriodo: "" }));
  }

  useEffect(() => {
    let ativo = true;
    buscarPainel(inicial, false).then((novos) => {
      if (!ativo) return;
      setPainel((atual) => receberConsulta(atual, novos));
      setCarregando(false);
    });
    return () => {
      ativo = false;
    };
  }, [inicial]);

  async function atualizar() {
    setCarregando(true);
    const consulta = await buscarPainel(dados, true);
    setPainel((atual) => receberConsulta(atual, consulta));
    setCarregando(false);
  }

  const janela = useMemo(() => calcularJanela(dados, filtros.periodo, filtros.inicio && filtros.fim ? { inicio: filtros.inicio, fim: filtros.fim } : undefined), [dados, filtros.periodo, filtros.inicio, filtros.fim]);
  const ocorrencias = useMemo(
    () => filtrarOcorrencias(dados.ocorrencias, filtros, janela.inicio, janela.fim),
    [dados, filtros, janela],
  );
  const resumo = useMemo(() => resumir(ocorrencias, filtros), [ocorrencias, filtros]);
  const revisao = useMemo(
    () => filtrarRevisao(dados.revisao, filtros, janela.inicio, janela.fim),
    [dados.revisao, filtros, janela],
  );
  const fazenda = dados.talhoes.find((t) => t.fazenda_id === filtros.fazenda);

  return (
    <div className="min-h-screen">
      <Cabecalho dados={dados} tentativa={tentativa} carregando={carregando} onAtualizar={atualizar} />
      <BarraFiltros dados={dados} filtros={filtros} setFiltros={setFiltros} inicio={janela.inicio} fim={janela.fim} />

      <main className={`mx-auto max-w-7xl space-y-5 px-4 pt-6 pb-10 sm:px-6 ${carregando ? "opacity-80" : ""}`}>
        <div>
          {fazenda && <button type="button" onClick={() => setFiltros((atual) => ({ ...atual, fazenda: "", talhao: "", anomalia: "" }))} className="mb-3 inline-flex items-center gap-1.5 text-sm text-tinta-2 hover:underline"><ArrowLeft size={15} aria-hidden />Voltar ao panorama</button>}
          <h2 className="text-2xl font-semibold tracking-tight">{fazenda ? fazenda.fazenda_nome : "Panorama das fazendas"}</h2>
          <p className="mt-1 text-sm text-tinta-2">{fazenda ? "Explore os resultados por talhão e acompanhe sua evolução." : "Acompanhe os resultados das inspeções e compare as fazendas."}</p>
        </div>
        {avisoPeriodo && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-tinta">{avisoPeriodo}</p>}
        <ResumoInspecoes resumo={resumo} />
        {!resumo.total && <p role="status" className="rounded-xl border border-borda bg-superficie p-5 text-sm">Sem análises no período selecionado.</p>}
        {fazenda ? <>
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="talhao" className="text-sm font-medium">Talhão</label>
            <select id="talhao" value={filtros.talhao} className={CLASSE_SELECT} onChange={(e) => setFiltros({ ...filtros, talhao: e.target.value })}>
              <option value="">Todos os talhões</option>
              {dados.talhoes.filter((t) => t.fazenda_id === filtros.fazenda).map((t) => <option key={t.talhao_id} value={t.talhao_id}>{t.talhao_id} · {t.cultivar}</option>)}
            </select>
            <span className="text-xs text-tinta-3">Resumo, evolução e tipos acompanham esta seleção.</span>
          </div>
          <div className="grid items-start gap-5 lg:grid-cols-3">
            <GraficoComparativo ocorrencias={dados.ocorrencias} talhoes={dados.talhoes} filtros={filtros} inicio={janela.inicio} fim={janela.fim} />
            {resumo.total > 0 && <GraficoTendencia className="lg:col-span-2" ocorrencias={ocorrencias} filtros={filtros} />}
          </div>
          <div className="grid items-start gap-5 lg:grid-cols-3">
            <GraficoFrequencia resumo={resumo} filtros={filtros} />
            <GraficoClima className="lg:col-span-2" clima={dados.clima} talhoes={dados.talhoes} filtros={filtros} inicio={janela.inicio} fim={janela.fim} />
          </div>
          <CaracteristicasTalhoes talhoes={dados.talhoes} filtros={filtros} />
        </> : <ComparacaoFazendas ocorrencias={dados.ocorrencias} talhoes={dados.talhoes} filtros={filtros} inicio={janela.inicio} fim={janela.fim} onExplorar={(id) => setFiltros((atual) => ({ ...atual, fazenda: id, talhao: "" }))} />}
        <p className="text-xs leading-relaxed text-tinta-3">Dados simulados. Percentuais calculados sobre as folhas analisadas.</p>
        <details className="rounded-xl border border-borda bg-superficie p-4 sm:p-5">
          <summary className="cursor-pointer text-sm font-medium">Dados e atualização</summary>
          <div className="mt-4 space-y-4">
            <OrigemAmostras ocorrencias={ocorrencias} />
            <p className="text-xs text-tinta-2">Atualizar consulta os dados mais recentes disponíveis.</p>
            <div className="grid items-start gap-5 lg:grid-cols-2"><TabelaRevisao imagens={revisao} /><TabelaCargas cargas={dados.cargas} /></div>
          </div>
        </details>
      </main>

      <footer className="border-t border-borda px-4 py-6 text-center text-xs text-tinta-3">
        AgroSmart · Inspeções de folhas de batata
      </footer>
    </div>
  );
}

function Cabecalho({
  dados,
  tentativa,
  carregando,
  onAtualizar,
}: {
  dados: DadosPainel;
  tentativa: TentativaConsulta | null;
  carregando: boolean;
  onAtualizar: () => void;
}) {
  const aoVivo = dados.fonte === "databricks";
  const hora = formatarDataHora(dados.atualizadoEm);
  const fazendas = new Set(dados.talhoes.map((talhao) => talhao.fazenda_id)).size;
  const referencia = dataReferencia(dados);

  return (
    <header className="border-b border-borda bg-superficie">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-superficie-2">
            <Sprout size={20} className="text-status-bom" aria-hidden />
          </span>
          <div>
            <h1 className="text-base font-semibold text-tinta">AgroSmart · Inspeções de folhas</h1>
            <p className="text-xs text-tinta-2">
              {fazendas} fazendas · {dados.talhoes.length} talhões de batata
              {referencia && ` · dados até ${formatarData(referencia)}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            aria-label="Fonte dos dados"
            className="inline-flex items-center gap-1.5 rounded-full border border-borda px-2.5 py-1 text-xs text-tinta-2"
          >
            {aoVivo ? (
              <Database size={13} className="text-status-bom" aria-hidden />
            ) : (
              <HardDrive size={13} className="text-tinta-3" aria-hidden />
            )}
            {aoVivo ? `Dados do Databricks (consulta mais antiga: ${hora})` : `Snapshot local (${hora})`}
          </span>
          <button
            type="button"
            onClick={onAtualizar}
            disabled={carregando}
            className="inline-flex items-center gap-1.5 rounded-lg border border-borda px-2.5 py-1 text-xs font-medium text-tinta hover:bg-superficie-2 disabled:opacity-60"
          >
            <RefreshCw size={13} className={carregando ? "animate-spin" : ""} aria-hidden />
            Atualizar
          </button>
        </div>
      </div>
      <div className="mx-auto max-w-7xl space-y-1 px-4 pb-3 text-xs text-tinta-2 sm:px-6">
        <p role={!carregando && tentativa?.erro ? "alert" : "status"}>
          {carregando ? (
            "Consultando dados…"
          ) : tentativa?.status === "preservada" ? (
            <><CloudOff size={13} className="mr-1 inline text-status-atencao" aria-hidden />Última consulta falhou; conjunto anterior preservado. {tentativa.erro}</>
          ) : tentativa?.erro ? (
            <>Conjunto completo recebido; aviso da consulta ao vivo: {tentativa.erro}</>
          ) : tentativa ? (
            "Última consulta: conjunto completo recebido."
          ) : (
            "Snapshot inicial exibido."
          )}
        </p>

      </div>
    </header>
  );
}

const CLASSE_SELECT =
  "rounded-lg border border-borda bg-superficie px-2.5 py-1.5 text-xs text-tinta focus:outline-2 focus:outline-offset-1";

function BarraFiltros({
  dados,
  filtros,
  setFiltros,
  inicio,
  fim,
}: {
  dados: DadosPainel;
  filtros: Filtros;
  setFiltros: (filtros: Filtros) => void;
  inicio: string;
  fim: string;
}) {
  const limites = calcularJanela(dados, 0);
  const [inicioCustom, setInicioCustom] = useState("");
  const [fimCustom, setFimCustom] = useState("");
  const [erro, setErro] = useState("");
  function aplicarIntervalo() {
    try {
      calcularJanela(dados, -1, { inicio: inicioCustom, fim: fimCustom });
      setFiltros({ ...filtros, periodo: -1, inicio: inicioCustom, fim: fimCustom });
      setErro("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Intervalo inválido.");
    }
  }
  return (
    <div className="border-b border-borda bg-superficie">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <span className="text-xs font-medium text-tinta-2">Período</span>
        <div className="flex flex-wrap rounded-lg border border-borda p-0.5" role="group" aria-label="Período">
          {PERIODOS.map((periodo) => <button key={periodo.dias} type="button" aria-pressed={filtros.periodo === periodo.dias} onClick={() => { setFiltros({ ...filtros, periodo: periodo.dias }); setErro(""); }} className={`rounded-md px-3 py-1.5 text-xs ${filtros.periodo === periodo.dias ? "bg-emerald-50 font-semibold text-emerald-800" : "text-tinta-2 hover:bg-superficie-2"}`}>{periodo.rotulo}</button>)}
        </div>
        <details className="text-xs">
          <summary className="cursor-pointer rounded-lg border border-borda px-3 py-2">Personalizado{filtros.periodo === -1 ? " · ativo" : ""}</summary>
          <div className="mt-2 flex flex-wrap items-end gap-2 rounded-lg border border-borda bg-superficie p-3">
            <label className="grid gap-1">Data inicial<input type="date" className={CLASSE_SELECT} min={limites.inicio} max={limites.fim} value={inicioCustom} onChange={(e) => setInicioCustom(e.target.value)} /></label>
            <label className="grid gap-1">Data final<input type="date" className={CLASSE_SELECT} min={limites.inicio} max={limites.fim} value={fimCustom} onChange={(e) => setFimCustom(e.target.value)} /></label>
            <button type="button" disabled={!limites.fim} onClick={aplicarIntervalo} className="rounded-lg bg-emerald-700 px-3 py-2 font-medium text-white disabled:opacity-50">Aplicar intervalo</button>
            {erro && <p role="alert" className="w-full text-texto-negativo">{erro}</p>}
          </div>
        </details>
        {inicio && <span className="ml-auto text-xs text-tinta-3">{formatarData(inicio)} a {formatarData(fim)}</span>}
      </div>
    </div>
  );
}
