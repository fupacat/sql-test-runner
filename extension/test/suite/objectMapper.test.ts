import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { ObjectMapper } from '../../src/objectMapper';

suite('ObjectMapper', () => {
    let mapper: ObjectMapper;
    let tmpDir: string;

    setup(() => {
        mapper = new ObjectMapper();
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sql-test-runner-'));
    });

    teardown(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test('parses CREATE PROCEDURE with schema', () => {
        const sql = 'CREATE PROCEDURE dbo.GetCustomer\nAS SELECT 1';
        const obj = mapper.parseContent(sql, '/tmp/test.sql');
        assert.ok(obj);
        assert.strictEqual(obj!.type, 'PROCEDURE');
        assert.strictEqual(obj!.schema, 'dbo');
        assert.strictEqual(obj!.name, 'GetCustomer');
    });

    test('parses CREATE OR ALTER PROCEDURE', () => {
        const sql = 'CREATE OR ALTER PROCEDURE dbo.UpdateOrder AS SELECT 1';
        const obj = mapper.parseContent(sql, '/tmp/test.sql');
        assert.ok(obj);
        assert.strictEqual(obj!.type, 'PROCEDURE');
        assert.strictEqual(obj!.name, 'UpdateOrder');
    });

    test('parses CREATE FUNCTION', () => {
        const sql = 'CREATE FUNCTION dbo.CalcTax(@amount DECIMAL) RETURNS DECIMAL AS BEGIN RETURN 0 END';
        const obj = mapper.parseContent(sql, '/tmp/test.sql');
        assert.ok(obj);
        assert.strictEqual(obj!.type, 'FUNCTION');
        assert.strictEqual(obj!.name, 'CalcTax');
    });

    test('parses CREATE VIEW', () => {
        const sql = 'CREATE VIEW sales.OrderSummary AS SELECT 1';
        const obj = mapper.parseContent(sql, '/tmp/test.sql');
        assert.ok(obj);
        assert.strictEqual(obj!.type, 'VIEW');
        assert.strictEqual(obj!.name, 'OrderSummary');
    });

    test('parses CREATE TABLE', () => {
        const sql = 'CREATE TABLE dbo.Orders (Id INT PRIMARY KEY)';
        const obj = mapper.parseContent(sql, '/tmp/test.sql');
        assert.ok(obj);
        assert.strictEqual(obj!.type, 'TABLE');
        assert.strictEqual(obj!.name, 'Orders');
    });

    test('returns null for unrecognised SQL', () => {
        const sql = 'SELECT 1 FROM dbo.Orders';
        const obj = mapper.parseContent(sql, '/tmp/test.sql');
        assert.strictEqual(obj, null);
    });

    test('defaults schema to dbo when not specified', () => {
        const sql = 'CREATE PROCEDURE GetCustomer AS SELECT 1';
        const obj = mapper.parseContent(sql, '/tmp/test.sql');
        assert.ok(obj);
        assert.strictEqual(obj!.schema, 'dbo');
    });

    test('indexes test content and finds object reference', () => {
        const testSql = 'CREATE PROCEDURE [testClass].[test_GetCustomer] AS EXEC dbo.GetCustomer';
        mapper.indexTestContent(testSql, '[testClass].[test_GetCustomer]');
        const tests = mapper.getTestsForObject('GetCustomer');
        assert.ok(tests.includes('[testClass].[test_GetCustomer]'));
    });

    test('indexes test content with FROM reference', () => {
        const testSql = 'CREATE PROCEDURE [testClass].[test_Orders] AS SELECT * FROM dbo.Orders';
        mapper.indexTestContent(testSql, '[testClass].[test_Orders]');
        const tests = mapper.getTestsForObject('Orders');
        assert.ok(tests.includes('[testClass].[test_Orders]'));
    });

    test('getObjectNameFromPath returns filename without extension', () => {
        const name = mapper.getObjectNameFromPath('/db/src/dbo.GetCustomer.sql');
        assert.strictEqual(name, 'dbo.GetCustomer');
    });

    test('parseFile reads from disk', () => {
        const filePath = path.join(tmpDir, 'proc.sql');
        fs.writeFileSync(filePath, 'CREATE PROCEDURE dbo.TestProc AS SELECT 1');
        const obj = mapper.parseFile(filePath);
        assert.ok(obj);
        assert.strictEqual(obj!.name, 'TestProc');
    });

    test('parseFile returns null for missing file', () => {
        const obj = mapper.parseFile('/nonexistent/path/proc.sql');
        assert.strictEqual(obj, null);
    });

    test('removeFile clears from index', () => {
        const filePath = '/tmp/proc.sql';
        mapper.parseContent('CREATE PROCEDURE dbo.TestProc AS SELECT 1', filePath);
        assert.ok(mapper.getObjectForFile(filePath));
        mapper.removeFile(filePath);
        assert.strictEqual(mapper.getObjectForFile(filePath), null);
    });
});
