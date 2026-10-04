"use client";

import { NOME_ANOMALIA, formatarData, formatarDataHora, formatarNumero, formatarPct } from "@/lib/formatos";
import type { Carga, ImagemRevisao } from "@/lib/tipos";

import { Cartao, Tabela } from "./ui";

const LIMITE_REVISAO = 12;

export function TabelaRevisao({ imagens }: { imagens: ImagemRevisao[] }) {
  return (
    <Cartao
      titulo={`Fila de revisão manual (${formatarNumero(imagens.length)})`}
      subtitulo="Imagens classificadas com confiança abaixo de 80%: um agrônomo deve confirmar o diagnóstico antes de agir."
    >
      <div className="max-h-80 overflow-auto">
        <Tabela
          colunas={[
            { rotulo: "Captura" },
            { rotulo: "Talhão" },
            { rotulo: "Diagnóstico do modelo" },
            { rotulo: "Confiança", numerica: true },
          ]}
          linhas={imagens
            .slice(0, LIMITE_REVISAO)
            .map((imagem) => [
              formatarData(imagem.data_captura),
              imagem.talhao_id,
              NOME_ANOMALIA[imagem.tipo_anomalia],
              formatarPct(imagem.confianca, 1),
            ])}
        />
        {imagens.length > LIMITE_REVISAO && (
          <p className="pt-2 text-xs text-tinta-3">
            Mostrando as {LIMITE_REVISAO} mais recentes de {formatarNumero(imagens.length)}.
          </p>
        )}
      </div>
    </Cartao>
  );
}

const NOME_FONTE: Record<string, string> = {
  simulado: "Simulado",
  misto: "Misto",
  classificador_fase1: "Classificador (Fase 1)",
};

export function TabelaCargas({ cargas }: { cargas: Carga[] }) {
  return (
    <Cartao
      titulo="Cargas de dados no pipeline"
      subtitulo="Arquivos processados e resultado da validação."
    >
      <div className="max-h-80 overflow-auto">
        <Tabela
          colunas={[
            { rotulo: "Arquivo" },
            { rotulo: "Origem" },
            { rotulo: "Recebidos", numerica: true },
            { rotulo: "Válidos", numerica: true },
            { rotulo: "Rejeitados", numerica: true },
            { rotulo: "Duplicados", numerica: true },
            { rotulo: "Ingerido em" },
          ]}
          linhas={cargas.map((carga) => [
            <span key="arquivo" className="whitespace-nowrap text-tinta">
              {carga.arquivo}
            </span>,
            NOME_FONTE[carga.fonte] ?? carga.fonte,
            formatarNumero(carga.registros_recebidos),
            formatarNumero(carga.registros_validos),
            formatarNumero(carga.registros_quarentena),
            formatarNumero(carga.registros_duplicados),
            <span key="ingerido" className="whitespace-nowrap">
              {formatarDataHora(carga.ingerido_em)}
            </span>,
          ])}
        />
      </div>
    </Cartao>
  );
}
