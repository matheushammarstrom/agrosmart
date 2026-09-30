import snapshotBruto from "@/data/snapshot.json";

import consultas from "./consultas.json";
import { consultar, databricksConfigurado, schemaGold } from "./databricks";
import type { DadosPainel, TabelaBruta } from "./tipos";

type NomeTabela = keyof typeof consultas;
type Tabelas = Record<NomeTabela, TabelaBruta>;

const snapshot = snapshotBruto as { geradoEm: string; tabelas: Tabelas };
const VALIDADE_CACHE_MS = 60_000;
const INTERVALO_MINIMO_MS = 15_000;
const TIPOS_NUMERICOS = new Set(["BYTE", "SHORT", "INT", "LONG", "FLOAT", "DOUBLE", "DECIMAL"]);

let cache: { dados: DadosPainel; em: number } | null = null;

function converterValor(bruto: string | null, tipo: string) {
  if (bruto === null) return null;
  if (TIPOS_NUMERICOS.has(tipo)) return Number(bruto);
  if (tipo === "BOOLEAN") return bruto === "true";
  return bruto;
}

function converter<T>(tabela: TabelaBruta): T[] {
  return tabela.rows.map(
    (linha) =>
      Object.fromEntries(
        tabela.columns.map((coluna, indice) => [coluna.name, converterValor(linha[indice], coluna.type_name)]),
      ) as T,
  );
}

function montar(tabelas: Tabelas, fonte: DadosPainel["fonte"], atualizadoEm: string, aviso?: string): DadosPainel {
  return {
    fonte,
    atualizadoEm,
    aviso,
    ocorrencias: converter(tabelas.ocorrencias),
    clima: converter(tabelas.clima),
    status: converter(tabelas.status),
    alertas: converter(tabelas.alertas),
    revisao: converter(tabelas.revisao),
    cargas: converter(tabelas.cargas),
  };
}

export function carregarSnapshot(aviso?: string): DadosPainel {
  return montar(snapshot.tabelas, "snapshot", snapshot.geradoEm, aviso);
}

export async function carregarPainel(forcarAtualizacao = false): Promise<DadosPainel> {
  if (!databricksConfigurado()) {
    return carregarSnapshot("Credenciais do Databricks não configuradas.");
  }
  if (cache) {
    const idade = Date.now() - cache.em;
    if (idade < (forcarAtualizacao ? INTERVALO_MINIMO_MS : VALIDADE_CACHE_MS)) return cache.dados;
  }

  try {
    const nomes = Object.keys(consultas) as NomeTabela[];
    const resultados = await Promise.all(
      nomes.map((nome) => consultar(consultas[nome].replaceAll("{db}", schemaGold()))),
    );
    const tabelas = Object.fromEntries(nomes.map((nome, indice) => [nome, resultados[indice]])) as Tabelas;
    const dados = montar(tabelas, "databricks", new Date().toISOString());
    cache = { dados, em: Date.now() };
    return dados;
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : String(erro);
    return carregarSnapshot(`Não foi possível ler o Databricks: ${motivo}`);
  }
}
