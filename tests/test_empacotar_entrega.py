import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("empacotar", Path(__file__).resolve().parents[1] / "scripts" / "empacotar_entrega.py")
modulo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(modulo)


class EmpacotarTest(unittest.TestCase):
    def test_nao_inclui_segredos_dependencias_ou_ferramentas_locais(self):
        with tempfile.TemporaryDirectory() as pasta:
            raiz = Path(pasta)
            arquivos = ["README.md", "dashboard/package.json", "dashboard/.env.local", "dashboard/.env.example", "dashboard/node_modules/a.js", "dashboard/.next/a.js", "dados/entrada/analises/lote.csv", "docs/video.md", "docs/agents/a.md", ".scratch/saida.zip", "AGENTS.md", "pipeline/__pycache__/a.pyc"]
            for arquivo in arquivos:
                caminho = raiz / arquivo
                caminho.parent.mkdir(parents=True, exist_ok=True)
                caminho.write_text("teste")
            selecionados = [p.relative_to(raiz).as_posix() for p in modulo.arquivos_do_pacote(raiz)]
            self.assertEqual(set(selecionados), {"README.md", "dashboard/package.json", "dashboard/.env.example", "dados/entrada/analises/lote.csv", "docs/video.md"})

    def test_so_aceita_link_do_campo_video(self):
        self.assertFalse(modulo.video_preenchido("- **Painel:** https://exemplo.com\n- **Vídeo:** PENDENTE"))
        self.assertTrue(modulo.video_preenchido("- **Vídeo:** https://youtu.be/exemplo"))
