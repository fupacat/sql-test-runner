-- Database initialisation script
-- Creates the DevDb database and installs tSQLt

USE master;
GO

-- Create dev database if it doesn't exist
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'DevDb')
BEGIN
    CREATE DATABASE DevDb;
END
GO

USE DevDb;
GO

-- Install tSQLt (assumes tSQLt.class.sql is present in the container)
-- In a real setup, EXEC tSQLt.EnableExternalAccess or use the tSQLt installer
-- For the dev container, the tSQLt CLR assembly must be deployed separately.
-- This script sets up the database-level configuration tSQLt requires.

-- Enable CLR integration (required for tSQLt)
EXEC sp_configure 'clr enabled', 1;
RECONFIGURE;
GO

EXEC sp_configure 'clr strict security', 0;
RECONFIGURE;
GO

ALTER DATABASE DevDb SET TRUSTWORTHY ON;
GO

PRINT 'DevDb initialised successfully.';
GO
