"use client";

import { Database, HardDrive, RefreshCw, Sprout, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  FILTROS_INICIAIS,
  calcularJanela,
  filtrarOcorrencias,
  resumir,
  type Filtros,
} from "@/lib/agregacoes";
import { ANOMALIAS, NOME_ANOMALIA, formatarData, formatarDataHora, type Anomalia } from "@/lib/formatos";
import type { DadosPainel } from "@/lib/tipos";

import { GraficoClima } from "./clima";
import { GraficoComparativo, GraficoFrequencia, GraficoTendencia } from "./graficos";
import { Indicadores } from "./indicadores";
import { TabelaCargas, TabelaRevisao } from "./operacao";
import { ListaAlertas, SituacaoTalhoes } from "./talhoes-alertas";

async function buscarPainel(forcar: boolean): Promise<DadosPainel | null> {
  const resposta = await fetch(`/api/painel${forcar ? "?atualizar=1" : ""}`, { cache: "no-store" }).catch(() => null);
  return resposta?.ok ? resposta.json().catch(() => null) : null;
}

const PERIODOS = [
  { dias: 7, rotulo: "7 dias" },
  { dias: 30, rotulo: "30 dias" },
  { dias: 90, rotulo: "90 dias" },
  { dias: 0, rotulo: "Safra" },
];

export function Painel({ inicial }: { inicial: DadosPainel }) {
  const [dados, setDados] = useState(inicial);
  const [carregando, setCarregando] = useState(true);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIAIS);

  useEffect(() => {
    let ativo = true;
    buscarPainel(false).then((novos) => {
      if (!ativo) return;
      if (novos) setDados(novos);
      setCarregando(false);
    });
    return () => {
      ativo = false;
    };
  }, []);

  async function atualizar() {
    setCarregando(true);
    const novos = await buscarPainel(true);
    if (novos) setDados(novos);
    setCarregando(false);
  }

  const janela = useMemo(() => calcularJanela(dados, filtros.periodo), [dados, filtros.periodo]);
  const ocorrencias = useMemo(
    () => filtrarOcorrencias(dados.ocorrencias, filtros, janela.inicio, janela.fim),
    [dados, filtros, janela],
  );
  const resumo = useMemo(() => resumir(ocorrencias, filtros), [ocorrencias, filtros]);
  const resumoAnterior = useMemo(
    () =>
      janela.anterior
        ? resumir(filtrarOcorrencias(dados.ocorrencias, filtros, janela.anterior.inicio, janela.anterior.fim), filtros)
        : null,
    [dados, filtros, janela],
  );

  return (
    <div className="min-h-screen">
      <Cabecalho dados={dados} carregando={carregando} onAtualizar={atualizar} />
      <BarraFiltros dados={dados} filtros={filtros} setFiltros={setFiltros} inicio={janela.inicio} fim={janela.fim} />

      <main
        className={`mx-auto max-w-7xl space-y-4 px-4 pt-4 pb-10 transition-opacity sm:px-6 ${
          carregando ? "opacity-80" : ""
        }`}
      >
        <Indicadores
          resumo={resumo}
          resumoAnterior={resumoAnterior}
          filtros={filtros}
          status={dados.status}
          periodo={filtros.periodo}
        />

        <div className="grid gap-4 lg:grid-cols-3">
          <ListaAlertas alertas={dados.alertas} status={dados.status} filtros={filtros} />
          <SituacaoTalhoes
            className="lg:col-span-2"
            status={dados.status}
            filtros={filtros}
            onSelecionar={(fazenda, talhao) =>
              setFiltros((atual) => ({ ...atual, fazenda, talhao: atual.talhao === talhao ? "" : talhao }))
            }
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <GraficoTendencia className="lg:col-span-2" ocorrencias={ocorrencias} filtros={filtros} />
          <GraficoFrequencia resumo={resumo} filtros={filtros} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <GraficoComparativo
            ocorrencias={dados.ocorrencias}
            status={dados.status}
            filtros={filtros}
            inicio={janela.inicio}
            fim={janela.fim}
          />
          <GraficoClima
            className="lg:col-span-2"
            clima={dados.clima}
            status={dados.status}
            filtros={filtros}
            inicio={janela.inicio}
            fim={janela.fim}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <TabelaRevisao revisao={dados.revisao} filtros={filtros} inicio={janela.inicio} fim={janela.fim} />
          <TabelaCargas cargas={dados.cargas} />
        </div>
      </main>

      <footer className="border-t border-borda px-4 py-6 text-center text-xs text-tinta-3">
        AgroSmart · FIAP Engenharia de Software · Grupo 5. Dados de campo simulados para fins acadêmicos, processados
        no Databricks (Apache Spark + Delta Lake).
      </footer>
    </div>
  );
}

function Cabecalho({
  dados,
  carregando,
  onAtualizar,
}: {
  dados: DadosPainel;
  carregando: boolean;
  onAtualizar: () => void;
}) {
  const aoVivo = dados.fonte === "databricks";
  const fazendas = new Set(dados.status.map((talhao) => talhao.fazenda_id)).size;
  const referencia = dados.status[0]?.data_referencia;

  return (
    <header className="border-b border-borda bg-superficie">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-superficie-2">
            <Sprout size={20} className="text-status-bom" aria-hidden />
          </span>
          <div>
            <h1 className="text-base font-semibold text-tinta">AgroSmart · Painel da lavoura</h1>
            <p className="text-xs text-tinta-2">
              {fazendas} fazendas · {dados.status.length} talhões de batata
              {referencia && ` · dados até ${formatarData(referencia)}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-borda px-2.5 py-1 text-xs text-tinta-2"
            title={dados.aviso}
          >
            {aoVivo ? (
              <Database size={13} className="text-status-bom" aria-hidden />
            ) : (
              <HardDrive size={13} className="text-tinta-3" aria-hidden />
            )}
            {carregando
              ? "Consultando o Databricks…"
              : aoVivo
                ? `Databricks · ao vivo (${formatarDataHora(dados.atualizadoEm)})`
                : `Snapshot local (${formatarDataHora(dados.atualizadoEm)})`}
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
  const fazendas = [...new Map(dados.status.map((t) => [t.fazenda_id, t])).values()];
  const talhoes = dados.status.filter((t) => !filtros.fazenda || t.fazenda_id === filtros.fazenda);
  const alterado = JSON.stringify(filtros) !== JSON.stringify(FILTROS_INICIAIS);

  return (
    <div className="sticky top-0 z-20 border-b border-borda bg-pagina/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-2.5 sm:px-6">
        <div className="flex rounded-lg border border-borda bg-superficie p-0.5" role="group" aria-label="Período">
          {PERIODOS.map((periodo) => (
            <button
              key={periodo.dias}
              type="button"
              aria-pressed={filtros.periodo === periodo.dias}
              onClick={() => setFiltros({ ...filtros, periodo: periodo.dias })}
              className={`rounded-md px-2.5 py-1 text-xs ${
                filtros.periodo === periodo.dias ? "bg-superficie-2 font-medium text-tinta" : "text-tinta-2 hover:text-tinta"
              }`}
            >
              {periodo.rotulo}
            </button>
          ))}
        </div>

        <select
          aria-label="Fazenda"
          className={CLASSE_SELECT}
          value={filtros.fazenda}
          onChange={(evento) => setFiltros({ ...filtros, fazenda: evento.target.value, talhao: "" })}
        >
          <option value="">Todas as fazendas</option>
          {fazendas.map((t) => (
            <option key={t.fazenda_id} value={t.fazenda_id}>
              {t.fazenda_nome} ({t.municipio}/{t.uf})
            </option>
          ))}
        </select>

        <select
          aria-label="Talhão"
          className={CLASSE_SELECT}
          value={filtros.talhao}
          onChange={(evento) => {
            const talhao = dados.status.find((t) => t.talhao_id === evento.target.value);
            setFiltros({ ...filtros, talhao: evento.target.value, fazenda: talhao?.fazenda_id ?? filtros.fazenda });
          }}
        >
          <option value="">Todos os talhões</option>
          {talhoes.map((t) => (
            <option key={t.talhao_id} value={t.talhao_id}>
              {t.talhao_id} · {t.cultivar}
            </option>
          ))}
        </select>

        <select
          aria-label="Anomalia"
          className={CLASSE_SELECT}
          value={filtros.anomalia}
          onChange={(evento) => setFiltros({ ...filtros, anomalia: evento.target.value as Anomalia | "" })}
        >
          <option value="">Todas as anomalias</option>
          {ANOMALIAS.map((anomalia) => (
            <option key={anomalia} value={anomalia}>
              {NOME_ANOMALIA[anomalia]}
            </option>
          ))}
        </select>

        {alterado && (
          <button
            type="button"
            onClick={() => setFiltros(FILTROS_INICIAIS)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-tinta-2 hover:text-tinta"
          >
            <X size={13} aria-hidden />
            Limpar filtros
          </button>
        )}

        {inicio && (
          <span className="ml-auto text-xs text-tinta-3">
            {formatarData(inicio)} a {formatarData(fim)}
          </span>
        )}
      </div>
    </div>
  );
}
