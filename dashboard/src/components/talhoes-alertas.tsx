"use client";

import { ArrowDown, ArrowUp, Bug, CloudRain, TriangleAlert } from "lucide-react";

import { filtrarAlertas, type Filtros } from "@/lib/agregacoes";
import { COR_ANOMALIA, NOME_ANOMALIA, formatarData, formatarPct, formatarPontos, type Anomalia } from "@/lib/formatos";
import type { Alerta, RiscoRequeima, Talhao } from "@/lib/tipos";

import { Cartao, ChipStatus } from "./ui";

const ICONE_ALERTA = { clima: CloudRain, incidencia: Bug };
const NOME_RISCO: Record<RiscoRequeima, string> = { baixo: "baixo", moderado: "moderado", alto: "alto" };

export function ListaAlertas({ alertas, talhoes, filtros }: { alertas: Alerta[]; talhoes: Talhao[]; filtros: Filtros }) {
  const visiveis = filtrarAlertas(alertas, filtros);
  const nomes = new Map(talhoes.map((t) => [t.fazenda_id, t.fazenda_nome]));
  const referencia = alertas[0]?.data_referencia;

  return (
    <Cartao
      titulo={`Alertas e ações recomendadas (${visiveis.length})`}
      subtitulo={referencia ? `Situação em ${formatarData(referencia)}, com base nos últimos 7 dias` : undefined}
    >
      {visiveis.length === 0 ? (
        <p className="text-sm text-tinta-2">Nenhum alerta para o filtro selecionado.</p>
      ) : (
        <ul className="-mr-2 max-h-[34rem] space-y-3 overflow-y-auto pr-2">
          {visiveis.map((alerta) => {
            const Icone = ICONE_ALERTA[alerta.tipo] ?? TriangleAlert;
            return (
              <li
                key={`${alerta.tipo}-${alerta.fazenda_id}-${alerta.talhao_id}-${alerta.titulo}`}
                className="rounded-lg border border-borda p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="flex items-start gap-2 text-sm font-medium text-tinta">
                    <Icone size={16} className="mt-0.5 shrink-0 text-tinta-2" aria-hidden />
                    {alerta.titulo}
                  </p>
                  <ChipStatus
                    status={alerta.severidade === "alta" ? "critico" : "atencao"}
                    rotulo={alerta.severidade === "alta" ? "Alta" : "Média"}
                  />
                </div>
                <p className="mt-1 pl-6 text-xs text-tinta-3">
                  {nomes.get(alerta.fazenda_id)} · {alerta.talhao_id ?? "todos os talhões"}
                </p>
                <p className="mt-1.5 pl-6 text-xs text-tinta-2">{alerta.descricao}</p>
                <p className="mt-2 ml-6 rounded-md bg-superficie-2 px-2.5 py-1.5 text-xs text-tinta">
                  <span className="font-medium">O que fazer: </span>
                  {alerta.acao_recomendada}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Cartao>
  );
}

export function SituacaoTalhoes({
  talhoes,
  filtros,
  onSelecionar,
  className,
}: {
  talhoes: Talhao[];
  filtros: Filtros;
  onSelecionar: (fazenda: string, talhao: string) => void;
  className?: string;
}) {
  const fazendas = [...new Set(talhoes.map((t) => t.fazenda_id))].filter((f) => !filtros.fazenda || f === filtros.fazenda);

  return (
    <Cartao
      className={className}
      titulo="Situação atual dos talhões"
      subtitulo="Folhas com anomalia nos últimos 7 dias e variação em relação aos 7 dias anteriores. Clique em um talhão para filtrar o painel."
    >
      <div className="space-y-5">
        {fazendas.map((fazenda) => {
          const daFazenda = talhoes.filter((t) => t.fazenda_id === fazenda);
          const { fazenda_nome, municipio, uf, risco_requeima_atual } = daFazenda[0];
          return (
            <div key={fazenda}>
              <p className="mb-2 text-xs text-tinta-2">
                <span className="font-medium text-tinta">{fazenda_nome}</span> · {municipio}/{uf} · risco de requeima{" "}
                {NOME_RISCO[risco_requeima_atual ?? "baixo"]}
              </p>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {daFazenda.map((talhao) => (
                  <CartaoTalhao
                    key={talhao.talhao_id}
                    talhao={talhao}
                    selecionado={filtros.talhao === talhao.talhao_id}
                    onClick={() => onSelecionar(talhao.fazenda_id, talhao.talhao_id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Cartao>
  );
}

function CartaoTalhao({ talhao, selecionado, onClick }: { talhao: Talhao; selecionado: boolean; onClick: () => void }) {
  const variacao = talhao.variacao_pp ?? 0;
  const principal = talhao.anomalia_principal as Anomalia | null;
  const Seta = variacao > 0 ? ArrowUp : ArrowDown;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selecionado}
      className={`rounded-lg border p-3 text-left transition-colors hover:bg-superficie-2 ${
        selecionado ? "border-tinta-2 bg-superficie-2" : "border-borda"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-tinta">{talhao.talhao_id}</span>
        <ChipStatus status={talhao.status} />
      </div>
      <p className="mt-2 text-xl font-semibold text-tinta">
        {formatarPct(talhao.pct_doentes_7d)}
        <span className="ml-1 text-xs font-normal text-tinta-2">com anomalia</span>
      </p>
      {Math.abs(variacao) >= 0.1 && (
        <p className={`inline-flex items-center gap-0.5 text-xs font-medium ${variacao > 0 ? "text-texto-negativo" : "text-texto-positivo"}`}>
          <Seta size={12} aria-hidden />
          {formatarPontos(variacao)}
        </p>
      )}
      <dl className="mt-2 space-y-0.5 text-xs text-tinta-2">
        {principal && (
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-sm" style={{ background: COR_ANOMALIA[principal] }} aria-hidden />
            <dt className="sr-only">Principal anomalia</dt>
            <dd>
              {NOME_ANOMALIA[principal]} · {formatarPct(talhao.pct_anomalia_principal)}
            </dd>
          </div>
        )}
        <div className="text-tinta-3">
          {talhao.cultivar} · {talhao.area_ha} ha · {talhao.sistema_irrigacao}
        </div>
      </dl>
    </button>
  );
}
