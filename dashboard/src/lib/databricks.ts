import type { TabelaBruta } from "./tipos";

const TEMPO_MAXIMO_MS = 45_000;

interface RespostaStatement {
  statement_id: string;
  status: { state: string; error?: { message?: string } };
  manifest?: { schema: { columns: { name: string; type_name: string }[] } };
  result?: ResultadoParcial;
}

interface ResultadoParcial {
  data_array?: (string | null)[][];
  next_chunk_internal_link?: string;
}

function configuracao() {
  const host = process.env.DATABRICKS_HOST?.replace(/\/$/, "");
  const token = process.env.DATABRICKS_TOKEN;
  const warehouse = process.env.DATABRICKS_WAREHOUSE_ID;
  return host && token && warehouse ? { host, token, warehouse } : null;
}

export function databricksConfigurado() {
  return configuracao() !== null;
}

export function schemaGold() {
  return process.env.DATABRICKS_SCHEMA ?? "workspace.agrosmart";
}

async function chamar<T>(caminho: string, init?: RequestInit): Promise<T> {
  const config = configuracao();
  if (!config) throw new Error("Databricks não configurado");

  const resposta = await fetch(`${config.host}${caminho}`, {
    ...init,
    headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!resposta.ok) {
    throw new Error(`Databricks respondeu ${resposta.status}: ${(await resposta.text()).slice(0, 200)}`);
  }
  return resposta.json() as Promise<T>;
}

export async function consultar(sql: string): Promise<TabelaBruta> {
  const config = configuracao();
  if (!config) throw new Error("Databricks não configurado");
  const inicio = Date.now();

  let resposta = await chamar<RespostaStatement>("/api/2.0/sql/statements", {
    method: "POST",
    body: JSON.stringify({
      statement: sql,
      warehouse_id: config.warehouse,
      wait_timeout: "30s",
      on_wait_timeout: "CONTINUE",
      disposition: "INLINE",
      format: "JSON_ARRAY",
    }),
  });

  while (["PENDING", "RUNNING"].includes(resposta.status.state)) {
    if (Date.now() - inicio > TEMPO_MAXIMO_MS) throw new Error("Tempo esgotado aguardando o Databricks");
    await new Promise((resolver) => setTimeout(resolver, 1_000));
    resposta = await chamar<RespostaStatement>(`/api/2.0/sql/statements/${resposta.statement_id}`);
  }
  if (resposta.status.state !== "SUCCEEDED" || !resposta.manifest) {
    throw new Error(resposta.status.error?.message ?? `Consulta terminou em ${resposta.status.state}`);
  }

  const rows = [...(resposta.result?.data_array ?? [])];
  let parcial = resposta.result;
  while (parcial?.next_chunk_internal_link) {
    parcial = await chamar<ResultadoParcial>(parcial.next_chunk_internal_link);
    rows.push(...(parcial.data_array ?? []));
  }

  return { columns: resposta.manifest.schema.columns, rows };
}
