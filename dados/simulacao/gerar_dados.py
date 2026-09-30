import argparse
import csv
import random
import uuid
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
INICIO = date(2026, 4, 1)
FIM = date(2026, 9, 30)
NAMESPACE_IDS = uuid.UUID("6f1c2a9e-4b7d-4f3a-9c55-0a9d6c1e2b10")
MODELO_VERSAO = "agrosmart-v1"

FAZENDAS = {
    "BV": {
        "nome": "Fazenda Boa Vista",
        "municipio": "Bom Repouso",
        "uf": "MG",
        "lat": -22.470,
        "lon": -46.141,
        "temp_media": [18.0, 15.5, 14.0, 13.5, 15.0, 17.0],
        "amplitude": 11.0,
        "umidade": [80, 79, 77, 74, 70, 72],
        "eventos_chuva_mes": [3.0, 1.5, 1.0, 0.8, 1.0, 2.0],
        "chuva_evento_mm": (3, 20),
        "origem": "smartphone",
    },
    "SC": {
        "nome": "Fazenda Santa Clara",
        "municipio": "Guarapuava",
        "uf": "PR",
        "lat": -25.395,
        "lon": -51.462,
        "temp_media": [17.0, 14.0, 12.0, 12.0, 13.5, 15.0],
        "amplitude": 10.0,
        "umidade": [81, 82, 83, 81, 79, 80],
        "eventos_chuva_mes": [3.5, 3.5, 3.5, 3.5, 3.0, 3.5],
        "chuva_evento_mm": (6, 30),
        "origem": "smartphone",
    },
    "TI": {
        "nome": "Fazenda Três Irmãos",
        "municipio": "São Gotardo",
        "uf": "MG",
        "lat": -19.311,
        "lon": -46.049,
        "temp_media": [21.5, 19.5, 18.0, 18.0, 20.0, 22.5],
        "amplitude": 14.0,
        "umidade": [72, 65, 60, 54, 48, 52],
        "eventos_chuva_mes": [2.0, 0.6, 0.2, 0.1, 0.2, 1.0],
        "chuva_evento_mm": (2, 15),
        "origem": "drone",
    },
}

TALHOES = [
    ("BV-01", "BV", "Ágata", 18, "aspersão convencional", (0.004, -0.006)),
    ("BV-02", "BV", "Asterix", 22, "pivô central", (0.006, 0.005)),
    ("BV-03", "BV", "Ágata", 12, "aspersão convencional", (-0.005, 0.004)),
    ("BV-04", "BV", "Orchestra", 9, "gotejamento", (-0.006, -0.005)),
    ("SC-01", "SC", "Asterix", 30, "sequeiro", (0.007, -0.008)),
    ("SC-02", "SC", "Ágata", 25, "sequeiro", (0.008, 0.006)),
    ("SC-03", "SC", "Atlantic", 20, "sequeiro", (-0.006, 0.007)),
    ("SC-04", "SC", "Orchestra", 15, "gotejamento", (-0.007, -0.006)),
    ("TI-01", "TI", "Atlantic", 45, "pivô central", (0.010, -0.010)),
    ("TI-02", "TI", "Asterix", 40, "pivô central", (0.011, 0.009)),
    ("TI-03", "TI", "Markies", 35, "pivô central", (-0.009, 0.010)),
    ("TI-04", "TI", "Ágata", 28, "aspersão convencional", (-0.010, -0.009)),
]

ANOMALIAS = [
    ("saudavel", "Folha saudável", "", "nenhum", ""),
    (
        "requeima",
        "Requeima",
        "Phytophthora infestans",
        "doenca",
        "Aplicar fungicida sistêmico e reduzir o molhamento foliar (evitar irrigação por aspersão no fim do dia).",
    ),
    (
        "pinta_preta",
        "Pinta-preta",
        "Alternaria solani",
        "doenca",
        "Aplicar fungicida protetor, eliminar restos culturais e revisar a adubação do talhão.",
    ),
    (
        "vaquinha",
        "Vaquinha",
        "Diabrotica speciosa",
        "praga",
        "Monitorar as bordaduras e iniciar o controle quando a infestação atingir o nível de ação.",
    ),
    (
        "mosca_minadora",
        "Mosca-minadora",
        "Liriomyza huidobrensis",
        "praga",
        "Instalar armadilhas adesivas amarelas e fazer controle direcionado, preservando inimigos naturais.",
    ),
]

EVENTOS_CLIMA = [
    ("BV", date(2026, 5, 6), date(2026, 5, 13), "umido"),
    ("SC", date(2026, 6, 8), date(2026, 6, 16), "umido"),
    ("SC", date(2026, 8, 8), date(2026, 8, 12), "umido"),
    ("TI", date(2026, 8, 25), date(2026, 9, 30), "calor"),
    ("BV", date(2026, 9, 22), date(2026, 9, 30), "umido"),
]

SURTOS = [
    ("BV-03", "requeima", date(2026, 5, 14), date(2026, 5, 24), date(2026, 6, 10), 0.22),
    ("BV-01", "requeima", date(2026, 5, 16), date(2026, 5, 26), date(2026, 6, 8), 0.10),
    ("BV-02", "requeima", date(2026, 5, 17), date(2026, 5, 27), date(2026, 6, 6), 0.07),
    ("BV-04", "requeima", date(2026, 5, 18), date(2026, 5, 27), date(2026, 6, 2), 0.03),
    ("SC-02", "requeima", date(2026, 6, 17), date(2026, 6, 27), date(2026, 7, 20), 0.38),
    ("SC-01", "requeima", date(2026, 6, 19), date(2026, 6, 29), date(2026, 7, 16), 0.18),
    ("SC-03", "requeima", date(2026, 6, 20), date(2026, 6, 30), date(2026, 7, 15), 0.13),
    ("SC-04", "requeima", date(2026, 6, 21), date(2026, 6, 30), date(2026, 7, 10), 0.05),
    ("SC-02", "requeima", date(2026, 8, 13), date(2026, 8, 20), date(2026, 9, 1), 0.09),
    ("SC-01", "requeima", date(2026, 8, 14), date(2026, 8, 21), date(2026, 8, 31), 0.07),
    ("TI-03", "mosca_minadora", date(2026, 7, 5), date(2026, 7, 26), date(2026, 8, 20), 0.12),
    ("TI-04", "mosca_minadora", date(2026, 7, 15), date(2026, 8, 6), date(2026, 8, 28), 0.08),
    ("TI-02", "pinta_preta", date(2026, 8, 1), date(2026, 9, 22), date(2026, 10, 15), 0.22),
    ("TI-03", "pinta_preta", date(2026, 8, 10), date(2026, 9, 18), date(2026, 10, 10), 0.14),
    ("TI-01", "vaquinha", date(2026, 9, 2), date(2026, 9, 22), date(2026, 10, 15), 0.18),
    ("TI-04", "vaquinha", date(2026, 9, 5), date(2026, 9, 20), date(2026, 10, 10), 0.12),
    ("BV-02", "pinta_preta", date(2026, 8, 25), date(2026, 9, 10), date(2026, 9, 28), 0.06),
    ("BV-03", "requeima", date(2026, 9, 22), date(2026, 10, 5), date(2026, 10, 25), 0.28),
    ("BV-01", "requeima", date(2026, 9, 24), date(2026, 10, 7), date(2026, 10, 25), 0.15),
]

PREVALENCIA_BASE = {"requeima": 0.010, "pinta_preta": 0.012, "vaquinha": 0.008, "mosca_minadora": 0.006}
BASE_POR_FAZENDA = {"TI": {"requeima": 0.003}, "SC": {"pinta_preta": 0.006}}


def parse_args():
    parser = argparse.ArgumentParser(description="Gera os dados simulados do AgroSmart.")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--saida", type=Path, default=RAIZ / "dados" / "entrada")
    return parser.parse_args()


def dias(inicio, fim):
    atual = inicio
    while atual <= fim:
        yield atual
        atual += timedelta(days=1)


def suavizar(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


def intensidade_surto(dia, inicio, pico, fim):
    if dia < inicio or dia > fim:
        return 0.0
    if dia <= pico:
        return suavizar((dia - inicio).days / max((pico - inicio).days, 1))
    return 1.0 - suavizar((dia - pico).days / max((fim - pico).days, 1))


def evento_no_dia(fazenda_id, dia):
    for fazenda, inicio, fim, tipo in EVENTOS_CLIMA:
        if fazenda == fazenda_id and inicio <= dia <= fim:
            return tipo
    return None


def gerar_clima(rng):
    clima = {}
    for fazenda_id, fazenda in FAZENDAS.items():
        ruido_temp = ruido_umidade = 0.0
        dias_chuva_restantes = 0

        for dia in dias(INICIO, FIM):
            mes = dia.month - INICIO.month
            ruido_temp = 0.7 * ruido_temp + rng.gauss(0, 0.9)
            ruido_umidade = 0.6 * ruido_umidade + rng.gauss(0, 3)
            temp_media = fazenda["temp_media"][mes] + ruido_temp
            umidade = fazenda["umidade"][mes] + ruido_umidade
            amplitude = fazenda["amplitude"] + rng.gauss(0, 1)
            chuva = 0.0
            evento = evento_no_dia(fazenda_id, dia)

            if evento is None and dias_chuva_restantes == 0:
                if rng.random() < fazenda["eventos_chuva_mes"][mes] / 30:
                    dias_chuva_restantes = rng.randint(1, 3)

            if evento == "umido":
                umidade = rng.uniform(91, 97)
                chuva = rng.uniform(5, 28)
                amplitude *= 0.5
                temp_media -= 1.0
            elif evento == "calor":
                temp_media += 2.5
                umidade -= 10
                amplitude += 2
                dias_chuva_restantes = 0
            elif dias_chuva_restantes > 0:
                umidade = rng.uniform(86, 94)
                chuva = rng.uniform(*fazenda["chuva_evento_mm"])
                amplitude *= 0.6
                temp_media -= 1.0
                dias_chuva_restantes -= 1

            umidade = min(max(umidade, 25), 99)
            clima[(fazenda_id, dia)] = {
                "data": dia.isoformat(),
                "fazenda_id": fazenda_id,
                "temp_min_c": round(temp_media - amplitude / 2, 1),
                "temp_max_c": round(temp_media + amplitude / 2, 1),
                "umidade_relativa_pct": round(umidade, 1),
                "precipitacao_mm": round(chuva, 1),
            }
    return clima


def prevalencias(talhao_id, fazenda_id, dia):
    valores = dict(PREVALENCIA_BASE)
    valores.update(BASE_POR_FAZENDA.get(fazenda_id, {}))
    for talhao, anomalia, inicio, pico, fim, pico_prev in SURTOS:
        if talhao == talhao_id:
            valores[anomalia] += pico_prev * intensidade_surto(dia, inicio, pico, fim)
    return valores


def sortear_anomalia(rng, valores):
    sorteio = rng.random()
    acumulado = 0.0
    for anomalia, prevalencia in valores.items():
        acumulado += prevalencia
        if sorteio < acumulado:
            return anomalia
    return "saudavel"


def sortear_confianca(rng, anomalia):
    chance_baixa = 0.03 if anomalia == "saudavel" else 0.08
    if rng.random() < chance_baixa:
        return rng.uniform(0.52, 0.79)
    return 1 - 0.18 * rng.random() ** 2


def gerar_analises(rng):
    analises = []
    for talhao_id, fazenda_id, _, area, _, _ in TALHOES:
        origem = FAZENDAS[fazenda_id]["origem"]
        for dia in dias(INICIO, FIM):
            if dia.weekday() not in (0, 2, 4) or rng.random() < 0.08:
                continue

            valores = prevalencias(talhao_id, fazenda_id, dia)
            quantidade = max(10, int(rng.gauss(18 + 0.6 * area, 4)))
            inicio_inspecao = datetime(dia.year, dia.month, dia.day, 7) + timedelta(minutes=rng.randint(0, 180))

            for sequencia in range(1, quantidade + 1):
                anomalia = sortear_anomalia(rng, valores)
                captura = inicio_inspecao + timedelta(seconds=40 * sequencia + rng.randint(0, 30))
                analises.append(
                    {
                        "id_imagem": str(uuid.uuid5(NAMESPACE_IDS, f"{talhao_id}-{dia}-{sequencia}")),
                        "nome_imagem": f"{talhao_id}_{dia:%Y%m%d}_{sequencia:04d}.jpg",
                        "data_captura": captura.strftime("%Y-%m-%d %H:%M:%S"),
                        "talhao_id": talhao_id,
                        "origem": origem,
                        "categoria": "saudavel" if anomalia == "saudavel" else "doente",
                        "tipo_anomalia": anomalia,
                        "confianca": f"{sortear_confianca(rng, anomalia):.4f}",
                        "modelo_versao": MODELO_VERSAO,
                        "fonte": "simulado",
                        "lote_id": f"sim-{dia:%Y-%m}",
                    }
                )
    analises.sort(key=lambda linha: linha["data_captura"])
    return analises


def injetar_problemas(rng, analises):
    duplicadas = [dict(linha) for linha in rng.sample(analises, 40)]
    for linha in duplicadas:
        ano, mes = map(int, linha["lote_id"][4:].split("-"))
        linha["lote_id"] = f"sim-{ano}-{min(mes + 1, 9):02d}"

    invalidas = []
    for indice, linha in enumerate(rng.sample(analises, 12)):
        linha = dict(linha, id_imagem=str(uuid.uuid5(NAMESPACE_IDS, f"invalida-{indice}")))
        if indice % 3 == 0:
            linha["talhao_id"] = "XX-99"
        elif indice % 3 == 1:
            linha["confianca"] = ""
        else:
            linha["tipo_anomalia"] = "desconhecido"
        invalidas.append(linha)

    return analises + duplicadas + invalidas


def escrever_csv(caminho, linhas, campos):
    caminho.parent.mkdir(parents=True, exist_ok=True)
    with caminho.open("w", newline="", encoding="utf-8") as arquivo:
        writer = csv.DictWriter(arquivo, fieldnames=campos)
        writer.writeheader()
        writer.writerows(linhas)


def escrever_por_mes(pasta, prefixo, linhas, chave_mes):
    grupos = defaultdict(list)
    for linha in linhas:
        grupos[chave_mes(linha)].append(linha)
    for mes, grupo in sorted(grupos.items()):
        escrever_csv(pasta / f"{prefixo}_{mes}.csv", grupo, list(grupo[0].keys()))
    return {mes: len(grupo) for mes, grupo in sorted(grupos.items())}


def main():
    args = parse_args()
    rng = random.Random(args.seed)
    saida = args.saida

    talhoes = [
        {
            "talhao_id": talhao_id,
            "talhao_nome": f"Talhão {talhao_id[-2:]}",
            "fazenda_id": fazenda_id,
            "fazenda_nome": FAZENDAS[fazenda_id]["nome"],
            "municipio": FAZENDAS[fazenda_id]["municipio"],
            "uf": FAZENDAS[fazenda_id]["uf"],
            "latitude": round(FAZENDAS[fazenda_id]["lat"] + deslocamento[0], 5),
            "longitude": round(FAZENDAS[fazenda_id]["lon"] + deslocamento[1], 5),
            "area_ha": area,
            "cultivar": cultivar,
            "sistema_irrigacao": sistema,
        }
        for talhao_id, fazenda_id, cultivar, area, sistema, deslocamento in TALHOES
    ]
    anomalias = [
        {"codigo": c, "nome": n, "nome_cientifico": ci, "grupo": g, "acao_recomendada": a}
        for c, n, ci, g, a in ANOMALIAS
    ]
    escrever_csv(saida / "referencia" / "talhoes.csv", talhoes, list(talhoes[0].keys()))
    escrever_csv(saida / "referencia" / "anomalias.csv", anomalias, list(anomalias[0].keys()))

    clima = gerar_clima(rng)
    analises = injetar_problemas(rng, gerar_analises(rng))

    resumo_clima = escrever_por_mes(saida / "clima", "clima", list(clima.values()), lambda linha: linha["data"][:7])
    resumo_analises = escrever_por_mes(
        saida / "analises", "analises", analises, lambda linha: linha["lote_id"][4:]
    )

    print(f"Dados gerados em {saida} (seed {args.seed}, {INICIO} a {FIM})")
    print(f"  talhões: {len(talhoes)} | anomalias: {len(anomalias)}")
    print(f"  análises: {len(analises)} linhas por mês {resumo_analises}")
    print(f"  clima: {sum(resumo_clima.values())} linhas")


if __name__ == "__main__":
    main()
