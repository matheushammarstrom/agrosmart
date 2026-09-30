import argparse
import csv
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path

from tensorflow.keras.models import load_model

from script import find_images, load_class_names, predict_image

PROJETO = Path(__file__).resolve().parent
SAIDA_PADRAO = PROJETO / "lotes"
NAMESPACE_IDS = uuid.UUID("6f1c2a9e-4b7d-4f3a-9c55-0a9d6c1e2b10")
MODELO_VERSAO = "teachable-machine-v1"
COLUNAS = [
    "id_imagem",
    "nome_imagem",
    "data_captura",
    "talhao_id",
    "origem",
    "categoria",
    "tipo_anomalia",
    "confianca",
    "modelo_versao",
    "fonte",
    "lote_id",
]
CATEGORIAS = {
    "Folha saudável": ("saudavel", "saudavel"),
    "Folha doente": ("doente", "requeima"),
}


def parse_args():
    parser = argparse.ArgumentParser(description="Gera um lote de análises para o pipeline do AgroSmart.")
    parser.add_argument("pasta_imagens", type=Path, help="Pasta com as imagens capturadas no talhão.")
    parser.add_argument("--talhao", required=True, help="Talhão de origem das imagens (ex.: BV-03).")
    parser.add_argument(
        "--data",
        type=date.fromisoformat,
        default=date.today(),
        help="Data da captura no formato AAAA-MM-DD (padrão: hoje).",
    )
    parser.add_argument("--origem", choices=["smartphone", "drone"], default="smartphone")
    parser.add_argument("--saida", type=Path, help="Arquivo CSV de saída (padrão: classificador/lotes/).")
    return parser.parse_args()


def main():
    args = parse_args()
    pasta = args.pasta_imagens.resolve()
    talhao = args.talhao.upper()
    imagens = find_images(pasta) if pasta.is_dir() else []
    if not imagens:
        raise SystemExit(f"Nenhuma imagem JPG, JPEG ou PNG encontrada em: {pasta}")

    gerado_em = datetime.now()
    lote_id = f"lote-{talhao}-{gerado_em:%Y%m%d%H%M%S}"
    saida = args.saida or SAIDA_PADRAO / f"{lote_id}.csv"
    inicio_captura = datetime.combine(args.data, datetime.min.time()) + timedelta(hours=8)

    model = load_model(PROJETO / "keras_model.h5", compile=False)
    class_names = load_class_names(PROJETO / "labels.txt")
    linhas = []

    for sequencia, imagem in enumerate(imagens, start=1):
        previsto, confianca = predict_image(model, class_names, imagem)
        categoria, tipo_anomalia = CATEGORIAS[previsto]
        caminho_relativo = imagem.relative_to(pasta).as_posix()
        linhas.append(
            {
                "id_imagem": str(uuid.uuid5(NAMESPACE_IDS, f"{talhao}:{args.data}:{caminho_relativo}")),
                "nome_imagem": imagem.name,
                "data_captura": f"{inicio_captura + timedelta(seconds=40 * sequencia):%Y-%m-%d %H:%M:%S}",
                "talhao_id": talhao,
                "origem": args.origem,
                "categoria": categoria,
                "tipo_anomalia": tipo_anomalia,
                "confianca": f"{confianca:.4f}",
                "modelo_versao": MODELO_VERSAO,
                "fonte": "classificador_fase1",
                "lote_id": lote_id,
            }
        )
        print(f"{caminho_relativo} -> {previsto} ({confianca:.2%})")

    saida.parent.mkdir(parents=True, exist_ok=True)
    with saida.open("w", newline="", encoding="utf-8") as arquivo:
        writer = csv.DictWriter(arquivo, fieldnames=COLUNAS)
        writer.writeheader()
        writer.writerows(linhas)

    doentes = sum(linha["categoria"] == "doente" for linha in linhas)
    print(f"\n{len(linhas)} imagens do talhão {talhao} em {args.data}: {doentes} com requeima")
    print(f"Lote salvo em: {saida}")


if __name__ == "__main__":
    main()
