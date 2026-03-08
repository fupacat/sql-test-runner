-- Example tSQLt test class
-- File: db/tests/CustomerTests.sql

EXEC tSQLt.NewTestClass 'CustomerTests';
GO

CREATE OR ALTER PROCEDURE CustomerTests.[test GetCustomer returns correct row]
AS
BEGIN
    -- Arrange: create a fake Customer table with test data
    EXEC tSQLt.FakeTable 'dbo.Customer';

    INSERT INTO dbo.Customer (CustomerId, FirstName, LastName, Email)
    VALUES (1, 'Alice', 'Smith', 'alice@example.com');

    -- Act
    CREATE TABLE #Actual (CustomerId INT, FirstName NVARCHAR(50), LastName NVARCHAR(50), Email NVARCHAR(100));
    INSERT INTO #Actual
    EXEC dbo.GetCustomer @CustomerId = 1;

    -- Assert
    CREATE TABLE #Expected (CustomerId INT, FirstName NVARCHAR(50), LastName NVARCHAR(50), Email NVARCHAR(100));
    INSERT INTO #Expected VALUES (1, 'Alice', 'Smith', 'alice@example.com');

    EXEC tSQLt.AssertEqualsTable '#Expected', '#Actual';
END
GO

CREATE OR ALTER PROCEDURE CustomerTests.[test GetCustomer returns nothing for unknown id]
AS
BEGIN
    EXEC tSQLt.FakeTable 'dbo.Customer';

    CREATE TABLE #Actual (CustomerId INT, FirstName NVARCHAR(50), LastName NVARCHAR(50), Email NVARCHAR(100));
    INSERT INTO #Actual
    EXEC dbo.GetCustomer @CustomerId = 999;

    EXEC tSQLt.AssertEqualsTable (SELECT TOP 0 * FROM #Actual), #Actual;
END
GO
