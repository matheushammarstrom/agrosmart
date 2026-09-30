# Databricks notebook source
# MAGIC %md
# MAGIC # Transformação (silver)
# MAGIC
# MAGIC Converte os tipos, remove registros duplicados, valida as análises contra os cadastros e separa as
# MAGIC inválidas em `silver_analises_quarentena`. As tabelas são recriadas a cada execução.

# COMMAND ----------

dbutils.widgets.text("catalogo", "workspace")
dbutils.widgets.text("schema", "agrosmart")
db = f"{dbutils.widgets.get('catalogo')}.{dbutils.widgets.get('schema')}"

# COMMAND ----------

from pyspark.sql import Window
from pyspark.sql import functions as F

LIMITE_BAIXA_CONFIANCA = 0.80
UMIDADE_FAVORAVEL_REQUEIMA = 90
TEMPERATURA_FAVORAVEL_REQUEIMA = (10, 25)


def salvar(df, tabela):
    df.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(f"{db}.{tabela}")


def mais_recente(df, *chaves):
    janela = Window.partitionBy(*chaves).orderBy(F.col("_ingerido_em").desc(), F.col("_arquivo_origem").desc())
    return df.withColumn("_ordem", F.row_number().over(janela)).filter("_ordem = 1").drop("_ordem")


def numero(coluna):
    return F.expr(f"try_cast({coluna} AS DOUBLE)").alias(coluna)


# COMMAND ----------

# MAGIC %md ## Cadastros

# COMMAND ----------

talhoes = spark.table(f"{db}.bronze_talhoes").select(
    F.upper(F.trim("talhao_id")).alias("talhao_id"),
    "talhao_nome",
    "fazenda_id",
    "fazenda_nome",
    "municipio",
    "uf",
    numero("latitude"),
    numero("longitude"),
    numero("area_ha"),
    "cultivar",
    "sistema_irrigacao",
)
anomalias = spark.table(f"{db}.bronze_anomalias").select(
    F.lower(F.trim("codigo")).alias("codigo"), "nome", "nome_cientifico", "grupo", "acao_recomendada"
)
salvar(talhoes, "silver_talhoes")
salvar(anomalias, "silver_anomalias")

# COMMAND ----------

# MAGIC %md ## Análises de imagens

# COMMAND ----------

bronze_analises = spark.table(f"{db}.bronze_analises")

analises = (
    mais_recente(bronze_analises.withColumn("id_imagem", F.trim("id_imagem")), "id_imagem")
    .select(
        "id_imagem",
        "nome_imagem",
        F.expr("try_cast(data_captura AS TIMESTAMP)").alias("data_captura"),
        F.upper(F.trim("talhao_id")).alias("talhao_id"),
        F.lower(F.trim("origem")).alias("origem"),
        F.lower(F.trim("tipo_anomalia")).alias("tipo_anomalia"),
        numero("confianca"),
        "modelo_versao",
        "fonte",
        "lote_id",
        "_arquivo_origem",
        "_ingerido_em",
    )
    .join(F.broadcast(talhoes.select("talhao_id", "fazenda_id")), "talhao_id", "left")
    .join(
        F.broadcast(anomalias.select(F.col("codigo").alias("tipo_anomalia"), "grupo")),
        "tipo_anomalia",
        "left",
    )
    .withColumn(
        "motivo_rejeicao",
        F.when(F.col("data_captura").isNull(), "data de captura inválida")
        .when(F.col("fazenda_id").isNull(), "talhão desconhecido")
        .when(F.col("grupo").isNull(), "tipo de anomalia desconhecido")
        .when(~F.coalesce(F.col("confianca").between(0, 1), F.lit(False)), "confiança inválida"),
    )
)

validas = (
    analises.filter(F.col("motivo_rejeicao").isNull())
    .drop("motivo_rejeicao")
    .withColumn("data", F.to_date("data_captura"))
    .withColumn("categoria", F.when(F.col("tipo_anomalia") == "saudavel", "saudavel").otherwise("doente"))
    .withColumn("baixa_confianca", F.col("confianca") < LIMITE_BAIXA_CONFIANCA)
)
quarentena = analises.filter(F.col("motivo_rejeicao").isNotNull())

salvar(validas, "silver_analises")
salvar(quarentena, "silver_analises_quarentena")

# COMMAND ----------

# MAGIC %md ## Clima

# COMMAND ----------

temp_min, temp_max = TEMPERATURA_FAVORAVEL_REQUEIMA
clima = (
    mais_recente(spark.table(f"{db}.bronze_clima"), "data", "fazenda_id")
    .select(
        F.expr("try_cast(data AS DATE)").alias("data"),
        "fazenda_id",
        numero("temp_min_c"),
        numero("temp_max_c"),
        numero("umidade_relativa_pct"),
        numero("precipitacao_mm"),
    )
    .filter(F.col("data").isNotNull())
    .withColumn("temp_media_c", F.round((F.col("temp_min_c") + F.col("temp_max_c")) / 2, 1))
    .withColumn(
        "dia_favoravel_requeima",
        (F.col("umidade_relativa_pct") >= UMIDADE_FAVORAVEL_REQUEIMA)
        & F.col("temp_media_c").between(temp_min, temp_max),
    )
)

salvar(clima, "silver_clima")

# COMMAND ----------

recebidas = bronze_analises.count()
resumo = [
    ("análises recebidas (bronze)", recebidas),
    ("análises válidas", spark.table(f"{db}.silver_analises").count()),
    ("análises em quarentena", spark.table(f"{db}.silver_analises_quarentena").count()),
    ("dias de clima", spark.table(f"{db}.silver_clima").count()),
]
display(spark.createDataFrame(resumo, "etapa string, registros long"))
display(spark.table(f"{db}.silver_analises_quarentena").groupBy("motivo_rejeicao").count())
