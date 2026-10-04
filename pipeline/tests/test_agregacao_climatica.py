from datetime import date, timedelta
from pathlib import Path
import sys
import unittest

from pyspark.sql import SparkSession
from pyspark.sql.types import (
    BooleanType,
    DateType,
    DoubleType,
    IntegerType,
    StringType,
    StructField,
    StructType,
)

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "notebooks"))
from agregacao_climatica import (
    classificar_status_talhoes,
    construir_clima_diario,
    situacao_climatica_por_fazenda,
)


class AgregacaoClimaticaTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.spark = SparkSession.builder.master("local[1]").appName("agrosmart-clima-tests").getOrCreate()
        cls.spark.sparkContext.setLogLevel("ERROR")
        cls.schema = StructType(
            [
                StructField("data", DateType(), False),
                StructField("fazenda_id", StringType(), False),
                StructField("dia_favoravel_requeima", BooleanType(), True),
            ]
        )

    @classmethod
    def tearDownClass(cls):
        cls.spark.stop()

    def climate(self, rows):
        return self.spark.createDataFrame(rows, self.schema)

    def test_unavailable_climate_or_analysis_never_becomes_normal(self):
        schema = StructType(
            [
                StructField("pct_doentes_7d", DoubleType(), True),
                StructField("imagens_7d", IntegerType(), True),
                StructField("risco_requeima_atual", StringType(), True),
                StructField("situacao_clima", StringType(), True),
            ]
        )
        rows = [
            (0.02, 38, None, "ausente"),
            (0.02, 38, None, "desatualizado"),
            (None, None, "baixo", "valido"),
            (0.02, 38, "baixo", "valido"),
            (0.08, 38, None, "incompleto"),
            (0.16, 38, None, "ausente"),
        ]

        actual = {
            row["situacao_clima"] + ":" + str(row["pct_doentes_7d"]): row["status"]
            for row in classificar_status_talhoes(
                self.spark.createDataFrame(rows, schema),
                incidencia_media=0.08,
                incidencia_alta=0.15,
            ).collect()
        }

        self.assertEqual(
            actual,
            {
                "ausente:0.02": "inconclusivo",
                "desatualizado:0.02": "inconclusivo",
                "valido:None": "inconclusivo",
                "valido:0.02": "normal",
                "incompleto:0.08": "atencao",
                "ausente:0.16": "critico",
            },
        )

    def test_complete_calendar_window_keeps_existing_thresholds_and_dates(self):
        rows = [
            (date(2026, 9, 26), "BV", True),
            (date(2026, 9, 27), "BV", True),
            (date(2026, 9, 28), "BV", False),
            (date(2026, 9, 29), "BV", False),
            (date(2026, 9, 30), "BV", True),
        ]

        actual = construir_clima_diario(self.climate(rows)).where("data = '2026-09-30'").first().asDict()

        self.assertEqual(actual["inicio_periodo_5d"], date(2026, 9, 26))
        self.assertEqual(actual["fim_periodo_5d"], date(2026, 9, 30))
        self.assertEqual(actual["dias_clima_registrados_5d"], 5)
        self.assertEqual(actual["dias_clima_avaliaveis_5d"], 5)
        self.assertTrue(actual["janela_5d_completa"])
        self.assertEqual(actual["dias_favoraveis_5d"], 3)
        self.assertEqual(actual["risco_requeima"], "alto")


    def test_existing_risk_thresholds_apply_only_after_full_coverage(self):
        thresholds = {"alto": 3, "moderado": 2, "baixo": 1, "baixo_zero": 0}
        rows = [
            (date(2026, 9, 26) + timedelta(days=offset), fazenda, offset < favoraveis)
            for fazenda, favoraveis in thresholds.items()
            for offset in range(5)
        ]

        actual = {
            row["fazenda_id"]: row["risco_requeima"]
            for row in construir_clima_diario(self.climate(rows))
            .where("data = '2026-09-30'")
            .select("fazenda_id", "risco_requeima")
            .collect()
        }

        self.assertEqual(
            actual,
            {"alto": "alto", "moderado": "moderado", "baixo": "baixo", "baixo_zero": "baixo"},
        )

    def test_missing_calendar_day_makes_risk_unavailable_not_low(self):
        rows = [
            (date(2026, 9, 26), "BV", True),
            (date(2026, 9, 27), "BV", True),
            (date(2026, 9, 28), "BV", False),
            (date(2026, 9, 30), "BV", True),
            (date(2026, 10, 1), "BV", True),
        ]

        actual = construir_clima_diario(self.climate(rows)).where("data = '2026-10-01'").first().asDict()

        self.assertEqual(actual["inicio_periodo_5d"], date(2026, 9, 27))
        self.assertEqual(actual["fim_periodo_5d"], date(2026, 10, 1))
        self.assertEqual(actual["dias_clima_registrados_5d"], 4)
        self.assertFalse(actual["janela_5d_completa"])
        self.assertIsNone(actual["dias_favoraveis_5d"])
        self.assertIsNone(actual["risco_requeima"])

    def test_old_climate_keeps_its_date_but_is_not_a_current_risk(self):
        rows = [
            (date(2026, 9, 26), "BV", True),
            (date(2026, 9, 27), "BV", True),
            (date(2026, 9, 28), "BV", False),
            (date(2026, 9, 29), "BV", False),
            (date(2026, 9, 30), "BV", True),
        ]
        climate = construir_clima_diario(self.climate(rows))
        farms = self.spark.createDataFrame([("BV",), ("SC",)], ["fazenda_id"])

        actual = {
            row["fazenda_id"]: row.asDict()
            for row in situacao_climatica_por_fazenda(climate, farms, date(2026, 10, 1)).collect()
        }

        self.assertEqual(actual["BV"]["data_clima_disponivel"], date(2026, 9, 30))
        self.assertEqual(actual["BV"]["situacao_clima"], "desatualizado")
        self.assertEqual(actual["BV"]["risco_requeima_ultimo_clima"], "alto")
        self.assertIsNone(actual["BV"]["risco_requeima_atual"])
        self.assertEqual(actual["SC"]["situacao_clima"], "ausente")
        self.assertIsNone(actual["SC"]["risco_requeima_atual"])


    def test_complete_climate_on_reference_is_the_current_risk(self):
        rows = [
            (date(2026, 9, 26), "BV", True),
            (date(2026, 9, 27), "BV", True),
            (date(2026, 9, 28), "BV", False),
            (date(2026, 9, 29), "BV", False),
            (date(2026, 9, 30), "BV", True),
        ]
        climate = construir_clima_diario(self.climate(rows))
        farms = self.spark.createDataFrame([("BV",)], ["fazenda_id"])

        actual = situacao_climatica_por_fazenda(climate, farms, date(2026, 9, 30)).first().asDict()

        self.assertEqual(actual["situacao_clima"], "valido")
        self.assertEqual(actual["risco_requeima_atual"], "alto")
        self.assertEqual(actual["dias_favoraveis_5d"], 3)

    def test_exact_reference_with_missing_window_reports_incomplete(self):
        rows = [
            (date(2026, 9, 26), "BV", True),
            (date(2026, 9, 27), "BV", True),
            (date(2026, 9, 28), "BV", False),
            (date(2026, 9, 30), "BV", True),
            (date(2026, 10, 1), "BV", True),
        ]
        climate = construir_clima_diario(self.climate(rows))
        farms = self.spark.createDataFrame([("BV",)], ["fazenda_id"])

        actual = situacao_climatica_por_fazenda(climate, farms, date(2026, 10, 1)).first().asDict()

        self.assertEqual(actual["data_clima_disponivel"], date(2026, 10, 1))
        self.assertEqual(actual["situacao_clima"], "incompleto")
        self.assertIsNone(actual["risco_requeima_atual"])


if __name__ == "__main__":
    unittest.main()
