import argparse
import json
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
CONSULTAS = RAIZ / "dashboard" / "src" / "lib" / "consultas.json"
SAIDA = RAIZ / "dashboard" / "src" / "data" / "snapshot.json"


def parse_args():
    parser = argparse.ArgumentParser(description="Exporta as tabelas gold para o snapshot do painel.")
    parser.add_argument("--perfil", default="agrosmart", help="Perfil do Databricks CLI.")
    parser.add_argument("--warehouse", help="ID do SQL warehouse (padrão: o primeiro do workspace).")
    parser.add_argument("--schema", default="workspace.agrosmart", help="Catálogo e schema das tabelas.")
    return parser.parse_args()


def databricks(perfil, *argumentos):
    resultado = subprocess.run(
        ["databricks", *argumentos, "-p", perfil, "-o", "json"], capture_output=True, text=True, check=True
    )
    return json.loads(resultado.stdout)


def primeiro_warehouse(perfil):
    warehouses = databricks(perfil, "warehouses", "list")
    if not warehouses:
        raise SystemExit("Nenhum SQL warehouse encontrado no workspace.")
    return warehouses[0]["id"]


def consultar(perfil, warehouse, sql):
    corpo = {
        "statement": sql,
        "warehouse_id": warehouse,
        "wait_timeout": "50s",
        "on_wait_timeout": "CONTINUE",
        "disposition": "INLINE",
        "format": "JSON_ARRAY",
    }
    resposta = databricks(perfil, "api", "post", "/api/2.0/sql/statements", "--json", json.dumps(corpo))
    while resposta["status"]["state"] in ("PENDING", "RUNNING"):
        time.sleep(2)
        resposta = databricks(perfil, "api", "get", f"/api/2.0/sql/statements/{resposta['statement_id']}")

    if resposta["status"]["state"] != "SUCCEEDED":
        erro = resposta["status"].get("error", {}).get("message", resposta["status"]["state"])
        raise SystemExit(f"Falha na consulta {sql!r}: {erro}")

    colunas = [
        {"name": coluna["name"], "type_name": coluna["type_name"]}
        for coluna in resposta["manifest"]["schema"].get("columns", [])
    ]
    resultado = resposta.get("result", {})
    linhas = list(resultado.get("data_array", []))
    while resultado.get("next_chunk_internal_link"):
        resultado = databricks(perfil, "api", "get", resultado["next_chunk_internal_link"])
        linhas.extend(resultado.get("data_array", []))
    return {"columns": colunas, "rows": linhas}


def main():
    args = parse_args()
    warehouse = args.warehouse or primeiro_warehouse(args.perfil)
    consultas = json.loads(CONSULTAS.read_text(encoding="utf-8"))

    tabelas = {}
    for nome, sql in consultas.items():
        tabelas[nome] = consultar(args.perfil, warehouse, sql.replace("{db}", args.schema))
        print(f"{nome}: {len(tabelas[nome]['rows'])} linhas")

    snapshot = {"geradoEm": datetime.now(timezone.utc).isoformat(timespec="seconds"), "tabelas": tabelas}
    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    SAIDA.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Snapshot salvo em {SAIDA.relative_to(RAIZ)} ({SAIDA.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
