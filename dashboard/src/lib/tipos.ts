export type TipoAnomalia = "saudavel" | "requeima" | "pinta_preta" | "vaquinha" | "mosca_minadora";
export type RiscoRequeima = "baixo" | "moderado" | "alto";
export type StatusTalhao = "normal" | "atencao" | "critico";

export interface OcorrenciaDiaria {
  data: string;
  fazenda_id: string;
  talhao_id: string;
  tipo_anomalia: TipoAnomalia;
  grupo: "nenhum" | "doenca" | "praga";
  qtd_imagens: number;
  confianca_media: number;
  qtd_baixa_confianca: number;
}

export interface ClimaDiario {
  data: string;
  fazenda_id: string;
  temp_min_c: number;
  temp_max_c: number;
  temp_media_c: number;
  umidade_relativa_pct: number;
  precipitacao_mm: number;
  dia_favoravel_requeima: boolean;
  dias_favoraveis_5d: number;
  risco_requeima: RiscoRequeima;
}

export interface Talhao {
  talhao_id: string;
  talhao_nome: string;
  fazenda_id: string;
  fazenda_nome: string;
  municipio: string;
  uf: string;
  latitude: number;
  longitude: number;
  area_ha: number;
  cultivar: string;
  sistema_irrigacao: string;
  data_referencia: string;
  imagens_7d: number | null;
  doentes_7d: number | null;
  pct_doentes_7d: number | null;
  pct_doentes_7d_anterior: number | null;
  variacao_pp: number | null;
  anomalia_principal: TipoAnomalia | null;
  pct_anomalia_principal: number | null;
  risco_requeima_atual: RiscoRequeima | null;
  dias_favoraveis_5d: number | null;
  status: StatusTalhao;
}

export interface Alerta {
  data_referencia: string;
  fazenda_id: string;
  talhao_id: string | null;
  tipo: "incidencia" | "clima";
  severidade: "alta" | "media";
  titulo: string;
  descricao: string;
  acao_recomendada: string;
}

export interface ImagemRevisao {
  id_imagem: string;
  nome_imagem: string;
  data_captura: string;
  data: string;
  fazenda_id: string;
  talhao_id: string;
  tipo_anomalia: TipoAnomalia;
  confianca: number;
  fonte: string;
  lote_id: string;
}

export interface Carga {
  arquivo: string;
  fonte: string;
  ingerido_em: string;
  registros_recebidos: number;
  registros_validos: number;
  registros_quarentena: number;
  registros_duplicados: number;
  periodo_inicio: string | null;
  periodo_fim: string | null;
}

export type Fonte = "databricks" | "snapshot";

export interface DadosPainel {
  fonte: Fonte;
  atualizadoEm: string;
  erro?: string;
  ocorrencias: OcorrenciaDiaria[];
  clima: ClimaDiario[];
  talhoes: Talhao[];
  alertas: Alerta[];
  revisao: ImagemRevisao[];
  cargas: Carga[];
}

export interface RespostaTabela<T> {
  fonte: Fonte;
  atualizadoEm: string;
  erro?: string;
  dados: T[];
}

export interface TabelaBruta {
  columns: { name: string; type_name: string }[];
  rows: (string | null)[][];
}
