#!/usr/bin/env bash
# =====================================================================
# build.sh — รวม CSS + JS ทั้งหมดเป็นไฟล์เดียว
#
#   dist/hkcs-standalone.html   ไฟล์ HTML สมบูรณ์ เปิดจากเครื่องได้เลย
#                               (ดับเบิลคลิกเปิด หรือส่งให้คนอื่นทางอีเมล/USB)
#   dist/hkcs-artifact.html     เนื้อหาสำหรับวางเป็น Claude Artifact
#                               (ไม่มี doctype/html/head/body)
#
# วิธีใช้:  bash build.sh
# =====================================================================
set -e
cd "$(dirname "$0")"
mkdir -p dist

JS_FILES="assets/core.js assets/seed.js assets/domain.js assets/ui.js assets/auth.js \
assets/screens-master.js assets/screens-ops.js assets/screens-verify.js \
assets/screens-keyin.js assets/print.js assets/sheet-daily.js assets/scan.js assets/boot.js"

CDN_XLSX="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"
CDN_PDFJS="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"
FONT_CSS="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap"

emit_body() {
  printf '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
  printf '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
  printf '<link href="%s" rel="stylesheet">\n' "$FONT_CSS"
  printf '<style id="pageStyle">@page{size:A4 landscape;margin:6mm}</style>\n'
  printf '<style>\n'
  cat assets/app.css
  printf '\n</style>\n\n'
  printf '<div id="root"></div>\n<div id="printHost"></div>\n'
  printf '<div id="modalHost"></div>\n<div id="toasts"></div>\n\n'
  printf '<script src="%s"><%s>\n' "$CDN_XLSX" "/script"
  printf '<script src="%s"><%s>\n\n' "$CDN_PDFJS" "/script"
  for f in $JS_FILES; do
    printf '<script>\n/* ===== %s ===== */\n' "$f"
    cat "$f"
    printf '\n<%s>\n' "/script"
  done
}

# ---------- เวอร์ชันเปิดจากเครื่องได้เลย ----------
{
  printf '<!doctype html>\n<html lang="th">\n<head>\n<meta charset="utf-8">\n'
  printf '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
  printf '<meta name="color-scheme" content="light dark">\n'
  printf '<title>ระบบมอบหมายงานแม่บ้าน</title>\n</head>\n<body>\n'
  emit_body
  printf '</body>\n</html>\n'
} > dist/hkcs-standalone.html

# ---------- เวอร์ชันสำหรับ Claude Artifact ----------
{
  printf '<title>ระบบมอบหมายงานแม่บ้าน</title>\n'
  emit_body
} > dist/hkcs-artifact.html

echo "สร้างไฟล์เรียบร้อย:"
ls -la dist/
