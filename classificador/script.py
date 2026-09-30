import argparse
import csv
from collections import Counter
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps
from tensorflow.keras.models import load_model


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png"}
EXPECTED_CATEGORIES = {
    "potato___healthy": "Folha saudável",
    "potato___late_blight": "Folha doente",
}


def parse_args():
    parser = argparse.ArgumentParser(
        description="Classifica imagens de folhas de batata e exporta os resultados em CSV."
    )
    parser.add_argument(
        "pasta_imagens",
        type=Path,
        help="Pasta com imagens, organizadas ou não em subpastas.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("resultados.csv"),
        help="Arquivo CSV de saída (padrão: resultados.csv).",
    )
    return parser.parse_args()


def load_class_names(labels_path):
    with labels_path.open(encoding="utf-8") as labels_file:
        return [line.strip().split(maxsplit=1)[-1] for line in labels_file if line.strip()]


def predict_image(model, class_names, image_path):
    data = np.ndarray(shape=(1, 224, 224, 3), dtype=np.float32)

    with Image.open(image_path) as image:
        image = image.convert("RGB")
        image = ImageOps.fit(image, (224, 224), Image.Resampling.LANCZOS)
        image_array = np.asarray(image)

    data[0] = (image_array.astype(np.float32) / 127.5) - 1
    prediction = model.predict(data, verbose=0)
    index = int(np.argmax(prediction))

    return class_names[index], float(prediction[0][index])


def find_images(images_dir):
    return sorted(
        path
        for path in images_dir.rglob("*")
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    )


def expected_category(image_path):
    return EXPECTED_CATEGORIES.get(image_path.parent.name.lower(), "")


def write_csv(output_path, results):
    fieldnames = [
        "nome_imagem",
        "caminho_relativo",
        "categoria_detectada",
        "confianca",
        "categoria_esperada",
        "acertou",
    ]
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with output_path.open("w", newline="", encoding="utf-8") as output_file:
        writer = csv.DictWriter(output_file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(results)


def print_summary(results, output_path):
    predicted_counts = Counter(result["categoria_detectada"] for result in results)
    evaluated = [result for result in results if result["categoria_esperada"]]

    print("\nResumo da execução")
    print(f"Total processado: {len(results)}")
    for category, total in sorted(predicted_counts.items()):
        print(f"{category}: {total}")

    if evaluated:
        correct = sum(result["acertou"] == "sim" for result in evaluated)
        errors = len(evaluated) - correct
        accuracy = correct / len(evaluated)
        print("\nAvaliação das imagens com categoria conhecida")
        print(f"Acertos: {correct}")
        print(f"Erros: {errors}")
        print(f"Acurácia: {accuracy:.2%}")

    print(f"\nResultados salvos em: {output_path}")


def main():
    args = parse_args()
    images_dir = args.pasta_imagens.resolve()

    if not images_dir.is_dir():
        raise SystemExit(f"Pasta de imagens não encontrada: {images_dir}")

    image_paths = find_images(images_dir)
    if not image_paths:
        raise SystemExit(f"Nenhuma imagem JPG, JPEG ou PNG encontrada em: {images_dir}")

    project_dir = Path(__file__).resolve().parent
    model = load_model(project_dir / "keras_model.h5", compile=False)
    class_names = load_class_names(project_dir / "labels.txt")
    results = []

    for image_path in image_paths:
        predicted, confidence = predict_image(model, class_names, image_path)
        expected = expected_category(image_path)
        matched = "sim" if expected and predicted == expected else "não" if expected else ""
        relative_path = image_path.relative_to(images_dir).as_posix()

        results.append(
            {
                "nome_imagem": image_path.name,
                "caminho_relativo": relative_path,
                "categoria_detectada": predicted,
                "confianca": f"{confidence:.6f}",
                "categoria_esperada": expected,
                "acertou": matched,
            }
        )
        print(f"{relative_path} -> {predicted} ({confidence:.2%})")

    write_csv(args.output, results)
    print_summary(results, args.output)


if __name__ == "__main__":
    main()
