# Databricks notebook source

from pyspark.sql import Window
from pyspark.sql import functions as F

DIAS_JANELA_CLIMA = 5
DIAS_FAVORAVEIS_RISCO_ALTO = 3
DIAS_FAVORAVEIS_RISCO_MODERADO = 2


def construir_clima_diario(clima):
    """Calcula o risco climático em janelas completas de cinco dias de calendário por fazenda."""
    limites = clima.groupBy("fazenda_id").agg(
        F.min("data").alias("primeira_data"),
        F.max("data").alias("ultima_data"),
    )
    calendario = limites.select(
        "fazenda_id",
        F.explode(F.expr("sequence(primeira_data, ultima_data, interval 1 day)")).alias("data"),
    )
    diario = calendario.join(
        clima.withColumn("_registro_clima", F.lit(True)),
        ["fazenda_id", "data"],
        "left",
    )
    janela = Window.partitionBy("fazenda_id").orderBy("data").rowsBetween(-(DIAS_JANELA_CLIMA - 1), 0)
    diario = (
        diario.withColumn("_dias_calendario_5d", F.count(F.lit(1)).over(janela))
        .withColumn(
            "dias_clima_registrados_5d",
            F.sum(F.when(F.col("_registro_clima").isNotNull(), 1).otherwise(0)).over(janela),
        )
        .withColumn(
            "dias_clima_avaliaveis_5d",
            F.sum(F.when(F.col("dia_favoravel_requeima").isNotNull(), 1).otherwise(0)).over(janela),
        )
        .withColumn(
            "_favoraveis_5d",
            F.sum(F.when(F.col("dia_favoravel_requeima") == F.lit(True), 1).otherwise(0)).over(janela),
        )
        .withColumn(
            "janela_5d_completa",
            (F.col("_dias_calendario_5d") == DIAS_JANELA_CLIMA)
            & (F.col("dias_clima_avaliaveis_5d") == DIAS_JANELA_CLIMA),
        )
        .withColumn("inicio_periodo_5d", F.date_sub("data", DIAS_JANELA_CLIMA - 1))
        .withColumn("fim_periodo_5d", F.col("data"))
        .withColumn(
            "dias_favoraveis_5d",
            F.when(F.col("janela_5d_completa"), F.col("_favoraveis_5d")),
        )
        .withColumn(
            "risco_requeima",
            F.when(
                F.col("janela_5d_completa")
                & (F.col("dias_favoraveis_5d") >= DIAS_FAVORAVEIS_RISCO_ALTO),
                "alto",
            )
            .when(
                F.col("janela_5d_completa")
                & (F.col("dias_favoraveis_5d") >= DIAS_FAVORAVEIS_RISCO_MODERADO),
                "moderado",
            )
            .when(F.col("janela_5d_completa"), "baixo"),
        )
        .drop("_dias_calendario_5d", "_favoraveis_5d")
    )
    return diario


def situacao_climatica_por_fazenda(clima_diario, fazendas, data_referencia):
    """Retorna o último clima por fazenda e distingue dados atuais, antigos e ausentes."""
    mais_recente = Window.partitionBy("fazenda_id").orderBy(F.col("data").desc())
    ultimo_clima = (
        clima_diario.filter(
            F.col("_registro_clima").isNotNull() & (F.col("data") <= F.lit(data_referencia))
        )
        .withColumn("_ordem", F.row_number().over(mais_recente))
        .filter(F.col("_ordem") == 1)
        .select(
            "fazenda_id",
            F.col("data").alias("data_clima_disponivel"),
            F.col("inicio_periodo_5d").alias("inicio_periodo_clima_5d"),
            F.col("fim_periodo_5d").alias("fim_periodo_clima_5d"),
            F.col("dias_clima_registrados_5d").alias("dias_clima_registrados_5d"),
            F.col("dias_clima_avaliaveis_5d").alias("dias_clima_avaliaveis_5d"),
            F.col("janela_5d_completa").alias("janela_5d_completa"),
            F.col("dias_favoraveis_5d").alias("dias_favoraveis_5d_ultimo_clima"),
            F.col("risco_requeima").alias("risco_requeima_ultimo_clima"),
        )
    )
    situacao = fazendas.join(ultimo_clima, "fazenda_id", "left").withColumn(
        "situacao_clima",
        F.when(F.col("data_clima_disponivel").isNull(), "ausente")
        .when(F.col("data_clima_disponivel") < F.lit(data_referencia), "desatualizado")
        .when(~F.coalesce(F.col("janela_5d_completa"), F.lit(False)), "incompleto")
        .otherwise("valido"),
    )
    return (
        situacao.withColumn(
            "risco_requeima_atual",
            F.when(F.col("situacao_clima") == "valido", F.col("risco_requeima_ultimo_clima")),
        )
        .withColumn(
            "dias_favoraveis_5d",
            F.when(F.col("situacao_clima") == "valido", F.col("dias_favoraveis_5d_ultimo_clima")),
        )
    )


def classificar_status_talhoes(talhoes, incidencia_media, incidencia_alta):
    """Não indica normalidade sem análises e clima atual suficientes."""
    pct_doentes = F.col("pct_doentes_7d")
    return talhoes.withColumn(
        "status",
        F.when(pct_doentes >= incidencia_alta, "critico")
        .when(
            (pct_doentes >= incidencia_media) | (F.col("risco_requeima_atual") == "alto"),
            "atencao",
        )
        .when(
            F.col("imagens_7d").isNotNull() & (F.col("situacao_clima") == "valido"),
            "normal",
        )
        .otherwise("inconclusivo"),
    )
