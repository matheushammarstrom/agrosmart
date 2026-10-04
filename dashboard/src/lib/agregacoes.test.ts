import { expect, test } from "vitest";

import { FILTROS_INICIAIS, filtrarRevisao, calcularJanela, resultadosPorLocal, resumirOrigens } from "./agregacoes";
import { carregarSnapshot } from "./dados";
import type { ImagemRevisao } from "./tipos";

function imagem(id: string, data: string, alteracoes: Partial<ImagemRevisao> = {}): ImagemRevisao {
  return {
    id_imagem: id, nome_imagem: id, data, data_captura: `${data}T12:00:00Z`,
    fazenda_id: "F1", talhao_id: "T1", tipo_anomalia: "requeima", confianca: 0.7,
    fonte: "simulado", lote_id: "teste", ...alteracoes,
  };
}

test("a fila inclui as datas-limite e aplica local e classe sem mudar a ordem recebida", () => {
  const revisao = [
    imagem("fim", "2026-09-30"),
    imagem("inicio", "2026-09-24"),
    imagem("antes", "2026-09-23"),
    imagem("depois", "2026-10-01"),
    imagem("outro-talhao", "2026-09-28", { talhao_id: "T2" }),
    imagem("outra-fazenda", "2026-09-28", { fazenda_id: "F2", talhao_id: "T3" }),
    imagem("outra-anomalia", "2026-09-28", { tipo_anomalia: "pinta_preta" }),
    imagem("saudavel", "2026-09-28", { tipo_anomalia: "saudavel" }),
  ];
  const filtros = { ...FILTROS_INICIAIS, fazenda: "F1", talhao: "T1", anomalia: "requeima" as const };
  expect(filtrarRevisao(revisao, filtros, "2026-09-24", "2026-09-30").map((i) => i.id_imagem))
    .toEqual(["fim", "inicio"]);
  expect(filtrarRevisao(revisao, { ...filtros, anomalia: "" }, "2026-09-24", "2026-09-30").map((i) => i.id_imagem))
    .toEqual(["fim", "inicio", "outra-anomalia", "saudavel"]);
});

test("intervalo personalizado usa limites inclusivos e não muda ao escolher uma fazenda", () => {
  const dados = carregarSnapshot();
  const intervalo = { inicio: "2026-04-01", fim: "2026-04-30" };
  expect(calcularJanela(dados, -1, intervalo)).toEqual({ ...intervalo, anterior: null });
  expect(() => calcularJanela(dados, -1, { inicio: "2026-04-30", fim: "2026-04-01" })).toThrow();
  expect(() => calcularJanela(dados, -1, { inicio: "2026-03-31", fim: "2026-04-30" })).toThrow();
  expect(() => calcularJanela(dados, -1, { inicio: "2026-04-31", fim: "2026-05-02" })).toThrow();
});

test("comparação inclui locais cadastrados sem análises, mantém ordem e soma todas as origens", () => {
  const dados = carregarSnapshot();
  const filtros = { ...FILTROS_INICIAIS, fazenda: "BV" };
  const base = dados.ocorrencias.find((linha) => linha.fazenda_id === "BV")!;
  const linhas = [
    { ...base, talhao_id: "BV-01", tipo_anomalia: "saudavel" as const, qtd_imagens: 80, fonte: "simulado" },
    { ...base, talhao_id: "BV-01", tipo_anomalia: "requeima" as const, qtd_imagens: 15, fonte: "simulado" },
    { ...base, talhao_id: "BV-01", tipo_anomalia: "pinta_preta" as const, qtd_imagens: 5, fonte: "classificador_fase1" },
  ];
  const resultado = resultadosPorLocal(linhas, dados.talhoes, filtros, base.data, base.data);
  expect(resultado.map((r) => r.id)).toEqual(["BV-01", "BV-02", "BV-03", "BV-04"]);
  expect(resultado[0].resumo).toMatchObject({ total: 100, saudaveis: 80, comAnomalia: 20 });
  expect(resultado[1].resumo.total).toBe(0);
  expect(resumirOrigens(linhas)).toEqual({ simulado: 95, classificador_fase1: 5, nao_informada: 0 });
  expect(resumirOrigens([{ ...base, fonte: undefined, qtd_imagens: 1 }]).nao_informada).toBe(1);
});
