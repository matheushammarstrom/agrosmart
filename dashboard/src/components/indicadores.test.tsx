import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import { FILTROS_INICIAIS, resumir } from "@/lib/agregacoes";
import type { OcorrenciaDiaria } from "@/lib/tipos";

import { Indicadores } from "./indicadores";

afterEach(cleanup);

const ocorrencias = [
  { tipo_anomalia: "saudavel", qtd_imagens: 13090, grupo: "nenhum" },
  { tipo_anomalia: "requeima", qtd_imagens: 191, grupo: "doenca" },
  { tipo_anomalia: "pinta_preta", qtd_imagens: 682, grupo: "doenca" },
] satisfies Pick<OcorrenciaDiaria, "tipo_anomalia" | "qtd_imagens" | "grupo">[];
const linhas: OcorrenciaDiaria[] = ocorrencias.map((linha) => ({
  ...linha,
  data: "2026-09-30",
  fazenda_id: "F1",
  talhao_id: "T1",
  confianca_media: 0.95,
  qtd_baixa_confianca: 0,
}));

test("saudáveis excluem outras anomalias do numerador, mas não do denominador", () => {
  const filtros = { ...FILTROS_INICIAIS, anomalia: "requeima" as const };
  const resumo = resumir(linhas, filtros);
  expect(resumo.total).toBe(13963);
  expect(resumo.saudaveis / resumo.total).toBeCloseTo(0.9375, 4);

  render(<Indicadores resumo={resumo} resumoAnterior={null} totalRevisao={0} filtros={filtros} talhoes={[]} periodo={90} />);
  expect(screen.getByText("94%", { exact: true })).toBeTruthy();
  expect(screen.queryByText("99%", { exact: true })).toBeNull();
});

test("um recorte sem imagens não inventa percentuais de saúde ou comparação", () => {
  render(
    <Indicadores
      resumo={resumir([], FILTROS_INICIAIS)}
      resumoAnterior={resumir(linhas, FILTROS_INICIAIS)}
      totalRevisao={0}
      filtros={FILTROS_INICIAIS}
      talhoes={[]}
      periodo={90}
    />,
  );
  const cartao = screen.getByText("Folhas saudáveis × com anomalia").parentElement!;
  expect(cartao.textContent).toContain("—");
  expect(cartao.textContent).not.toMatch(/%|NaN|Infinity|Com anomalia:/);
});
