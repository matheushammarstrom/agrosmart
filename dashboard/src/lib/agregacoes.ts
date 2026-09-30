import { ANOMALIAS, type Anomalia } from "./formatos";
import type { Alerta, ClimaDiario, DadosPainel, OcorrenciaDiaria, Talhao } from "./tipos";

export interface Filtros {
  periodo: number;
  fazenda: string;
  talhao: string;
  anomalia: Anomalia | "";
}

export const FILTROS_INICIAIS: Filtros = { periodo: 90, fazenda: "", talhao: "", anomalia: "" };

export interface Janela {
  inicio: string;
  fim: string;
  anterior: { inicio: string; fim: string } | null;
}

export function somarDias(data: string, dias: number) {
  const resultado = new Date(`${data}T00:00:00Z`);
  resultado.setUTCDate(resultado.getUTCDate() + dias);
  return resultado.toISOString().slice(0, 10);
}

function inicioDaSemana(data: string) {
  const dia = new Date(`${data}T00:00:00Z`).getUTCDay();
  return somarDias(data, -((dia + 6) % 7));
}

export function dataReferencia(dados: DadosPainel) {
  return dados.ocorrencias.reduce((maior, linha) => (linha.data > maior ? linha.data : maior), "");
}

export function calcularJanela(dados: DadosPainel, periodo: number): Janela {
  const fim = dataReferencia(dados);
  if (!fim || periodo === 0) {
    const inicio = dados.ocorrencias.reduce((menor, linha) => (linha.data < menor ? linha.data : menor), fim);
    return { inicio, fim, anterior: null };
  }
  const inicio = somarDias(fim, -(periodo - 1));
  return { inicio, fim, anterior: { inicio: somarDias(inicio, -periodo), fim: somarDias(inicio, -1) } };
}

function noLocal<T extends { fazenda_id: string; talhao_id?: string | null }>(linha: T, filtros: Filtros) {
  if (filtros.fazenda && linha.fazenda_id !== filtros.fazenda) return false;
  if (filtros.talhao && linha.talhao_id && linha.talhao_id !== filtros.talhao) return false;
  return true;
}

function entre(data: string, inicio: string, fim: string) {
  return data >= inicio && data <= fim;
}

function agrupar<T>(linhas: T[], chave: (linha: T) => string) {
  const grupos = new Map<string, T[]>();
  for (const linha of linhas) {
    const k = chave(linha);
    const grupo = grupos.get(k);
    if (grupo) grupo.push(linha);
    else grupos.set(k, [linha]);
  }
  return grupos;
}

export function filtrarOcorrencias(ocorrencias: OcorrenciaDiaria[], filtros: Filtros, inicio: string, fim: string) {
  return ocorrencias.filter((linha) => noLocal(linha, filtros) && entre(linha.data, inicio, fim));
}

export interface Resumo {
  total: number;
  saudaveis: number;
  comAnomalia: number;
  baixaConfianca: number;
  porAnomalia: Record<Anomalia, number>;
}

export function resumir(linhas: OcorrenciaDiaria[], filtros: Filtros): Resumo {
  const porAnomalia = Object.fromEntries(ANOMALIAS.map((anomalia) => [anomalia, 0])) as Record<Anomalia, number>;
  let total = 0;
  let saudaveis = 0;
  let baixaConfianca = 0;
  for (const linha of linhas) {
    total += linha.qtd_imagens;
    baixaConfianca += linha.qtd_baixa_confianca;
    if (linha.tipo_anomalia === "saudavel") saudaveis += linha.qtd_imagens;
    else porAnomalia[linha.tipo_anomalia] += linha.qtd_imagens;
  }
  const comAnomalia = filtros.anomalia ? porAnomalia[filtros.anomalia] : total - saudaveis;
  return { total, saudaveis, comAnomalia, baixaConfianca, porAnomalia };
}

export function anomaliasVisiveis(filtros: Filtros): readonly Anomalia[] {
  return filtros.anomalia ? [filtros.anomalia] : ANOMALIAS;
}

export type PontoTendencia = { chave: string; total: number } & Partial<Record<Anomalia, number>> &
  Partial<Record<`qtd_${Anomalia}`, number>>;

export function serieTendencia(linhas: OcorrenciaDiaria[], filtros: Filtros, porSemana: boolean) {
  const grupos = agrupar(linhas, (linha) => (porSemana ? inicioDaSemana(linha.data) : linha.data));
  return [...grupos.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([chave, grupo]) => {
      const resumo = resumir(grupo, filtros);
      const ponto: PontoTendencia = { chave, total: resumo.total };
      for (const anomalia of anomaliasVisiveis(filtros)) {
        ponto[anomalia] = resumo.porAnomalia[anomalia] / resumo.total;
        ponto[`qtd_${anomalia}`] = resumo.porAnomalia[anomalia];
      }
      return ponto;
    });
}

export interface LinhaComparativo {
  id: string;
  nome: string;
  total: number;
  pctComAnomalia: number;
  pct: Partial<Record<Anomalia, number>>;
}

export function comparativoPorLocal(
  ocorrencias: OcorrenciaDiaria[],
  status: Talhao[],
  filtros: Filtros,
  inicio: string,
  fim: string,
): LinhaComparativo[] {
  const porTalhao = Boolean(filtros.fazenda);
  const linhas = ocorrencias.filter(
    (linha) => (!filtros.fazenda || linha.fazenda_id === filtros.fazenda) && entre(linha.data, inicio, fim),
  );
  const grupos = agrupar(linhas, (linha) => (porTalhao ? linha.talhao_id : linha.fazenda_id));
  const nomes = new Map(
    status.map((talhao) =>
      porTalhao ? [talhao.talhao_id, talhao.talhao_id] : [talhao.fazenda_id, talhao.fazenda_nome.replace(/^Fazenda /, "")],
    ),
  );
  return [...grupos.entries()]
    .map(([id, grupo]) => {
      const resumo = resumir(grupo, filtros);
      const pct = Object.fromEntries(
        anomaliasVisiveis(filtros).map((anomalia) => [anomalia, resumo.porAnomalia[anomalia] / resumo.total]),
      );
      return { id, nome: nomes.get(id) ?? id, total: resumo.total, pctComAnomalia: resumo.comAnomalia / resumo.total, pct };
    })
    .sort((a, b) => b.pctComAnomalia - a.pctComAnomalia);
}

export function climaPorFazenda(clima: ClimaDiario[], filtros: Filtros, inicio: string, fim: string) {
  const linhas = clima.filter(
    (linha) => (!filtros.fazenda || linha.fazenda_id === filtros.fazenda) && entre(linha.data, inicio, fim),
  );
  return agrupar(linhas, (linha) => linha.fazenda_id);
}

const ORDEM_SEVERIDADE = { alta: 0, media: 1 };
const ORDEM_TIPO = { clima: 0, incidencia: 1 };

export function filtrarAlertas(alertas: Alerta[], filtros: Filtros) {
  return alertas
    .filter((alerta) => noLocal(alerta, filtros))
    .sort(
      (a, b) =>
        ORDEM_SEVERIDADE[a.severidade] - ORDEM_SEVERIDADE[b.severidade] ||
        ORDEM_TIPO[a.tipo] - ORDEM_TIPO[b.tipo] ||
        (a.talhao_id ?? "").localeCompare(b.talhao_id ?? ""),
    );
}
