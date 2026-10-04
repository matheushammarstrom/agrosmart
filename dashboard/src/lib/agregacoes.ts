import { ANOMALIAS, type Anomalia } from "./formatos";
import type { Alerta, ClimaDiario, DadosPainel, ImagemRevisao, OcorrenciaDiaria, Talhao } from "./tipos";

export interface Filtros {
  periodo: number;
  fazenda: string;
  talhao: string;
  anomalia: Anomalia | "";
  inicio?: string;
  fim?: string;
}

export const FILTROS_INICIAIS: Filtros = { periodo: 30, fazenda: "", talhao: "", anomalia: "" };

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

export function calcularJanela(dados: DadosPainel, periodo: number, intervalo?: { inicio: string; fim: string }): Janela {
  const fim = dataReferencia(dados);
  if (fim && periodo === -1) {
    const primeira = dados.ocorrencias.reduce((menor, linha) => linha.data < menor ? linha.data : menor, fim);
    if (!intervalo || !/^\d{4}-\d{2}-\d{2}$/.test(intervalo.inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(intervalo.fim)
      || intervalo.inicio < primeira || intervalo.fim > fim || intervalo.inicio > intervalo.fim
      || !Number.isFinite(Date.parse(intervalo.inicio)) || !Number.isFinite(Date.parse(intervalo.fim))
      || new Date(intervalo.inicio).toISOString().slice(0, 10) !== intervalo.inicio
      || new Date(intervalo.fim).toISOString().slice(0, 10) !== intervalo.fim) {
      throw new Error("Escolha um intervalo válido dentro das datas disponíveis.");
    }
    return { ...intervalo, anterior: null };
  }
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

export function filtrarRevisao(revisao: ImagemRevisao[], filtros: Filtros, inicio: string, fim: string) {
  return revisao.filter(
    (imagem) =>
      noLocal(imagem, filtros) &&
      entre(imagem.data, inicio, fim) &&
      (!filtros.anomalia || imagem.tipo_anomalia === filtros.anomalia),
  );
}

export interface Resumo {
  total: number;
  saudaveis: number;
  comAnomalia: number;
  porAnomalia: Record<Anomalia, number>;
}

export function resumir(linhas: OcorrenciaDiaria[], filtros: Filtros): Resumo {
  const porAnomalia = Object.fromEntries(ANOMALIAS.map((anomalia) => [anomalia, 0])) as Record<Anomalia, number>;
  let total = 0;
  let saudaveis = 0;
  for (const linha of linhas) {
    total += linha.qtd_imagens;
    if (linha.tipo_anomalia === "saudavel") saudaveis += linha.qtd_imagens;
    else porAnomalia[linha.tipo_anomalia] += linha.qtd_imagens;
  }
  const comAnomalia = filtros.anomalia ? porAnomalia[filtros.anomalia] : total - saudaveis;
  return { total, saudaveis, comAnomalia, porAnomalia };
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
  talhoes: Talhao[],
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
    talhoes.map((talhao) =>
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


export function resultadosPorLocal(
  ocorrencias: OcorrenciaDiaria[], talhoes: Talhao[], filtros: Filtros, inicio: string, fim: string,
) {
  const locais = new Map<string, { id: string; nome: string }>();
  for (const talhao of talhoes) {
    if (filtros.fazenda && talhao.fazenda_id !== filtros.fazenda) continue;
    const id = filtros.fazenda ? talhao.talhao_id : talhao.fazenda_id;
    locais.set(id, { id, nome: filtros.fazenda ? talhao.talhao_id : talhao.fazenda_nome });
  }
  return [...locais.values()].map((local) => ({
    ...local,
    resumo: resumir(ocorrencias.filter((linha) =>
      (filtros.fazenda ? linha.talhao_id : linha.fazenda_id) === local.id && entre(linha.data, inicio, fim)),
      { ...filtros, talhao: "", anomalia: "" }),
  }));
}

export function resumirOrigens(linhas: OcorrenciaDiaria[]) {
  const totais = { simulado: 0, classificador_fase1: 0, nao_informada: 0 };
  for (const linha of linhas) {
    const fonte = linha.fonte === "simulado" || linha.fonte === "classificador_fase1" ? linha.fonte : "nao_informada";
    totais[fonte] += linha.qtd_imagens;
  }
  return totais;
}
