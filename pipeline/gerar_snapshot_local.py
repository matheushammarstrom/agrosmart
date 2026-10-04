"""Gera o JSON do painel a partir dos CSVs usando os notebooks silver/gold reais em Spark local."""
import argparse
import ast
import json
import os
from datetime import datetime, timezone
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
NOTEBOOKS = RAIZ / "pipeline" / "notebooks"
CONSULTAS = json.loads((RAIZ / "dashboard" / "src" / "lib" / "consultas.json").read_text())


def criar_spark():
    from pyspark.sql import SparkSession
    os.environ.setdefault("SPARK_LOCAL_IP", "127.0.0.1")
    spark = (SparkSession.builder.master("local[2]").appName("agrosmart-snapshot-local")
             .config("spark.sql.shuffle.partitions", "2")
             .config("spark.sql.session.timeZone", "UTC")
             .config("spark.ui.enabled", "false").getOrCreate())
    spark.sparkContext.setLogLevel("ERROR")
    return spark


def executar_notebook(nome, contexto):
    """Adapta somente widgets/persistência/display; os cálculos do notebook são executados intactos."""
    caminho = NOTEBOOKS / nome
    arvore = ast.parse(caminho.read_text(encoding="utf-8"), filename=str(caminho))
    arvore.body = [node for node in arvore.body if not (
        isinstance(node, ast.FunctionDef) and node.name == "salvar"
        or isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "db" for t in node.targets)
        or isinstance(node, ast.Expr) and isinstance(node.value, ast.Call) and ast.unparse(node.value.func).startswith("dbutils.")
    )]
    exec(compile(arvore, str(caminho), "exec"), contexto)


class TabelasLocais:
    def __init__(self, spark):
        self.spark = spark
        self.tabelas = {}

    def table(self, nome):
        return self.tabelas[nome.split(".")[-1]]

    def createDataFrame(self, *args, **kwargs):
        return self.spark.createDataFrame(*args, **kwargs)

    def salvar(self, df, nome):
        self.tabelas[nome] = df.cache()


def linhas_como_dict(tabela):
    nomes = [c["name"] for c in tabela["columns"]]
    return [dict(zip(nomes, row)) for row in tabela["rows"]]


def serializar(df):
    from pyspark.sql.types import BooleanType, DateType, TimestampType, StringType
    tipos = {"bigint": "LONG", "int": "INT", "double": "DOUBLE", "float": "FLOAT", "boolean": "BOOLEAN", "date": "DATE", "timestamp": "TIMESTAMP", "string": "STRING"}
    def valor(item):
        if item is None:
            return None
        if isinstance(item, bool):
            return str(item).lower()
        if isinstance(item, datetime):
            return item.isoformat(sep=" ")
        return str(item)
    # Tipos de texto e datas continuam compatíveis com o envelope SQL do Databricks.
    assert all(isinstance(f.dataType, (BooleanType, DateType, TimestampType, StringType)) or f.dataType.simpleString() in tipos for f in df.schema.fields)
    return {"columns": [{"name": f.name, "type_name": tipos.get(f.dataType.simpleString(), "STRING")} for f in df.schema.fields],
            "rows": [[valor(v) for v in row] for row in df.collect()]}


def gerar_snapshot(entrada, spark):
    from pyspark.sql import functions as F
    tabelas = TabelasLocais(spark)
    try:
        fontes = {"analises": "analises", "clima": "clima", "talhoes": "referencia/talhoes.csv", "anomalias": "referencia/anomalias.csv"}
        for nome, relativo in fontes.items():
            caminho = Path(entrada) / relativo
            arquivos = sorted(caminho.glob("*.csv")) if caminho.is_dir() else [caminho]
            if not arquivos or any(not arquivo.is_file() for arquivo in arquivos):
                raise ValueError(f"CSV não encontrado: {caminho}")
            frames = []
            for arquivo in arquivos:
                # Todos os campos entram como texto, como no bronze do Databricks.
                df = spark.read.option("header", True).option("encoding", "UTF-8").csv(str(arquivo))
                df = df.withColumn("_arquivo_origem", F.lit(str(arquivo.relative_to(entrada)))).withColumn("_ingerido_em", F.lit(datetime.fromtimestamp(arquivo.stat().st_mtime, timezone.utc).replace(tzinfo=None)))
                frames.append(df)
            bruto = frames[0]
            for df in frames[1:]:
                bruto = bruto.unionByName(df)
            tabelas.salvar(bruto, f"bronze_{nome}")
        contexto = {"spark": tabelas, "db": "local.agrosmart", "salvar": tabelas.salvar, "display": lambda _: None}
        executar_notebook("agregacao_climatica.py", contexto)
        executar_notebook("02_transformacao_silver.py", contexto)
        executar_notebook("03_agregacao_gold.py", contexto)
        resultado = {}
        for nome, consulta in CONSULTAS.items():
            tabela = consulta.split(".gold_")[1].split()[0]
            ordem = [c.strip() for c in consulta.split("ORDER BY ")[1].split(",")]
            colunas = [F.col(c.removesuffix(" DESC")).desc() if c.endswith(" DESC") else F.col(c) for c in ordem]
            resultado[nome] = serializar(tabelas.table(f"gold_{tabela}").orderBy(*colunas))
        return {"geradoEm": datetime.now(timezone.utc).isoformat(timespec="seconds"), "tabelas": resultado}
    finally:
        for df in tabelas.tabelas.values():
            df.unpersist()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--entrada", type=Path, default=RAIZ / "dados" / "entrada")
    parser.add_argument("--saida", type=Path, default=RAIZ / "dashboard" / "src" / "data" / "snapshot.json")
    args = parser.parse_args()
    spark = criar_spark()
    try:
        snapshot = gerar_snapshot(args.entrada.resolve(), spark)
        args.saida.parent.mkdir(parents=True, exist_ok=True)
        temporario = args.saida.with_suffix(".tmp")
        temporario.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        temporario.replace(args.saida)
        print(f"Snapshot salvo: {args.saida}")
        for nome, tabela in snapshot["tabelas"].items():
            print(f"{nome}: {len(tabela['rows'])} linhas")
    finally:
        spark.stop()


if __name__ == "__main__":
    main()
