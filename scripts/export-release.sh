#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_NAME="wakeup-catalogo-app"
DIST_DIR="${ROOT_DIR}/dist"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
EXPORT_DIR="${DIST_DIR}/${PROJECT_NAME}-release-${STAMP}"
ARCHIVE_PATH="${DIST_DIR}/${PROJECT_NAME}-release-${STAMP}.tar.gz"

mkdir -p "${DIST_DIR}"
rm -rf "${EXPORT_DIR}"
mkdir -p "${EXPORT_DIR}"

tar -C "${ROOT_DIR}" \
  --exclude='./node_modules' \
  --exclude='./.git' \
  --exclude='./dist' \
  --exclude='./.env' \
  --exclude='./.env.local' \
  --exclude='./.env.production' \
  --exclude='./*.log' \
  --exclude='./.DS_Store' \
  -cf - . | tar -C "${EXPORT_DIR}" -xf -

chmod +x "${EXPORT_DIR}/scripts/export-release.sh" 2>/dev/null || true

tar -C "${DIST_DIR}" -czf "${ARCHIVE_PATH}" "$(basename "${EXPORT_DIR}")"

cat <<EOF
Export listo:
- carpeta: ${EXPORT_DIR}
- archivo: ${ARCHIVE_PATH}
EOF
