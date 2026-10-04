"""Compacta a entrega sem credenciais, dependências ou caches."""
import argparse
from pathlib import Path
import re
import zipfile

RAIZ = Path(__file__).resolve().parents[1]
PASTAS = {"dashboard", "pipeline", "dados", "classificador", "docs", "scripts", "tests"}
EXCLUIR = {"node_modules", ".next", ".venv", ".git", ".vercel", ".databricks", ".scratch", ".agents", "__pycache__", "agents", "lotes"}
NOMES = {"AGENTS.md", "CLAUDE.md", ".DS_Store", "tsconfig.tsbuildinfo"}


def video_preenchido(texto):
    return bool(re.search(r"^-\s+\*\*Vídeo:\*\*\s+https?://[^\s<>]+", texto, re.MULTILINE))


def arquivos_do_pacote(raiz):
    for caminho in sorted(raiz.rglob("*")):
        relativo = caminho.relative_to(raiz)
        if not caminho.is_file() or caminho.is_symlink():
            continue
        if relativo.parts[0] not in PASTAS and relativo.as_posix() not in {"README.md", ".gitignore"}:
            continue
        if any(p in EXCLUIR for p in relativo.parts) or caminho.name in NOMES:
            continue
        if caminho.name.startswith(".env") and caminho.name != ".env.example":
            continue
        if caminho.suffix in {".zip", ".rar", ".log", ".pyc", ".tmp"}:
            continue
        yield caminho


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--nome", default="agrosmart-fase2-rascunho.zip")
    parser.add_argument("--saida", type=Path, default=RAIZ / ".scratch" / "entrega")
    parser.add_argument("--rascunho", action="store_true", help="Permite pacote de revisão sem link de vídeo.")
    args = parser.parse_args()
    if Path(args.nome).name != args.nome or not args.nome.endswith(".zip"):
        parser.error("Use somente um nome de arquivo com extensão .zip.")
    video = (RAIZ / "docs" / "video.md").read_text(encoding="utf-8")
    if not args.rascunho and not video_preenchido(video):
        parser.error("Preencha o link do vídeo em docs/video.md; use --rascunho para revisão sem vídeo.")
    destino = args.saida / args.nome
    if destino.exists():
        parser.error(f"O arquivo já existe: {destino}. Escolha outro nome ou remova o seu rascunho anterior.")
    destino.parent.mkdir(parents=True, exist_ok=True)
    arquivos = list(arquivos_do_pacote(RAIZ))
    with zipfile.ZipFile(destino, "w", zipfile.ZIP_DEFLATED) as pacote:
        for arquivo in arquivos:
            pacote.write(arquivo, arquivo.relative_to(RAIZ))
    print(f"{'Rascunho' if args.rascunho else 'Pacote final'}: {destino} ({len(arquivos)} arquivos; {destino.stat().st_size / 1024 / 1024:.1f} MB)")


if __name__ == "__main__":
    main()
