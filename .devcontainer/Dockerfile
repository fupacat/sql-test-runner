# SQL Server 2022 Developer Edition with tSQLt pre-installed
#
# tSQLt is licensed under Apache 2.0.
# See third-party/tSQLt/LICENSE and THIRD-PARTY-NOTICES.md for details.
# tSQLt source: https://github.com/tSQLt-org/tSQLt
# tSQLt downloads: https://tsqlt.org/downloads/

FROM mcr.microsoft.com/mssql/server:2022-latest

# Switch to root to install system dependencies
USER root

RUN apt-get update -q \
    && apt-get install -y -q --no-install-recommends \
        curl \
        unzip \
    && rm -rf /var/lib/apt/lists/*

# Copy install scripts into the image
COPY scripts/ /opt/sql-setup/

RUN chmod +x /opt/sql-setup/install-tsqlt.sh

# Copy the custom entrypoint that initialises the DB and installs tSQLt
COPY .devcontainer/entrypoint.sh /opt/sql-setup/entrypoint.sh
RUN chmod +x /opt/sql-setup/entrypoint.sh

# Switch back to mssql user for security
USER mssql

ENV SA_PASSWORD="${SA_PASSWORD:-YourStrong!Passw0rd}"
ENV SQL_DATABASE="DevDb"

ENTRYPOINT ["/opt/sql-setup/entrypoint.sh"]
