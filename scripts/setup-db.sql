-- setup-db.sql
-- Creates the DevDb database and configures it for tSQLt.
--
-- tSQLt itself is installed by scripts/install-tsqlt.sh, which downloads
-- the official tSQLt package (Apache 2.0) from https://tsqlt.org/downloads/
-- and runs PrepareServer.sql followed by tSQLt.class.sql.
--
-- This script only handles database creation and the server-level CLR
-- configuration that tSQLt PrepareServer.sql also sets (idempotent).

USE master;
GO

-- Create dev database if it does not already exist
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'DevDb')
BEGIN
    CREATE DATABASE DevDb;
    PRINT 'Created database DevDb.';
END
ELSE
BEGIN
    PRINT 'Database DevDb already exists.';
END
GO

-- Enable CLR integration (required for tSQLt)
-- PrepareServer.sql will also set this; running here ensures the DB is ready
-- for the install script even if it runs before PrepareServer.sql.
IF (SELECT value_in_use FROM sys.configurations WHERE name = 'clr enabled') = 0
BEGIN
    EXEC sp_configure 'clr enabled', 1;
    RECONFIGURE;
    PRINT 'Enabled CLR integration.';
END
GO

-- Note: PrepareServer.sql (run by install-tsqlt.sh) installs a signing
-- certificate in master that allows tSQLt to run without disabling strict CLR
-- security or marking the database TRUSTWORTHY. Those settings are NOT applied
-- here; PrepareServer.sql is the authoritative source for server-level config.

PRINT 'DevDb is ready for tSQLt installation.';
GO
