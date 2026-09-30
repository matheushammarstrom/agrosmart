# Databricks notebook source
# MAGIC %md
# MAGIC # Ingestão (bronze)
# MAGIC
# MAGIC Lê os CSVs do volume `landing` e grava os dados brutos em tabelas Delta, sem nenhuma limpeza.
# MAGIC Análises e clima usam Auto Loader (só arquivos novos); os cadastros são relidos a cada execução.

# COMMAND ----------

dbutils.widgets.text("catalogo", "workspace")
dbutils.widgets.text("schema", "agrosmart")
catalogo = dbutils.widgets.get("catalogo")
schema = dbutils.widgets.get("schema")
db = f"{catalogo}.{schema}"
landing = f"/Volumes/{catalogo}/{schema}/landing"
checkpoints = f"/Volumes/{catalogo}/{schema}/checkpoints"

# COMMAND ----------

from pyspark.sql import functions as F
from pyspark.sql.types import StringType, StructField, StructType

FONTES_INCREMENTAIS = {
    "analises": [
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
    ],
    "clima": ["data", "fazenda_id", "temp_min_c", "temp_max_c", "umidade_relativa_pct", "precipitacao_mm"],
}
REFERENCIAS = ["talhoes", "anomalias"]

for pasta in [*FONTES_INCREMENTAIS, "referencia"]:
    dbutils.fs.mkdirs(f"{landing}/{pasta}")

# COMMAND ----------


def ingerir_incremental(nome, colunas):
    schema_csv = StructType([StructField(coluna, StringType()) for coluna in colunas])
    consulta = (
        spark.readStream.format("cloudFiles")
        .option("cloudFiles.format", "csv")
        .option("header", "true")
        .schema(schema_csv)
        .load(f"{landing}/{nome}")
        .withColumn("_arquivo_origem", F.col("_metadata.file_name"))
        .withColumn("_ingerido_em", F.current_timestamp())
        .writeStream.option("checkpointLocation", f"{checkpoints}/bronze_{nome}")
        .trigger(availableNow=True)
        .toTable(f"{db}.bronze_{nome}")
    )
    consulta.awaitTermination()


for nome, colunas in FONTES_INCREMENTAIS.items():
    ingerir_incremental(nome, colunas)

# COMMAND ----------

for nome in REFERENCIAS:
    (
        spark.read.option("header", "true")
        .csv(f"{landing}/referencia/{nome}.csv")
        .withColumn("_ingerido_em", F.current_timestamp())
        .write.mode("overwrite")
        .option("overwriteSchema", "true")
        .saveAsTable(f"{db}.bronze_{nome}")
    )

# COMMAND ----------

resumo = [(tabela, spark.table(f"{db}.bronze_{tabela}").count()) for tabela in [*FONTES_INCREMENTAIS, *REFERENCIAS]]
display(spark.createDataFrame(resumo, "tabela string, registros long"))
