import argparse
import subprocess
from pathlib import Path

from exportar_snapshot import consultar, primeiro_warehouse


def parse_args():
    parser = argparse.ArgumentParser(description="Remove um lote de análises do pipeline.")
    parser.add_argument("arquivo", help="Nome do arquivo CSV no volume landing/analises.")
    parser.add_argument("--perfil", default="agrosmart", help="Perfil do Databricks CLI.")
    parser.add_argument("--schema", default="workspace.agrosmart", help="Catálogo e schema das tabelas.")
    return parser.parse_args()


def main():
    args = parse_args()
    if "'" in args.arquivo or "/" in args.arquivo:
        raise SystemExit("Informe apenas o nome do arquivo, sem caminho.")

    catalogo, schema = args.schema.split(".")
    caminho = f"dbfs:/Volumes/{catalogo}/{schema}/landing/analises/{args.arquivo}"
    subprocess.run(["databricks", "fs", "rm", caminho, "-p", args.perfil], check=True)
    print(f"Arquivo removido: {caminho}")

    warehouse = primeiro_warehouse(args.perfil)
    consultar(
        args.perfil,
        warehouse,
        f"DELETE FROM {args.schema}.bronze_analises WHERE _arquivo_origem = '{args.arquivo}'",
    )
    print("Linhas removidas do bronze. Recalculando silver e gold...")

    pasta_bundle = Path(__file__).resolve().parent
    subprocess.run(["databricks", "bundle", "run", "pipeline", "-p", args.perfil], check=True, cwd=pasta_bundle)


if __name__ == "__main__":
    main()
