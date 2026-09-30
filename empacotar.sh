#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Uso: $0 nomecompleto_rm_turma" >&2
  exit 1
fi

cd "$(dirname "$0")"
destino="$(cd .. && pwd)/${1}_fase2_atividade.zip"
rm -f "$destino"

git ls-files -z --cached --others --exclude-standard |
  while IFS= read -r -d '' arquivo; do if [[ -f "$arquivo" ]]; then printf '%s\0' "$arquivo"; fi; done |
  xargs -0 zip -q "$destino"
echo "Pacote gerado: $destino ($(du -h "$destino" | cut -f1))"
