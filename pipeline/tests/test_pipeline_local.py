"""Testes dos notebooks reais em Spark local, sem workspace ou credenciais."""
import csv
import importlib.util
from pathlib import Path
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "gerar_snapshot_local.py"


class PipelineLocalTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location("pipeline_local", SCRIPT)
        cls.modulo = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.modulo)
        cls.spark = cls.modulo.criar_spark()
        cls.raiz = Path(__file__).resolve().parents[2] / "dados" / "entrada"

    @classmethod
    def tearDownClass(cls):
        cls.spark.stop()

    def entrada(self, pasta, linhas):
        for nome in ("referencia", "analises", "clima"):
            (pasta / nome).mkdir()
        for nome in ("talhoes.csv", "anomalias.csv"):
            (pasta / "referencia" / nome).write_bytes((self.raiz / "referencia" / nome).read_bytes())
        with (self.raiz / "analises" / "analises_2026-09.csv").open() as referencia:
            cabecalho = next(csv.reader(referencia))
        with (pasta / "analises" / "lote.csv").open("w", newline="") as arquivo:
            writer = csv.writer(arquivo)
            writer.writerow(cabecalho)
            writer.writerows(linhas)
        (pasta / "clima" / "clima.csv").write_text("data,fazenda_id,temp_min_c,temp_max_c,umidade_relativa_pct,precipitacao_mm\n2026-09-30,BV,13,19,91,4\n")

    def test_zero_validas_nao_inventa_data_e_nao_derruba_gold(self):
        for linhas in ([], [["id-invalido", "foto.jpg", "data-invalida", "BV-01", "smartphone", "doente", "requeima", "0.9", "v1", "simulado", "lote"]]):
            with self.subTest(linhas=linhas), tempfile.TemporaryDirectory() as pasta:
                entrada = Path(pasta)
                self.entrada(entrada, linhas)
                snapshot = self.modulo.gerar_snapshot(entrada, self.spark)
                self.assertEqual(snapshot["tabelas"]["ocorrencias"]["rows"], [])
                talhoes = self.modulo.linhas_como_dict(snapshot["tabelas"]["talhoes"])
                self.assertEqual(len(talhoes), 12)
                self.assertTrue(all(t["data_referencia"] is None and t["status"] == "inconclusivo" for t in talhoes))
                self.assertEqual(snapshot["tabelas"]["alertas"]["rows"], [])

    def test_origem_contagens_revisao_e_reenvio_reconciliam(self):
        linhas = [
            ["id-1", "foto1.jpg", "2026-09-30 08:00:00", "BV-01", "smartphone", "saudavel", "saudavel", "0.95", "v1", "simulado", "lote"],
            ["id-2", "foto2.jpg", "2026-09-30 08:01:00", "BV-01", "smartphone", "doente", "requeima", "0.7", "v1", "classificador_fase1", "lote"],
        ]
        with tempfile.TemporaryDirectory() as pasta:
            entrada = Path(pasta)
            self.entrada(entrada, linhas + [linhas[1]])
            snapshot = self.modulo.gerar_snapshot(entrada, self.spark)
            ocorrencias = self.modulo.linhas_como_dict(snapshot["tabelas"]["ocorrencias"])
            self.assertEqual(sum(int(o["qtd_imagens"]) for o in ocorrencias), 2)
            self.assertEqual({o["fonte"] for o in ocorrencias}, {"simulado", "classificador_fase1"})
            self.assertEqual(len(snapshot["tabelas"]["revisao"]["rows"]), 1)
            cargas = self.modulo.linhas_como_dict(snapshot["tabelas"]["cargas"])
            self.assertEqual(int(cargas[0]["registros_duplicados"]), 1)
            self.assertEqual(cargas[0]["fonte"], "misto")
            self.assertEqual(snapshot["tabelas"], self.modulo.gerar_snapshot(entrada, self.spark)["tabelas"])
