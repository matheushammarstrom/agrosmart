import { carregarPainel } from "@/lib/dados";

export const maxDuration = 60;

export async function GET(request: Request) {
  const forcarAtualizacao = new URL(request.url).searchParams.has("atualizar");
  return Response.json(await carregarPainel(forcarAtualizacao));
}
