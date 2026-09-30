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

async function buscarTabela<T>(rota: string, forcar: boolean): Promise<RespostaTabela<T> | null> {
  const resposta = await fetch(`/api/${rota}${forcar ? "?atualizar=1" : ""}`, { cache: "no-store" }).catch(() => null);
  return resposta?.ok ? resposta.json().catch(() => null) : null;
}

export async function buscarPainel(atual: DadosPainel, forcar: boolean): Promise<DadosPainel> {
  const [ocorrencias, clima, talhoes, alertas, revisao, cargas] = await Promise.all([
    buscarTabela<OcorrenciaDiaria>("ocorrencias", forcar),
    buscarTabela<ClimaDiario>("clima", forcar),
    buscarTabela<Talhao>("talhoes", forcar),
    buscarTabela<Alerta>("alertas", forcar),
    buscarTabela<ImagemRevisao>("revisao", forcar),
    buscarTabela<Carga>("cargas", forcar),
  ]);

  const respostas = [ocorrencias, clima, talhoes, alertas, revisao, cargas];
  const recebidas = respostas.filter((resposta) => resposta !== null);
  if (recebidas.length === 0) return atual;

  const aoVivo = recebidas.length === respostas.length && recebidas.every((resposta) => resposta.fonte === "databricks");

  return {
    fonte: aoVivo ? "databricks" : "snapshot",
    atualizadoEm: recebidas.map((resposta) => resposta.atualizadoEm).sort()[0],
    erro: recebidas.find((resposta) => resposta.erro)?.erro,
    ocorrencias: ocorrencias?.dados ?? atual.ocorrencias,
    clima: clima?.dados ?? atual.clima,
    talhoes: talhoes?.dados ?? atual.talhoes,
    alertas: alertas?.dados ?? atual.alertas,
    revisao: revisao?.dados ?? atual.revisao,
    cargas: cargas?.dados ?? atual.cargas,
  };
}
