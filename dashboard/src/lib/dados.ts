import snapshotBruto from "@/data/snapshot.json";

import consultas from "./consultas.json";
import { consultar, databricksConfigurado, schemaGold } from "./databricks";
import type { DadosPainel, RespostaTabela, TabelaBruta } from "./tipos";

export type NomeTabela = keyof typeof consultas;

const snapshot = snapshotBruto as { geradoEm: string; tabelas: Record<NomeTabela, TabelaBruta> };
const VALIDADE_CACHE_MS = 60_000;
const INTERVALO_MINIMO_MS = 15_000;
const TIPOS_NUMERICOS = new Set(["BYTE", "SHORT", "INT", "LONG", "FLOAT", "DOUBLE", "DECIMAL"]);

const cache = new Map<NomeTabela, { resposta: RespostaTabela<unknown>; em: number }>();

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

function tabelaDoSnapshot(nome: NomeTabela, erro?: string): RespostaTabela<unknown> {
  return { fonte: "snapshot", atualizadoEm: snapshot.geradoEm, erro, dados: converter(snapshot.tabelas[nome]) };
}

export function carregarSnapshot(): DadosPainel {
  return {
    fonte: "snapshot",
    atualizadoEm: snapshot.geradoEm,
    ocorrencias: converter(snapshot.tabelas.ocorrencias),
    clima: converter(snapshot.tabelas.clima),
    talhoes: converter(snapshot.tabelas.talhoes),
    alertas: converter(snapshot.tabelas.alertas),
    revisao: converter(snapshot.tabelas.revisao),
    cargas: converter(snapshot.tabelas.cargas),
  };
}

export async function carregarTabela(nome: NomeTabela, forcarAtualizacao: boolean) {
  if (!databricksConfigurado()) {
    return tabelaDoSnapshot(nome);
  }

  const guardada = cache.get(nome);
  if (guardada) {
    const idade = Date.now() - guardada.em;
    if (idade < (forcarAtualizacao ? INTERVALO_MINIMO_MS : VALIDADE_CACHE_MS)) return guardada.resposta;
  }

  try {
    const tabela = await consultar(consultas[nome].replaceAll("{db}", schemaGold()));
    const resposta: RespostaTabela<unknown> = {
      fonte: "databricks",
      atualizadoEm: new Date().toISOString(),
      dados: converter(tabela),
    };
    cache.set(nome, { resposta, em: Date.now() });
    return resposta;
  } catch (erro) {
    return tabelaDoSnapshot(nome, erro instanceof Error ? erro.message : String(erro));
  }
}

export async function responder(nome: NomeTabela, request: Request) {
  const forcarAtualizacao = new URL(request.url).searchParams.has("atualizar");
  return Response.json(await carregarTabela(nome, forcarAtualizacao));
}
