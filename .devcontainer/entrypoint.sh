#!/usr/bin/env bash
# entrypoint.sh
# Custom SQL Server entrypoint that:
#   1. Starts SQL Server in the background
#   2. Waits for it to be ready
#   3. Runs setup-db.sql to create DevDb
#   4. Runs install-tsqlt.sh to download and install tSQLt (idempotent)
#   5. Keeps SQL Server running in the foreground

set -euo pipefail

SA_PASSWORD="${SA_PASSWORD:-YourStrong!Passw0rd}"
SQL_DATABASE="${SQL_DATABASE:-DevDb}"
SETUP_DIR="/opt/sql-setup"

log() { echo "[entrypoint] $*"; }

# Start SQL Server in the background (using the standard mssql entrypoint)
log "Starting SQL Server..."
/opt/mssql/bin/sqlservr &
SQL_PID=$!

# Wait for SQL Server to accept connections (up to 90s)
log "Waiting for SQL Server to accept connections..."
for i in $(seq 1 45); do
  if /opt/mssql-tools18/bin/sqlcmd -S "localhost,1433" -U sa -P "$SA_PASSWORD" -C -Q "SELECT 1" >/dev/null 2>&1; then
    log "SQL Server is ready."
    break
  fi
  if [[ $i -eq 45 ]]; then
    log "ERROR: SQL Server did not become ready in time." >&2
    exit 1
  fi
  sleep 2
done

# Run database setup (create DevDb, enable CLR)
log "Running setup-db.sql..."
/opt/mssql-tools18/bin/sqlcmd \
  -S "localhost,1433" \
  -U sa \
  -P "$SA_PASSWORD" \
  -C \
  -i "$SETUP_DIR/setup-db.sql" \
  -b \
  || { log "WARNING: setup-db.sql had errors (may be harmless if DB already exists)"; }

# Install tSQLt (idempotent – skips if already installed)
log "Installing tSQLt..."
SA_PASSWORD="$SA_PASSWORD" \
SQL_SERVER="localhost,1433" \
SQL_DATABASE="$SQL_DATABASE" \
  "$SETUP_DIR/install-tsqlt.sh" \
  || log "WARNING: tSQLt installation failed – container will still start. Check logs above."

log "Initialization complete. SQL Server is running."

# Keep SQL Server alive in the foreground
wait $SQL_PID
