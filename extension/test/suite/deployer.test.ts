import * as assert from 'assert';
import { IncrementalDeployer } from '../../src/deployer';

// Minimal mock for vscode.DiagnosticCollection
const mockDiagnosticCollection = {
    set: () => {},
    delete: () => {},
    clear: () => {},
    dispose: () => {}
} as unknown as import('vscode').DiagnosticCollection;

suite('IncrementalDeployer', () => {
    let deployer: IncrementalDeployer;

    setup(() => {
        deployer = new IncrementalDeployer('sqlcmd', 'Server=localhost,1433;Database=DevDb;User Id=sa;Password=Test;TrustServerCertificate=true', mockDiagnosticCollection);
    });

    test('buildConnectionArgs parses standard connection string', () => {
        const args = deployer.buildConnectionArgs(
            'Server=myserver,1433;Database=MyDb;User Id=sa;Password=secret;TrustServerCertificate=true'
        );
        assert.ok(args.includes('-S'));
        assert.ok(args.includes('myserver,1433'));
        assert.ok(args.includes('-d'));
        assert.ok(args.includes('MyDb'));
        assert.ok(args.includes('-U'));
        assert.ok(args.includes('sa'));
        assert.ok(args.includes('-P'));
        assert.ok(args.includes('secret'));
        assert.ok(args.includes('-C'));
    });

    test('buildConnectionArgs uses -E for integrated auth when no user', () => {
        const args = deployer.buildConnectionArgs(
            'Server=myserver;Database=MyDb;Integrated Security=true'
        );
        assert.ok(args.includes('-E'));
        assert.ok(!args.includes('-U'));
    });

    test('parseError extracts line number', () => {
        const output = "Msg 2714, Level 16, State 3, Line 5\nObject already exists.";
        const err = deployer.parseError(output, '/path/to/file.sql');
        assert.strictEqual(err.line, 4); // 0-based
        assert.strictEqual(err.filePath, '/path/to/file.sql');
    });

    test('parseError uses first non-empty line as message', () => {
        const output = "\nMsg 102, Level 15, State 1, Line 1\nIncorrect syntax near ')'.\n";
        const err = deployer.parseError(output, '/path/to/file.sql');
        assert.ok(err.message.includes('Msg 102'));
    });

    test('parseError handles output with no line number', () => {
        const err = deployer.parseError('Unknown error', '/path/file.sql');
        assert.strictEqual(err.line, undefined);
        assert.strictEqual(err.message, 'Unknown error');
    });
});
