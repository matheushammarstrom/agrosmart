import { afterEach, expect, test, vi } from "vitest";

import { buscarPainel } from "./api";
import { carregarSnapshot } from "./dados";
import type { DadosPainel, Fonte } from "./tipos";

type Tabela = keyof Pick<DadosPainel, "ocorrencias" | "clima" | "talhoes" | "alertas" | "revisao" | "cargas">;

function responder(dados: DadosPainel, alterar?: (tabela: Tabela, resposta: Record<string, unknown>) => unknown) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const tabela = new URL(url, "http://localhost").pathname.slice(5) as Tabela;
    const resposta = { fonte: dados.fonte, atualizadoEm: dados.atualizadoEm, dados: dados[tabela] };
    const alterada = alterar ? alterar(tabela, resposta) : resposta;
    return alterada instanceof Response ? alterada : Response.json(alterada);
  }));
}

function novosDados(fonte: Fonte): DadosPainel {
  const snapshot = carregarSnapshot();
  return { ...snapshot, fonte, atualizadoEm: "2026-10-01T14:00:00Z", ocorrencias: [], clima: [] };
}

afterEach(() => vi.unstubAllGlobals());

test("cinco tabelas ao vivo e uma de snapshot preservam todo o conjunto anterior", async () => {
  const anterior = carregarSnapshot();
  responder(novosDados("databricks"), (tabela, resposta) =>
    tabela === "clima" ? { ...resposta, fonte: "snapshot" } : resposta,
  );
  const resultado = await buscarPainel(anterior, false);
  expect(resultado.dados).toBe(anterior);
  expect(resultado.tentativa.erro).toMatch(/fontes|mist/i);
});

test("uma resposta sem a tabela solicitada não é um conjunto completo", async () => {
  const anterior = carregarSnapshot();
  responder(novosDados("databricks"), (tabela, resposta) =>
    tabela === "clima" ? { fonte: "databricks", atualizadoEm: resposta.atualizadoEm } : resposta,
  );
  const resultado = await buscarPainel(anterior, true);
  expect(resultado.dados).toBe(anterior);
  expect(resultado.tentativa).toMatchObject({ status: "preservada", erro: expect.stringContaining("clima") });
});

test("seis tabelas do Databricks com datas de consulta distintas usam a mais antiga em ordem cronológica", async () => {
  const anterior = carregarSnapshot();
  responder(novosDados("databricks"), (tabela, resposta) =>
    tabela === "clima" ? { ...resposta, atualizadoEm: "2026-10-01T14:30:00+02:00" } : resposta,
  );
  const resultado = await buscarPainel(anterior, false);
  expect(resultado.tentativa).toMatchObject({ status: "aplicada" });
  expect(resultado.dados.fonte).toBe("databricks");
  expect(resultado.dados.atualizadoEm).toBe("2026-10-01T14:30:00+02:00");
  expect(resultado.dados.ocorrencias).toEqual([]);
  expect(resultado.dados.clima).toEqual([]);
});

test.each(["rede", "http", "json"] as const)("falha parcial de %s preserva fonte, data e todas as tabelas", async (falha) => {
  const anterior = novosDados("databricks");
  responder(carregarSnapshot(), (tabela, resposta) => {
    if (tabela !== "clima") return resposta;
    if (falha === "rede") throw new Error("Falha de rede");
    if (falha === "http") return new Response("Indisponível", { status: 503 });
    return new Response("{");
  });
  const resultado = await buscarPainel(anterior, true);
  expect(resultado.dados).toBe(anterior);
  expect(resultado.tentativa).toMatchObject({ status: "preservada", erro: expect.stringContaining("clima") });
});

test("falha de todas as consultas não marca dados anteriores do Databricks como uma nova atualização", async () => {
  const anterior = novosDados("databricks");
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Sem rede")));
  const resultado = await buscarPainel(anterior, true);
  expect(resultado.dados).toBe(anterior);
  expect(resultado.tentativa.status).toBe("preservada");
  expect(resultado.tentativa.erro).toMatch(/ocorrencias.*clima.*talhoes.*alertas.*revisao.*cargas/);
});

test("snapshot completo substitui o conjunto e mantém visíveis os avisos de indisponibilidade ao vivo", async () => {
  responder(novosDados("snapshot"), (tabela, resposta) => ({
    ...resposta, erro: tabela === "clima" ? "Warehouse indisponível" : "Consulta expirada",
  }));
  const resultado = await buscarPainel(novosDados("databricks"), true);
  expect(resultado.dados.fonte).toBe("snapshot");
  expect(resultado.dados.atualizadoEm).toBe("2026-10-01T14:00:00Z");
  expect(resultado.tentativa.status).toBe("aplicada");
  expect(resultado.tentativa.erro).toContain("clima: Warehouse indisponível");
  expect(resultado.tentativa.erro).toContain("ocorrencias: Consulta expirada");
});

test("snapshots de gerações diferentes não formam um conjunto compatível", async () => {
  const anterior = novosDados("databricks");
  responder(novosDados("snapshot"), (tabela, resposta) =>
    tabela === "clima" ? { ...resposta, atualizadoEm: "2026-09-30T14:00:00Z" } : resposta,
  );
  const resultado = await buscarPainel(anterior, true);
  expect(resultado.dados).toBe(anterior);
  expect(resultado.tentativa).toMatchObject({ status: "preservada", erro: expect.stringMatching(/geraç/) });
});
