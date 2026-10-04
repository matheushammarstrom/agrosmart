import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { FILTROS_INICIAIS } from "@/lib/agregacoes";
import { GraficoFrequencia } from "./graficos";

beforeEach(() => vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test("tipos usam amostras com problemas como denominador principal", async () => {
  render(<GraficoFrequencia filtros={FILTROS_INICIAIS} resumo={{ total: 1000, saudaveis: 800, comAnomalia: 200, porAnomalia: { requeima: 120, pinta_preta: 40, vaquinha: 30, mosca_minadora: 10 } }} />);
  expect(screen.getByText("200 amostras com problemas · percentuais entre essas amostras")).toBeTruthy();
  await userEvent.setup().click(screen.getByRole("button", { name: "Tabela" }));
  const linha = screen.getByText("Requeima").closest("tr")!;
  expect(within(linha).getByText("60,0%", { exact: true })).toBeTruthy();
  expect(within(linha).getByText("12,0%", { exact: true })).toBeTruthy();
});
