#!/usr/bin/env bash
# Lanza un servidor local, ejecuta todas las pruebas de interfaz (Playwright + Supabase simulado) y lo apaga.
# Requisitos: python3, playwright (pip install playwright && playwright install chromium)
set -u
cd "$(dirname "$0")/.."
python3 -m http.server 8765 >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
sleep 1
FAIL=0
for t in tests/test_app.py tests/test_tiempo.py tests/test_deshacer.py tests/test_busqueda_tareas_chat.py tests/test_catalan.py tests/test_contrasena.py; do
  echo "== $t"
  python3 "$t" > "tests/out/$(basename "$t").log" 2>&1 || { echo "   ERROR de ejecución (ver tests/out/$(basename "$t").log)"; FAIL=1; continue; }
  grep -E "FALLA|ERRORS \[[^]]|fallos" "tests/out/$(basename "$t").log" | head -5
done
exit $FAIL
