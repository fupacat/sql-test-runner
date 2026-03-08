-- Example stored procedure
-- File: db/src/dbo.GetCustomer.sql

CREATE OR ALTER PROCEDURE dbo.GetCustomer
    @CustomerId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        CustomerId,
        FirstName,
        LastName,
        Email
    FROM dbo.Customer
    WHERE CustomerId = @CustomerId;
END
GO
