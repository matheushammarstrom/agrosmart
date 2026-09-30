"use client";

import { ChartColumn, CircleCheck, OctagonAlert, Table2, TriangleAlert } from "lucide-react";
import { useState, type ReactNode } from "react";

import { NOME_STATUS } from "@/lib/formatos";
import type { StatusTalhao } from "@/lib/tipos";

export function Cartao({
  titulo,
  subtitulo,
  acoes,
  children,
  className = "",
}: {
  titulo: string;
  subtitulo?: ReactNode;
  acoes?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-borda bg-superficie p-4 sm:p-5 ${className}`}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-tinta">{titulo}</h2>
          {subtitulo && <p className="mt-0.5 text-xs text-tinta-2">{subtitulo}</p>}
        </div>
        {acoes}
      </header>
      {children}
    </section>
  );
}

export function CartaoGrafico({
  titulo,
  subtitulo,
  legenda,
  grafico,
  tabela,
  className,
}: {
  titulo: string;
  subtitulo?: ReactNode;
  legenda?: ReactNode;
  grafico: ReactNode;
  tabela: ReactNode;
  className?: string;
}) {
  const [emTabela, setEmTabela] = useState(false);
  const acoes = (
    <div className="flex shrink-0 rounded-lg border border-borda p-0.5" role="group" aria-label="Formato de exibição">
      {[
        { valor: false, rotulo: "Gráfico", Icone: ChartColumn },
        { valor: true, rotulo: "Tabela", Icone: Table2 },
      ].map(({ valor, rotulo, Icone }) => (
        <button
          key={rotulo}
          type="button"
          aria-pressed={emTabela === valor}
          onClick={() => setEmTabela(valor)}
          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs ${
            emTabela === valor ? "bg-superficie-2 font-medium text-tinta" : "text-tinta-2 hover:text-tinta"
          }`}
        >
          <Icone size={13} aria-hidden />
          {rotulo}
        </button>
      ))}
    </div>
  );
  return (
    <Cartao titulo={titulo} subtitulo={subtitulo} acoes={acoes} className={className}>
      {!emTabela && legenda}
      {emTabela ? <div className="max-h-80 overflow-auto">{tabela}</div> : grafico}
    </Cartao>
  );
}

export function Legenda({ itens }: { itens: { rotulo: string; cor: string }[] }) {
  return (
    <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-tinta-2">
      {itens.map((item) => (
        <li key={item.rotulo} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: item.cor }} aria-hidden />
          {item.rotulo}
        </li>
      ))}
    </ul>
  );
}

const ESTILO_STATUS = {
  normal: { Icone: CircleCheck, cor: "var(--status-bom)" },
  atencao: { Icone: TriangleAlert, cor: "var(--status-atencao)" },
  critico: { Icone: OctagonAlert, cor: "var(--status-critico)" },
} as const;

export function ChipStatus({ status, rotulo }: { status: StatusTalhao; rotulo?: string }) {
  const { Icone, cor } = ESTILO_STATUS[status];
  return (
    <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-borda px-2 py-0.5 text-xs font-medium text-tinta">
      <Icone size={13} style={{ color: cor }} aria-hidden />
      {rotulo ?? NOME_STATUS[status]}
    </span>
  );
}

export function Tabela({
  colunas,
  linhas,
}: {
  colunas: { rotulo: string; numerica?: boolean }[];
  linhas: ReactNode[][];
}) {
  return (
    <table className="numeros-tabulares w-full text-left text-xs">
      <thead className="sticky top-0 bg-superficie text-tinta-3">
        <tr>
          {colunas.map((coluna) => (
            <th
              key={coluna.rotulo}
              scope="col"
              className={`border-b border-borda py-2 pr-3 font-medium ${coluna.numerica ? "text-right" : ""}`}
            >
              {coluna.rotulo}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="text-tinta-2">
        {linhas.map((linha, indice) => (
          <tr key={indice} className="border-b border-borda last:border-0">
            {linha.map((celula, coluna) => (
              <td key={coluna} className={`py-1.5 pr-3 ${colunas[coluna].numerica ? "text-right" : ""}`}>
                {celula}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function CaixaTooltip({ titulo, children }: { titulo: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-44 rounded-lg border border-borda bg-superficie px-3 py-2 text-xs shadow-lg">
      <p className="mb-1.5 font-medium text-tinta">{titulo}</p>
      <div className="space-y-1 text-tinta-2">{children}</div>
    </div>
  );
}

export function LinhaTooltip({ cor, rotulo, valor }: { cor?: string; rotulo: string; valor: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="inline-flex items-center gap-1.5">
        {cor && <span className="size-2 rounded-sm" style={{ background: cor }} aria-hidden />}
        {rotulo}
      </span>
      <span className="numeros-tabulares font-medium text-tinta">{valor}</span>
    </div>
  );
}
