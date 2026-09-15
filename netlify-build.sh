#!/usr/bin/env bash
# =====================================================================
# netlify-build.sh — สคริปต์ที่ Netlify เรียกตอน deploy
#
# ถ้าตั้ง Environment variables ไว้บน Netlify จะเขียนทับ assets/config.js ให้
#     SUPABASE_URL        (จำเป็น)
#     SUPABASE_ANON_KEY   (จำเป็น)
#     SUPABASE_TABLE      (ไม่ใส่ก็ได้ ค่าเริ่มต้น hkcs_kv)
#     HKCS_LOCK_STORAGE   (ไม่ใส่ก็ได้ ค่าเริ่มต้น true = ผู้ใช้เปลี่ยนเองไม่ได้)
#     HKCS_ORG_NAME / HKCS_ORG_DEPT / HKCS_ORG_DOC / HKCS_ORG_REV  (ไม่ใส่ก็ได้)
#
# ถ้าไม่ได้ตั้ง env var จะใช้ค่าที่กรอกไว้ในไฟล์ assets/config.js ตามเดิม
# =====================================================================
set -e
cd "$(dirname "$0")"

if [ -n "$SUPABASE_URL" ] && [ -n "$SUPABASE_ANON_KEY" ]; then
  TABLE="${SUPABASE_TABLE:-hkcs_kv}"
  LOCK="${HKCS_LOCK_STORAGE:-true}"

  echo "→ เขียน assets/config.js จาก Environment variables"
  {
    echo "/* สร้างอัตโนมัติตอน deploy โดย netlify-build.sh — อย่าแก้ไฟล์นี้ด้วยมือ */"
    echo "window.HKCS_CONFIG = {"
    echo "  storage: {"
    echo "    mode: 'supabase',"
    echo "    url: '${SUPABASE_URL}',"
    echo "    anonKey: '${SUPABASE_ANON_KEY}',"
    echo "    table: '${TABLE}'"
    echo "  },"
    echo "  lockStorage: ${LOCK},"
    echo "  org: {"
    [ -n "$HKCS_ORG_NAME" ] && echo "    name: '${HKCS_ORG_NAME}',"
    [ -n "$HKCS_ORG_DEPT" ] && echo "    dept: '${HKCS_ORG_DEPT}',"
    [ -n "$HKCS_ORG_DOC" ]  && echo "    doc: '${HKCS_ORG_DOC}',"
    [ -n "$HKCS_ORG_REV" ]  && echo "    rev: '${HKCS_ORG_REV}',"
    echo "  }"
    echo "};"
  } > assets/config.js
else
  echo "→ ไม่พบ SUPABASE_URL / SUPABASE_ANON_KEY — ใช้ค่าที่กรอกไว้ใน assets/config.js"
fi

# รวมไฟล์เป็นเวอร์ชันเดียวจบ (ดาวน์โหลดได้ที่ /dist/hkcs-standalone.html)
bash build.sh

echo "→ deploy พร้อมแล้ว"
