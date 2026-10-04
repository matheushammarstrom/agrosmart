import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { FILTROS_INICIAIS } from "@/lib/agregacoes";
import { carregarSnapshot } from "@/lib/dados";
import type { ClimaDiario, DadosPainel, ImagemRevisao } from "@/lib/tipos";

import { Painel } from "./painel";
import { GraficoClima } from "./clima";
import { SituacaoTalhoes } from "./talhoes-alertas";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Sem rede no teste")));
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function dadosControlados(): DadosPainel {
  const snapshot = carregarSnapshot();
  const revisao: ImagemRevisao[] = [];
  function adicionar(qtd: number, data: string, fazenda: string, talhao: string, tipo: ImagemRevisao["tipo_anomalia"]) {
    for (let i = 0; i < qtd; i++) {
      const id = `imagem-${revisao.length}`;
      revisao.push({ id_imagem: id, nome_imagem: id, data_captura: `${data}T12:00:00Z`, data,
        fazenda_id: fazenda, talhao_id: talhao, tipo_anomalia: tipo, confianca: 0.7, fonte: "simulado", lote_id: "teste" });
    }
  }
  adicionar(15, "2026-09-30", "F1", "T1", "requeima");
  adicionar(2, "2026-09-30", "F1", "T1", "pinta_preta");
  adicionar(1, "2026-09-30", "F1", "T1", "saudavel");
  adicionar(3, "2026-09-01", "F1", "T1", "requeima");
  adicionar(4, "2026-09-30", "F1", "T2", "requeima");
  adicionar(5, "2026-09-30", "F2", "T3", "requeima");
  adicionar(1, "2026-06-01", "F1", "T1", "requeima");
  return {
    fonte: "snapshot", atualizadoEm: "2026-09-30T12:00:00Z", clima: [], alertas: [], cargas: [], revisao,
    talhoes: [
      { ...snapshot.talhoes[0], fazenda_id: "F1", fazenda_nome: "Fazenda Um", talhao_id: "T1", status: "critico" },
      { ...snapshot.talhoes[0], fazenda_id: "F1", fazenda_nome: "Fazenda Um", talhao_id: "T2", status: "normal" },
      { ...snapshot.talhoes[0], fazenda_id: "F2", fazenda_nome: "Fazenda Dois", talhao_id: "T3", status: "normal" },
    ],
    ocorrencias: [
      { data: "2026-09-30", fazenda_id: "F1", talhao_id: "T1", tipo_anomalia: "saudavel", grupo: "nenhum", qtd_imagens: 13090, confianca_media: 0.95, qtd_baixa_confianca: 400 },
      { data: "2026-09-30", fazenda_id: "F1", talhao_id: "T1", tipo_anomalia: "requeima", grupo: "doenca", qtd_imagens: 191, confianca_media: 0.9, qtd_baixa_confianca: 15 },
      { data: "2026-09-30", fazenda_id: "F1", talhao_id: "T1", tipo_anomalia: "pinta_preta", grupo: "doenca", qtd_imagens: 682, confianca_media: 0.9, qtd_baixa_confianca: 64 },
      { data: "2026-06-01", fazenda_id: "F1", talhao_id: "T1", tipo_anomalia: "requeima", grupo: "doenca", qtd_imagens: 1, confianca_media: 0.7, qtd_baixa_confianca: 1 },
    ],
  };
}



test("clima desatualizado e clima não informado nunca aparecem como normalidade nem como risco baixo", () => {
  const talhoes = dadosControlados().talhoes.map((talhao) => ({
    ...talhao,
    risco_requeima_atual: null,
    situacao_clima: talhao.fazenda_id === "F2" ? undefined : "desatualizado" as const,
    data_clima_disponivel: talhao.fazenda_id === "F2" ? null : "2026-09-29",
    status: talhao.fazenda_id === "F2" ? "normal" as const : "inconclusivo" as const,
  }));

  render(<SituacaoTalhoes talhoes={talhoes} filtros={FILTROS_INICIAIS} onSelecionar={() => {}} />);

  expect(screen.getAllByText(/risco de requeima indisponível/i)).toHaveLength(2);
  expect(screen.getAllByText("Clima desatualizado · último registro em 29/09/2026")).toHaveLength(1);
  expect(screen.getByText("Situação climática não informada")).toBeTruthy();
  expect(screen.getAllByText("Inconclusivo")).toHaveLength(3);
  expect(screen.queryByText(/risco de requeima baixo/i)).toBeNull();
});


test("a tabela climática identifica risco diário incompleto e situação antiga na data de referência", async () => {
  const usuario = userEvent.setup();
  const clima: ClimaDiario[] = [{
    data: "2026-09-30",
    fazenda_id: "F1",
    temp_min_c: 13,
    temp_max_c: 19,
    temp_media_c: 16,
    umidade_relativa_pct: 91,
    precipitacao_mm: 4,
    dia_favoravel_requeima: true,
    dias_favoraveis_5d: null,
    risco_requeima: null,
  }];
  const talhoes = dadosControlados().talhoes.map((talhao) => ({
    ...talhao,
    risco_requeima_atual: null,
    situacao_clima: "desatualizado" as const,
    data_clima_disponivel: "2026-09-29",
  }));
  render(
    <GraficoClima
      clima={clima}
      talhoes={talhoes}
      filtros={FILTROS_INICIAIS}
      inicio="2026-09-30"
      fim="2026-09-30"
    />,
  );
  await usuario.click(screen.getByRole("button", { name: "Tabela" }));

  const linhaClimatica = screen.getAllByRole<HTMLTableRowElement>("row")[1];
  expect(linhaClimatica.cells[4].textContent).toBe("indisponível");
  expect(linhaClimatica.cells[5].textContent).toContain("Clima desatualizado · último registro em 29/09/2026");
  expect(linhaClimatica.cells[6].textContent).toBe("indisponível");
  expect(screen.queryByText("baixo")).toBeNull();
});

test("a tabela climática mantém fazenda sem clima no período com risco e métricas indisponíveis", async () => {
  const usuario = userEvent.setup();
  const fazenda = dadosControlados().talhoes.find((talhao) => talhao.fazenda_id === "F2")!;
  const talhoes = [{
    ...fazenda,
    risco_requeima_atual: null,
    situacao_clima: "ausente" as const,
    data_clima_disponivel: null,
    status: "inconclusivo" as const,
  }];
  render(
    <GraficoClima
      clima={[]}
      talhoes={talhoes}
      filtros={FILTROS_INICIAIS}
      inicio="2026-09-30"
      fim="2026-09-30"
    />,
  );
  await usuario.click(screen.getByRole("button", { name: "Tabela" }));

  const linha = screen.getAllByRole<HTMLTableRowElement>("row")[1];
  expect(linha.textContent).toContain("Fazenda Dois");
  expect(linha.textContent).toContain("Clima ausente");
  expect(linha.cells[1].textContent).toBe("—");
  expect(linha.cells[4].textContent).toBe("indisponível");
  expect(linha.cells[6].textContent).toBe("indisponível");
});
test("panorama e detalhe preservam período e a seleção de talhão filtra a revisão", async () => {
  const usuario = userEvent.setup();
  render(<Painel inicial={dadosControlados()} />);
  await waitFor(() => expect(screen.getByRole<HTMLButtonElement>("button", { name: "Atualizar" }).disabled).toBe(false));
  expect(screen.getByRole("heading", { name: "Panorama das fazendas" })).toBeTruthy();
  await usuario.click(screen.getByRole("button", { name: "7 dias" }));
  await usuario.click(screen.getByRole("button", { name: "Explorar Fazenda Um" }));
  expect(screen.getByRole("heading", { name: "Fazenda Um" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "7 dias" }).getAttribute("aria-pressed")).toBe("true");
  await usuario.selectOptions(screen.getByLabelText("Talhão"), "T1");
  await usuario.click(screen.getByText("Dados e atualização"));
  expect(screen.getByText("Fila de revisão manual (18)")).toBeTruthy();
  await usuario.click(screen.getByRole("button", { name: "Voltar ao panorama" }));
  expect(screen.getByRole("heading", { name: "Panorama das fazendas" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "7 dias" }).getAttribute("aria-pressed")).toBe("true");
});

test("base vazia não fabrica percentuais e apresenta os locais cadastrados", async () => {
  const dados = { ...dadosControlados(), ocorrencias: [], revisao: [] };
  render(<Painel inicial={dados} />);
  expect(screen.getByText("Sem análises no período selecionado.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Explorar Fazenda Um" })).toBeTruthy();
  expect(screen.queryByText("100% saudáveis")).toBeNull();
});

test("atualizações completas, mistas e falhas mantêm dados, fonte e última tentativa coerentes", async () => {
  const usuario = userEvent.setup();
  const inicial = dadosControlados();
  const aoVivo: DadosPainel = {
    ...inicial,
    fonte: "databricks",
    atualizadoEm: "2026-10-01T14:00:00Z",
    ocorrencias: inicial.ocorrencias.map((linha) =>
      linha.tipo_anomalia === "saudavel" ? { ...linha, qtd_imagens: 100 } : linha,
    ),
  };
  const tabelas: Record<string, unknown> = {
    ocorrencias: aoVivo.ocorrencias, clima: aoVivo.clima, talhoes: aoVivo.talhoes,
    alertas: aoVivo.alertas, revisao: aoVivo.revisao, cargas: aoVivo.cargas,
  };
  const copia: Record<string, unknown> = { ...inicial };
  let modo: "databricks" | "total" | "misto" | "parcial" | "snapshot" = "databricks";
  const fetchSimulado = vi.fn(async (url: string) => {
    const tabela = new URL(url, "http://localhost").pathname.slice(5);
    if (modo === "total") throw new Error("Sem rede");
    if (modo === "parcial" && tabela === "clima") return new Response("Sem rede", { status: 503 });
    const snapshot = modo === "snapshot" || (modo === "misto" && tabela === "clima");
    return Response.json({
      fonte: snapshot ? "snapshot" : "databricks",
      atualizadoEm: snapshot ? inicial.atualizadoEm : aoVivo.atualizadoEm,
      dados: modo === "misto" || modo === "parcial" ? [] : snapshot ? copia[tabela] : tabelas[tabela],
      erro: snapshot ? "Warehouse indisponível" : undefined,
    });
  });
  vi.stubGlobal("fetch", fetchSimulado);
  render(<Painel inicial={inicial} />);
  await waitFor(() => expect(screen.getByRole<HTMLButtonElement>("button", { name: "Atualizar" }).disabled).toBe(false));
  const indicador = screen.getByText("Amostras analisadas").parentElement!;
  expect(within(indicador).getByText("973", { exact: true })).toBeTruthy();
  const cabecalho = screen.getByRole("heading", { level: 1 }).closest("header")!;
  const fonteAntes = within(cabecalho).getByText(/Databricks.*\(/).textContent;

  modo = "total";
  await usuario.click(screen.getByRole("button", { name: "Atualizar" }));
  await waitFor(() => expect(screen.getByRole<HTMLButtonElement>("button", { name: "Atualizar" }).disabled).toBe(false));
  expect(within(indicador).getByText("973", { exact: true })).toBeTruthy();
  expect(within(cabecalho).getByRole("alert").textContent).toMatch(/preservad/i);
  expect(within(cabecalho).getByText(/Databricks.*\(/).textContent).toBe(fonteAntes);
  expect(cabecalho.textContent).not.toMatch(/ao vivo/i);

  for (const falha of ["misto", "parcial"] as const) {
    modo = falha;
    await usuario.click(screen.getByRole("button", { name: "Atualizar" }));
    await waitFor(() => expect(screen.getByRole<HTMLButtonElement>("button", { name: "Atualizar" }).disabled).toBe(false));
    expect(within(indicador).getByText("973", { exact: true })).toBeTruthy();
    expect(within(cabecalho).getByRole("alert").textContent).toMatch(falha === "misto" ? /fontes incompatíveis/ : /clima/);
    expect(within(cabecalho).getByLabelText("Fonte dos dados").textContent).toBe(fonteAntes);
  }

  modo = "snapshot";
  await usuario.click(screen.getByRole("button", { name: "Atualizar" }));
  await waitFor(() => expect(screen.getByRole<HTMLButtonElement>("button", { name: "Atualizar" }).disabled).toBe(false));
  expect(within(indicador).getByText("13.963", { exact: true })).toBeTruthy();
  expect(within(cabecalho).getByLabelText("Fonte dos dados").textContent).toMatch(/Snapshot local/);
  expect(within(cabecalho).getByRole("alert").textContent).toContain("Warehouse indisponível");

  modo = "databricks";
  await usuario.click(screen.getByRole("button", { name: "Atualizar" }));
  await waitFor(() => expect(screen.getByRole<HTMLButtonElement>("button", { name: "Atualizar" }).disabled).toBe(false));
  expect(within(indicador).getByText("973", { exact: true })).toBeTruthy();
  expect(within(cabecalho).queryByRole("alert")).toBeNull();
  expect(within(cabecalho).getByLabelText("Fonte dos dados").textContent).toBe(fonteAntes);
});

test("atualização com nova cobertura revalida o intervalo personalizado sem derrubar o painel", async () => {
  const usuario = userEvent.setup();
  const inicial = dadosControlados();
  let dados = inicial;
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const tabela = new URL(url, "http://localhost").pathname.slice(5) as keyof DadosPainel;
    return Response.json({ fonte: "snapshot", atualizadoEm: dados.atualizadoEm, dados: dados[tabela] });
  }));
  render(<Painel inicial={inicial} />);
  await waitFor(() => expect(screen.getByRole<HTMLButtonElement>("button", { name: "Atualizar" }).disabled).toBe(false));
  await usuario.click(screen.getByText("Personalizado"));
  await usuario.type(screen.getByLabelText("Data inicial"), "2026-06-01");
  await usuario.type(screen.getByLabelText("Data final"), "2026-06-02");
  await usuario.click(screen.getByRole("button", { name: "Aplicar intervalo" }));
  expect(screen.getByText("01/06/2026 a 02/06/2026")).toBeTruthy();
  dados = { ...inicial, ocorrencias: inicial.ocorrencias.filter((o) => o.data === "2026-09-30") };
  await usuario.click(screen.getByRole("button", { name: "Atualizar" }));
  await waitFor(() => expect(screen.getByText("A cobertura da base mudou. Exibindo os últimos 30 dias disponíveis.")).toBeTruthy());
  expect(screen.getByRole("heading", { name: "Panorama das fazendas" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "30 dias" }).getAttribute("aria-pressed")).toBe("true");
});
