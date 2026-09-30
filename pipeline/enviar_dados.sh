#!/usr/bin/env bash
set -euo pipefail

if [[ $# -eq 2 ]]; then
  arquivo="$(cd "$(dirname "$2")" && pwd)/$(basename "$2")"
fi
cd "$(dirname "$0")/.."
destino="dbfs:/Volumes/${CATALOGO:-workspace}/${SCHEMA:-agrosmart}/landing"

if [[ $# -eq 0 ]]; then
  for pasta in referencia clima analises; do
    databricks fs cp --recursive --overwrite "dados/entrada/$pasta" "$destino/$pasta"
  done
elif [[ $# -eq 2 ]]; then
  databricks fs cp --overwrite "$arquivo" "$destino/$1/$(basename "$arquivo")"
else
  echo "Uso: $0 [pasta arquivo.csv]" >&2
  exit 1
fi

echo "Arquivos enviados para $destino"
