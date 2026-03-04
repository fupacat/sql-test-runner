#!/usr/bin/env bash
# install-tsqlt.sh
# Downloads the latest tSQLt release from tsqlt.org and installs it into
# the DevDb database running in the dev container.
#
# tSQLt is licensed under Apache 2.0.
# See third-party/tSQLt/LICENSE and THIRD-PARTY-NOTICES.md.
#
# Usage:
#   ./scripts/install-tsqlt.sh [--server <host,port>] [--database <db>] \
#                               [--user <user>] [--password <password>]
#
# Environment variable overrides (all optional):
#   SA_PASSWORD      SA password (default: YourStrong!Passw0rd)
#   SQL_SERVER       SQL Server host,port (default: localhost,1433)
#   SQL_DATABASE     Target database name (default: DevDb)
#   TSQLT_VERSION    Specific tSQLt version tag to download (default: latest)
#   TSQLT_DOWNLOAD_URL  Override the full download URL

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration (with defaults; override via environment or CLI flags)
# ---------------------------------------------------------------------------
SA_PASSWORD="${SA_PASSWORD:-YourStrong!Passw0rd}"
SQL_SERVER="${SQL_SERVER:-localhost,1433}"
SQL_DATABASE="${SQL_DATABASE:-DevDb}"
TSQLT_VERSION="${TSQLT_VERSION:-latest}"
TSQLT_DOWNLOAD_URL="${TSQLT_DOWNLOAD_URL:-}"

INSTALL_DIR="/tmp/tsqlt-install"
TSQLT_ZIP="$INSTALL_DIR/tSQLt.zip"

# Parse optional CLI flags
while [[ $# -gt 0 ]]; do
  case "$1" in
    --server)    SQL_SERVER="$2";   shift 2 ;;
    --database)  SQL_DATABASE="$2"; shift 2 ;;
    --user)      SQL_USER="$2";     shift 2 ;;
    --password)  SA_PASSWORD="$2";  shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

SQL_USER="${SQL_USER:-sa}"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
log()  { echo "[install-tsqlt] $*"; }
err()  { echo "[install-tsqlt] ERROR: $*" >&2; exit 1; }

run_sql() {
  local sql="$1"
  /opt/mssql-tools18/bin/sqlcmd \
    -S "$SQL_SERVER" \
    -U "$SQL_USER" \
    -P "$SA_PASSWORD" \
    -C \
    -Q "$sql" \
    -b
}

run_sql_file() {
  local file="$1"
  local db="${2:-master}"
  /opt/mssql-tools18/bin/sqlcmd \
    -S "$SQL_SERVER" \
    -U "$SQL_USER" \
    -P "$SA_PASSWORD" \
    -C \
    -d "$db" \
    -i "$file" \
    -b
}

wait_for_sql() {
  log "Waiting for SQL Server to be ready..."
  local retries=30
  until run_sql "SELECT 1" > /dev/null 2>&1; do
    retries=$((retries - 1))
    if [[ $retries -le 0 ]]; then
      err "SQL Server did not become ready in time."
    fi
    sleep 2
  done
  log "SQL Server is ready."
}

# ---------------------------------------------------------------------------
# Check if tSQLt is already installed in the target database
# ---------------------------------------------------------------------------
tsqlt_already_installed() {
  local result
  result=$(run_sql \
    "IF EXISTS (SELECT 1 FROM [$SQL_DATABASE].sys.schemas WHERE name = 'tSQLt') \
     SELECT 'YES' ELSE SELECT 'NO'" 2>/dev/null || echo "NO")
  [[ "$result" == *"YES"* ]]
}

# ---------------------------------------------------------------------------
# Determine download URL
# ---------------------------------------------------------------------------
resolve_download_url() {
  if [[ -n "$TSQLT_DOWNLOAD_URL" ]]; then
    echo "$TSQLT_DOWNLOAD_URL"
    return
  fi

  # Pinned to the latest stable release: V1.1.8738.27883 (2022-02-16).
  # To upgrade, update this URL and set TSQLT_VERSION accordingly, or pass
  # --TSQLT_DOWNLOAD_URL with your preferred URL at runtime.
  echo "https://tsqlt.org/downloads/?file=tSQLt_V1.1.8738.27883.zip"
}

# ---------------------------------------------------------------------------
# Download tSQLt
# ---------------------------------------------------------------------------
download_tsqlt() {
  local url
  url=$(resolve_download_url)

  log "Downloading tSQLt from: $url"
  mkdir -p "$INSTALL_DIR"

  if command -v curl &>/dev/null; then
    curl -fsSL -o "$TSQLT_ZIP" "$url" \
      || err "Download failed. Please download tSQLt manually from https://tsqlt.org/downloads/ and place it at $TSQLT_ZIP"
  elif command -v wget &>/dev/null; then
    wget -q -O "$TSQLT_ZIP" "$url" \
      || err "Download failed. Please download tSQLt manually from https://tsqlt.org/downloads/ and place it at $TSQLT_ZIP"
  else
    err "Neither curl nor wget is available. Please install one and retry."
  fi

  log "Download complete: $(du -sh "$TSQLT_ZIP" | cut -f1)"
}

# ---------------------------------------------------------------------------
# Extract tSQLt
# ---------------------------------------------------------------------------
extract_tsqlt() {
  log "Extracting tSQLt..."
  if ! command -v unzip &>/dev/null; then
    log "unzip not found, attempting to install..."
    apt-get install -y -q unzip 2>/dev/null || err "unzip is required but could not be installed."
  fi
  unzip -o "$TSQLT_ZIP" -d "$INSTALL_DIR" > /dev/null
  log "Extraction complete."

  # Validate expected files exist
  if [[ ! -f "$INSTALL_DIR/PrepareServer.sql" ]]; then
    err "PrepareServer.sql not found in the tSQLt package. Package may be corrupt."
  fi
  if [[ ! -f "$INSTALL_DIR/tSQLt.class.sql" ]]; then
    err "tSQLt.class.sql not found in the tSQLt package. Package may be corrupt."
  fi
}

# ---------------------------------------------------------------------------
# Install tSQLt
# ---------------------------------------------------------------------------
install_tsqlt() {
  # Step 1: PrepareServer.sql (once per server – enables CLR, installs cert)
  log "Running PrepareServer.sql (server-level setup)..."
  run_sql_file "$INSTALL_DIR/PrepareServer.sql" "master" \
    || err "PrepareServer.sql failed. Check the SQL Server error log."
  log "PrepareServer.sql completed."

  # Step 2: tSQLt.class.sql (installs tSQLt into the target database)
  log "Installing tSQLt into database [$SQL_DATABASE]..."
  run_sql_file "$INSTALL_DIR/tSQLt.class.sql" "$SQL_DATABASE" \
    || err "tSQLt.class.sql failed. Check the SQL Server error log."
  log "tSQLt.class.sql completed."
}

# ---------------------------------------------------------------------------
# Verify installation
# ---------------------------------------------------------------------------
verify_tsqlt() {
  log "Verifying tSQLt installation..."
  local version
  version=$(run_sql \
    "USE [$SQL_DATABASE]; SELECT Version FROM tSQLt.Info();" 2>/dev/null \
    | grep -v '^$' | grep -v 'Version' | grep -v '---' | grep -v 'rows affected' \
    | tr -d ' \r' | head -1 || echo "unknown")
  log "tSQLt version installed: $version"
}

# ---------------------------------------------------------------------------
# Setup DevDb (if not already done)
# ---------------------------------------------------------------------------
ensure_database() {
  log "Ensuring database [$SQL_DATABASE] exists..."
  run_sql "IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = '$SQL_DATABASE') CREATE DATABASE [$SQL_DATABASE];"
  log "Database [$SQL_DATABASE] is ready."
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  log "=== tSQLt Automatic Installer ==="
  log "Target server:   $SQL_SERVER"
  log "Target database: $SQL_DATABASE"
  log "tSQLt version:   ${TSQLT_VERSION}"
  echo ""

  wait_for_sql

  if tsqlt_already_installed; then
    log "tSQLt is already installed in [$SQL_DATABASE]. Skipping."
    verify_tsqlt
    exit 0
  fi

  ensure_database
  download_tsqlt
  extract_tsqlt
  install_tsqlt
  verify_tsqlt

  log ""
  log "=== tSQLt installation complete ==="
  log "You can now run tests with: EXEC tSQLt.RunAll"
}

main "$@"
