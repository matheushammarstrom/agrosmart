# Databricks notebook source
# MAGIC %md
# MAGIC # Agregação (gold)
# MAGIC
# MAGIC Calcula as tabelas usadas pelo painel: ocorrências diárias, clima com risco de requeima, situação dos
# MAGIC talhões, alertas, fila de revisão e histórico de cargas. A data de referência é a última data com análises.

# COMMAND ----------

dbutils.widgets.text("catalogo", "workspace")
dbutils.widgets.text("schema", "agrosmart")
db = f"{dbutils.widgets.get('catalogo')}.{dbutils.widgets.get('schema')}"

# COMMAND ----------

from datetime import timedelta

from pyspark.sql import Window
from pyspark.sql import functions as F

JANELA_DIAS = 7
INCIDENCIA_MEDIA = 0.08
INCIDENCIA_ALTA = 0.15
DIAS_FAVORAVEIS_RISCO_ALTO = 3
DIAS_FAVORAVEIS_RISCO_MODERADO = 2


def salvar(df, tabela):
    df.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(f"{db}.{tabela}")


def percentual(parte, total):
    return F.expr(f"try_divide({parte}, {total})")


analises = spark.table(f"{db}.silver_analises")
talhoes = spark.table(f"{db}.silver_talhoes")
anomalias = spark.table(f"{db}.silver_anomalias")
clima = spark.table(f"{db}.silver_clima")

data_referencia = analises.agg(F.max("data")).first()[0]
inicio_janela = data_referencia - timedelta(days=JANELA_DIAS - 1)
inicio_janela_anterior = inicio_janela - timedelta(days=JANELA_DIAS)
fim_janela_anterior = inicio_janela - timedelta(days=1)
na_janela = F.col("data").between(F.lit(inicio_janela), F.lit(data_referencia))
print(f"Data de referência: {data_referencia} (janela de {inicio_janela} a {data_referencia})")

# COMMAND ----------

# MAGIC %md ## Séries diárias

# COMMAND ----------

ocorrencias = analises.groupBy("data", "fazenda_id", "talhao_id", "tipo_anomalia", "grupo").agg(
    F.count("*").alias("qtd_imagens"),
    F.round(F.avg("confianca"), 4).alias("confianca_media"),
    F.sum(F.col("baixa_confianca").cast("int")).alias("qtd_baixa_confianca"),
)

ultimos_5_dias = Window.partitionBy("fazenda_id").orderBy("data").rowsBetween(-4, 0)
clima_diario = clima.withColumn(
    "dias_favoraveis_5d", F.sum(F.col("dia_favoravel_requeima").cast("int")).over(ultimos_5_dias)
).withColumn(
    "risco_requeima",
    F.when(F.col("dias_favoraveis_5d") >= DIAS_FAVORAVEIS_RISCO_ALTO, "alto")
    .when(F.col("dias_favoraveis_5d") >= DIAS_FAVORAVEIS_RISCO_MODERADO, "moderado")
    .otherwise("baixo"),
)

salvar(ocorrencias, "gold_ocorrencias_diarias")
salvar(clima_diario, "gold_clima_diario")

# COMMAND ----------

# MAGIC %md ## Situação atual dos talhões

# COMMAND ----------


def indicadores(inicio, fim, sufixo):
    return (
        analises.filter(F.col("data").between(F.lit(inicio), F.lit(fim)))
        .groupBy("talhao_id")
        .agg(
            F.count("*").alias(f"imagens_{sufixo}"),
            F.sum((F.col("categoria") == "doente").cast("int")).alias(f"doentes_{sufixo}"),
        )
    )


atual = indicadores(inicio_janela, data_referencia, "7d")
anterior = indicadores(inicio_janela_anterior, fim_janela_anterior, "7d_anterior")

anomalias_na_janela = (
    analises.filter(na_janela & (F.col("categoria") == "doente"))
    .groupBy("fazenda_id", "talhao_id", "tipo_anomalia")
    .agg(F.count("*").alias("qtd"))
)
por_quantidade = Window.partitionBy("talhao_id").orderBy(F.col("qtd").desc(), "tipo_anomalia")
principal = (
    anomalias_na_janela.withColumn("_ordem", F.row_number().over(por_quantidade))
    .filter("_ordem = 1")
    .select("talhao_id", F.col("tipo_anomalia").alias("anomalia_principal"), F.col("qtd").alias("qtd_anomalia_principal"))
)

ultimo_dia = Window.partitionBy("fazenda_id").orderBy(F.col("data").desc())
clima_atual = (
    clima_diario.filter(F.col("data") <= F.lit(data_referencia))
    .withColumn("_ordem", F.row_number().over(ultimo_dia))
    .filter("_ordem = 1")
    .select("fazenda_id", F.col("risco_requeima").alias("risco_requeima_atual"), "dias_favoraveis_5d")
)

pct_doentes = F.col("pct_doentes_7d")
status = (
    talhoes.join(atual, "talhao_id", "left")
    .join(anterior, "talhao_id", "left")
    .join(principal, "talhao_id", "left")
    .join(clima_atual, "fazenda_id", "left")
    .withColumn("data_referencia", F.lit(data_referencia))
    .withColumn("pct_doentes_7d", F.round(percentual("doentes_7d", "imagens_7d"), 4))
    .withColumn("pct_doentes_7d_anterior", F.round(percentual("doentes_7d_anterior", "imagens_7d_anterior"), 4))
    .withColumn("variacao_pp", F.round((F.col("pct_doentes_7d") - F.col("pct_doentes_7d_anterior")) * 100, 1))
    .withColumn("pct_anomalia_principal", F.round(percentual("qtd_anomalia_principal", "imagens_7d"), 4))
    .withColumn(
        "status",
        F.when(pct_doentes >= INCIDENCIA_ALTA, "critico")
        .when((pct_doentes >= INCIDENCIA_MEDIA) | (F.col("risco_requeima_atual") == "alto"), "atencao")
        .otherwise("normal"),
    )
)
salvar(status, "gold_status_talhoes")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Alertas e ações recomendadas
# MAGIC
# MAGIC - Incidência: anomalia em 8% ou mais das imagens do talhão nos últimos 7 dias (alta a partir de 15%).
# MAGIC - Clima: 3 ou mais dos últimos 5 dias favoráveis à requeima na fazenda.

# COMMAND ----------

referencia = F.lit(data_referencia).alias("data_referencia")

alertas_incidencia = (
    anomalias_na_janela.join(atual.select("talhao_id", "imagens_7d"), "talhao_id")
    .withColumn("pct", F.col("qtd") / F.col("imagens_7d"))
    .filter(F.col("pct") >= INCIDENCIA_MEDIA)
    .join(anomalias.withColumnRenamed("codigo", "tipo_anomalia"), "tipo_anomalia")
    .select(
        referencia,
        "fazenda_id",
        "talhao_id",
        F.lit("incidencia").alias("tipo"),
        F.when(F.col("pct") >= INCIDENCIA_ALTA, "alta").otherwise("media").alias("severidade"),
        F.format_string("%s em %d%% das folhas", "nome", F.floor(F.col("pct") * 100)).alias("titulo"),
        F.format_string(
            "%d de %d imagens do talhão %s nos últimos %d dias.",
            "qtd",
            "imagens_7d",
            "talhao_id",
            F.lit(JANELA_DIAS),
        ).alias("descricao"),
        "acao_recomendada",
    )
)

alertas_clima = (
    spark.table(f"{db}.gold_status_talhoes")
    .filter(F.col("risco_requeima_atual") == "alto")
    .select("fazenda_id", "fazenda_nome", "dias_favoraveis_5d")
    .distinct()
    .select(
        referencia,
        "fazenda_id",
        F.lit(None).cast("string").alias("talhao_id"),
        F.lit("clima").alias("tipo"),
        F.lit("alta").alias("severidade"),
        F.lit("Clima favorável à requeima").alias("titulo"),
        F.format_string(
            "%d dos últimos 5 dias com umidade relativa ≥ 90%% e temperatura média entre 10 e 25 °C na %s.",
            "dias_favoraveis_5d",
            "fazenda_nome",
        ).alias("descricao"),
        F.lit(
            "Aplicar fungicida preventivo em todos os talhões da fazenda antes do aparecimento de sintomas "
            "e evitar irrigação por aspersão no fim do dia."
        ).alias("acao_recomendada"),
    )
)

salvar(alertas_incidencia.unionByName(alertas_clima), "gold_alertas")

# COMMAND ----------

# MAGIC %md ## Revisão manual e histórico de cargas

# COMMAND ----------

revisao = analises.filter("baixa_confianca").select(
    "id_imagem",
    "nome_imagem",
    "data_captura",
    "data",
    "fazenda_id",
    "talhao_id",
    "tipo_anomalia",
    "confianca",
    "fonte",
    "lote_id",
)
salvar(revisao, "gold_revisao")

recebidos = (
    spark.table(f"{db}.bronze_analises")
    .groupBy(F.col("_arquivo_origem").alias("arquivo"))
    .agg(
        F.count("*").alias("registros_recebidos"),
        F.max("fonte").alias("fonte"),
        F.max("_ingerido_em").alias("ingerido_em"),
    )
)
validos = analises.groupBy(F.col("_arquivo_origem").alias("arquivo")).agg(
    F.count("*").alias("registros_validos"),
    F.min("data").alias("periodo_inicio"),
    F.max("data").alias("periodo_fim"),
)
rejeitados = (
    spark.table(f"{db}.silver_analises_quarentena")
    .groupBy(F.col("_arquivo_origem").alias("arquivo"))
    .agg(F.count("*").alias("registros_quarentena"))
)
cargas = (
    recebidos.join(validos, "arquivo", "left")
    .join(rejeitados, "arquivo", "left")
    .fillna(0, subset=["registros_validos", "registros_quarentena"])
    .withColumn(
        "registros_duplicados",
        F.col("registros_recebidos") - F.col("registros_validos") - F.col("registros_quarentena"),
    )
)
salvar(cargas, "gold_cargas")

# COMMAND ----------

display(spark.table(f"{db}.gold_status_talhoes").orderBy("talhao_id"))
display(spark.table(f"{db}.gold_alertas").orderBy("severidade", "tipo"))
