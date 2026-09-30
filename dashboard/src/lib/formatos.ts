import type { StatusTalhao, TipoAnomalia } from "./tipos";

export const ANOMALIAS = ["requeima", "pinta_preta", "vaquinha", "mosca_minadora"] as const;
export type Anomalia = (typeof ANOMALIAS)[number];

export const NOME_ANOMALIA: Record<TipoAnomalia, string> = {
  saudavel: "Saudável",
  requeima: "Requeima",
  pinta_preta: "Pinta-preta",
  vaquinha: "Vaquinha",
  mosca_minadora: "Mosca-minadora",
};

export const GRUPO_ANOMALIA: Record<Anomalia, string> = {
  requeima: "doença",
  pinta_preta: "doença",
  vaquinha: "praga",
  mosca_minadora: "praga",
};

export const COR_ANOMALIA: Record<Anomalia, string> = {
  requeima: "var(--serie-requeima)",
  pinta_preta: "var(--serie-pinta-preta)",
  vaquinha: "var(--serie-vaquinha)",
  mosca_minadora: "var(--serie-mosca-minadora)",
};

export const NOME_STATUS: Record<StatusTalhao, string> = {
  normal: "Normal",
  atencao: "Atenção",
  critico: "Crítico",
};

const numero = new Intl.NumberFormat("pt-BR");

export function formatarNumero(valor: number) {
  return numero.format(valor);
}

export function formatarPct(valor: number | null | undefined, casas = 0) {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return "-";
  return `${(valor * 100).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}

export function formatarPontos(valor: number | null | undefined) {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return "-";
  const sinal = valor > 0 ? "+" : valor < 0 ? "−" : "";
  return `${sinal}${Math.abs(valor).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p.`;
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function formatarDiaMes(data: string) {
  const [, mes, dia] = data.split("-");
  return `${Number(dia)} ${MESES[Number(mes) - 1]}`;
}

export function formatarData(data: string) {
  const [ano, mes, dia] = data.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

export function formatarDataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
