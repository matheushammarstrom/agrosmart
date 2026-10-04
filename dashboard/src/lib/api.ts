import type {
  Alerta,
  Carga,
  ClimaDiario,
  DadosPainel,
  ImagemRevisao,
  OcorrenciaDiaria,
  RespostaTabela,
  Talhao,
} from "./tipos";

export type TentativaConsulta =
  | { status: "aplicada"; erro?: string }
  | { status: "preservada"; erro: string };

export interface ResultadoConsultaPainel {
  dados: DadosPainel;
  tentativa: TentativaConsulta;
}

async function buscarTabela<T>(rota: string, forcar: boolean): Promise<RespostaTabela<T> | null> {
  const resposta = await fetch(`/api/${rota}${forcar ? "?atualizar=1" : ""}`, { cache: "no-store" }).catch(() => null);
  const tabela: RespostaTabela<T> | null = resposta?.ok ? await resposta.json().catch(() => null) : null;
  if (
    !tabela ||
    !Array.isArray(tabela.dados) ||
    (tabela.fonte !== "databricks" && tabela.fonte !== "snapshot") ||
    typeof tabela.atualizadoEm !== "string" ||
    !Number.isFinite(Date.parse(tabela.atualizadoEm)) ||
    (tabela.erro !== undefined && typeof tabela.erro !== "string")
  ) return null;
  return tabela;
}

export async function buscarPainel(atual: DadosPainel, forcar: boolean): Promise<ResultadoConsultaPainel> {
  const [ocorrencias, clima, talhoes, alertas, revisao, cargas] = await Promise.all([
    buscarTabela<OcorrenciaDiaria>("ocorrencias", forcar),
    buscarTabela<ClimaDiario>("clima", forcar),
    buscarTabela<Talhao>("talhoes", forcar),
    buscarTabela<Alerta>("alertas", forcar),
    buscarTabela<ImagemRevisao>("revisao", forcar),
    buscarTabela<Carga>("cargas", forcar),
  ]);

  const respostas = { ocorrencias, clima, talhoes, alertas, revisao, cargas };
  const erros = Object.entries(respostas)
    .filter(([, resposta]) => resposta?.erro)
    .map(([nome, resposta]) => `${nome}: ${resposta!.erro}`);
  const preservar = (motivo: string): ResultadoConsultaPainel => ({
    dados: atual,
    tentativa: { status: "preservada", erro: [motivo, ...erros].join("; ") },
  });

  if (!ocorrencias || !clima || !talhoes || !alertas || !revisao || !cargas) {
    const ausentes = Object.entries(respostas).filter(([, resposta]) => !resposta).map(([nome]) => nome);
    return preservar(`Falha ao consultar tabelas: ${ausentes.join(", ")}.`);
  }

  const completas = [ocorrencias, clima, talhoes, alertas, revisao, cargas];
  const fonte = ocorrencias.fonte;
  if (completas.some((resposta) => resposta.fonte !== fonte)) {
    return preservar("As tabelas retornaram fontes incompatíveis.");
  }
  if (fonte === "snapshot" && completas.some((resposta) => resposta.atualizadoEm !== ocorrencias.atualizadoEm)) {
    return preservar("As tabelas retornaram snapshots com datas de geração diferentes.");
  }

  return {
    dados: {
      fonte,
      atualizadoEm: completas.reduce(
        (maisAntiga, resposta) =>
          Date.parse(resposta.atualizadoEm) < Date.parse(maisAntiga) ? resposta.atualizadoEm : maisAntiga,
        ocorrencias.atualizadoEm,
      ),
      ocorrencias: ocorrencias.dados,
      clima: clima.dados,
      talhoes: talhoes.dados,
      alertas: alertas.dados,
      revisao: revisao.dados,
      cargas: cargas.dados,
    },
    tentativa: { status: "aplicada", erro: erros.length ? erros.join("; ") : undefined },
  };
}
