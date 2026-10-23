#!/usr/bin/env bash
# ==============================================================================
# SafeSpace SSFRMS — SQL Server Database Backup Script (Bash)
# ==============================================================================
set -euo pipefail

BACKUP_DIR="${1:-${BACKUP_PATH:-/var/backups/safespace}}"
DB_NAME="${2:-${DATABASE_NAME:-SSFRMS}}"
CONTAINER_NAME="${3:-safespace-staging-sqlserver}"
TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"
BACKUP_FILENAME="${DB_NAME}_backup_${TIMESTAMP}.bak"

mkdir -p "${BACKUP_DIR}"

echo "===================================================="
echo "  SafeSpace SSFRMS — Database Backup                "
echo "===================================================="
echo "Database:  ${DB_NAME}"
echo "Container: ${CONTAINER_NAME}"
echo "Backup to: ${BACKUP_DIR}/${BACKUP_FILENAME}"

# 1. Kiểm tra container SQL Server đang chạy
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "WARNING: Container ${CONTAINER_NAME} is not running. Checking if local sqlcmd exists..."
  if command -v sqlcmd &> /dev/null; then
    sqlcmd -S localhost -U sa -P "${SA_PASSWORD:?SA_PASSWORD required}" -C \
      -Q "BACKUP DATABASE [${DB_NAME}] TO DISK = N'/var/opt/mssql/data/${BACKUP_FILENAME}' WITH INIT, STATS = 10"
  else
    echo "ERROR: Cannot backup database: SQL Server container is not running."
    exit 1
  fi
else
  # Thực thi lệnh BACKUP DATABASE trong container
  docker exec "${CONTAINER_NAME}" /opt/mssql-tools18/bin/sqlcmd \
    -S localhost -U sa -P "${SA_PASSWORD:?SA_PASSWORD required}" -C \
    -Q "BACKUP DATABASE [${DB_NAME}] TO DISK = N'/var/opt/mssql/data/${BACKUP_FILENAME}' WITH INIT, STATS = 10" || \
  docker exec "${CONTAINER_NAME}" /opt/mssql-tools/bin/sqlcmd \
    -S localhost -U sa -P "${SA_PASSWORD:?SA_PASSWORD required}" \
    -Q "BACKUP DATABASE [${DB_NAME}] TO DISK = N'/var/opt/mssql/data/${BACKUP_FILENAME}' WITH INIT, STATS = 10"

  # 2. Sao chép file backup RA NGOÀI container và volume theo chính sách an toàn
  echo "Copying backup file out of container to host storage..."
  docker cp "${CONTAINER_NAME}:/var/opt/mssql/data/${BACKUP_FILENAME}" "${BACKUP_DIR}/${BACKUP_FILENAME}"

  # Dọn dẹp file tạm trong container
  docker exec "${CONTAINER_NAME}" rm -f "/var/opt/mssql/data/${BACKUP_FILENAME}"
fi

# 3. Kiểm tra file backup tồn tại và kích thước hợp lệ
if [[ ! -s "${BACKUP_DIR}/${BACKUP_FILENAME}" ]]; then
  echo "ERROR: Backup file was not created or is empty!"
  exit 1
fi

FILESIZE=$(stat -c%s "${BACKUP_DIR}/${BACKUP_FILENAME}" 2>/dev/null || stat -f%z "${BACKUP_DIR}/${BACKUP_FILENAME}")
echo "Backup completed successfully! Size: ${FILESIZE} bytes"
echo "Backup artifact: ${BACKUP_DIR}/${BACKUP_FILENAME}"
