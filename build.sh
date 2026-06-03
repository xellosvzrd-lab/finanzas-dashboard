#!/usr/bin/env bash
# build.sh — Concatena src/js/*.js e inyecta en src/index.template.html → index.html
# Editar en src/, nunca directamente en index.html.
set -e

python3 - << 'EOF'
import glob, os

template = open("src/index.template.html").read()

js_files = sorted(glob.glob("src/js/*.js"))
if not js_files:
    raise SystemExit("ERROR: No se encontraron archivos en src/js/")

js_content = "".join(open(f).read() for f in js_files)
result = template.replace("<!-- BUILD_JS -->\n", js_content)

with open("index.html", "w") as f:
    f.write(result)

lines = result.count("\n") + 1
print(f"✓ index.html generado ({lines} líneas) desde {len(js_files)} módulos")
for f in js_files:
    print(f"  {os.path.basename(f):30s} {sum(1 for _ in open(f))} líneas")
EOF
