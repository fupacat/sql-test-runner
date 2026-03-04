import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { SqlConnectionManager } from './sqlConnection';
import { TestRunner } from './testRunner';
import { ResultParser } from './resultParser';

export interface CiModeOptions {
    dacpacPath: string;
    junitOutputPath: string;
    sqlcmdPath: string;
    connectionString: string;
}

/**
 * CI mode: drops the database, publishes the full DACPAC, runs all tests,
 * and writes a JUnit XML report.
 */
export class CiModeRunner {
    constructor(
        private readonly connection: SqlConnectionManager,
        private readonly testRunner: TestRunner,
        private readonly options: CiModeOptions
    ) {}

    /**
     * Executes the full CI pipeline:
     * 1. Drop and recreate database via sqlpackage/dacpac
     * 2. Run all tests
     * 3. Write JUnit XML
     */
    async run(outputChannel: vscode.OutputChannel): Promise<boolean> {
        outputChannel.show();
        outputChannel.appendLine('[CI] Starting full rebuild & test...');

        // Step 1: publish DACPAC
        if (this.options.dacpacPath) {
            outputChannel.appendLine('[CI] Publishing DACPAC...');
            const dacpacResult = await this.publishDacpac(outputChannel);
            if (!dacpacResult) {
                outputChannel.appendLine('[CI] DACPAC publish failed. Aborting.');
                return false;
            }
            outputChannel.appendLine('[CI] DACPAC publish succeeded.');
        } else {
            outputChannel.appendLine('[CI] No DACPAC path configured, skipping publish step.');
        }

        // Step 2: run all tests
        outputChannel.appendLine('[CI] Running all tests...');
        let xml = '';
        try {
            await this.connection.query('EXEC tSQLt.RunAll');
            const rows = await this.connection.query<Array<{ OutputXml: string }>>(
                'EXEC tSQLt.XmlResultFormatter'
            );
            xml = rows[0]?.OutputXml ?? '';
        } catch (err) {
            outputChannel.appendLine(`[CI] Test execution failed: ${err}`);
            return false;
        }

        // Step 3: write JUnit XML
        if (xml) {
            const outPath = this.options.junitOutputPath;
            const dir = path.dirname(outPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(outPath, xml, 'utf8');
            outputChannel.appendLine(`[CI] JUnit XML written to ${outPath}`);
        }

        // Step 4: parse and summarize
        const parser = new ResultParser();
        const results = parser.parse(xml);
        const passed = results.filter(r => r.result === 'passed').length;
        const failed = results.filter(r => r.result === 'failed').length;
        const skipped = results.filter(r => r.result === 'skipped').length;

        outputChannel.appendLine(`[CI] Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);

        for (const r of results) {
            if (r.result === 'failed') {
                outputChannel.appendLine(`  FAIL: [${r.className}].[${r.testName}]`);
                if (r.failureMessage) {
                    outputChannel.appendLine(`        ${r.failureMessage}`);
                }
            }
        }

        if (failed > 0) {
            outputChannel.appendLine('[CI] CI run FAILED.');
            return false;
        }

        outputChannel.appendLine('[CI] CI run PASSED.');
        return true;
    }

    private publishDacpac(outputChannel: vscode.OutputChannel): Promise<boolean> {
        const connArgs = this.buildDacpacArgs();
        return new Promise(resolve => {
            cp.execFile('sqlpackage', connArgs, (error, stdout, stderr) => {
                if (stdout) { outputChannel.appendLine(stdout); }
                if (stderr) { outputChannel.appendLine(stderr); }
                if (error) {
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        });
    }

    private buildDacpacArgs(): string[] {
        const parts = this.options.connectionString.split(';').filter(p => p.trim().length > 0);
        const params: Record<string, string> = {};
        for (const part of parts) {
            const eqIdx = part.indexOf('=');
            if (eqIdx >= 0) {
                params[part.substring(0, eqIdx).trim().toLowerCase()] = part.substring(eqIdx + 1).trim();
            }
        }
        const server = params['server'] ?? params['data source'] ?? 'localhost';
        const database = params['database'] ?? params['initial catalog'] ?? 'DevDb';
        const user = params['user id'] ?? params['uid'];
        const password = params['password'] ?? params['pwd'];

        const targetConn = user
            ? `Server=${server};Database=${database};User Id=${user};Password=${password};TrustServerCertificate=true`
            : `Server=${server};Database=${database};Integrated Security=true;TrustServerCertificate=true`;

        return [
            '/Action:Publish',
            `/SourceFile:${this.options.dacpacPath}`,
            `/TargetConnectionString:${targetConn}`
        ];
    }
}
