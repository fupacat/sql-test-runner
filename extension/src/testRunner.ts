import * as vscode from 'vscode';
import { SqlConnectionManager } from './sqlConnection';
import { ResultParser, ParsedTestResult } from './resultParser';

/**
 * Orchestrates tSQLt test execution and maps results back to VS Code TestItems.
 */
export class TestRunner {
    private parser = new ResultParser();

    constructor(
        private readonly connection: SqlConnectionManager,
        private readonly controller: vscode.TestController
    ) {}

    /**
     * Runs all tSQLt tests and reports results to the given TestRun.
     */
    async runAll(run: vscode.TestRun): Promise<void> {
        await this.connection.query('EXEC tSQLt.RunAll');
        const results = await this.fetchResults();
        this.applyResults(run, results);
    }

    /**
     * Runs a specific test class.
     */
    async runClass(run: vscode.TestRun, className: string): Promise<void> {
        await this.connection.query(
            'EXEC tSQLt.Run @TestName = @name',
            { name: className }
        );
        const results = await this.fetchResults();
        this.applyResults(run, results);
    }

    /**
     * Runs a single test by full name (e.g. [ClassName].[test_name]).
     */
    async runTest(run: vscode.TestRun, testFullName: string): Promise<void> {
        await this.connection.query(
            'EXEC tSQLt.Run @TestName = @name',
            { name: testFullName }
        );
        const results = await this.fetchResults();
        this.applyResults(run, results);
    }

    /**
     * Runs a specific list of test names (for auto-mode).
     */
    async runTests(run: vscode.TestRun, testFullNames: string[]): Promise<void> {
        for (const testName of testFullNames) {
            await this.runTest(run, testName);
        }
    }

    /**
     * Fetches XML results from tSQLt.XmlResultFormatter and parses them.
     */
    private async fetchResults(): Promise<ParsedTestResult[]> {
        const rows = await this.connection.query<Array<{ OutputXml: string }>>(
            'EXEC tSQLt.XmlResultFormatter'
        );
        if (!rows || rows.length === 0) {
            return [];
        }
        const xml = rows[0].OutputXml ?? '';
        return this.parser.parse(xml);
    }

    /**
     * Maps parsed test results back to VS Code TestItems and marks them passed/failed/skipped.
     */
    private applyResults(run: vscode.TestRun, results: ParsedTestResult[]): void {
        const itemMap = this.buildTestItemMap();

        for (const result of results) {
            // Try to find item by full name variants
            const fullName = `[${result.className}].[${result.testName}]`;
            const altFullName = `${result.className}.${result.testName}`;
            const item = itemMap.get(fullName) ?? itemMap.get(altFullName) ?? itemMap.get(result.testName);

            if (!item) {
                continue;
            }

            const durationMs = result.duration;

            switch (result.result) {
                case 'passed':
                    run.passed(item, durationMs);
                    break;
                case 'failed': {
                    const msg = new vscode.TestMessage(result.failureMessage ?? 'Test failed');
                    if (result.stackTrace) {
                        msg.actualOutput = result.stackTrace;
                    }
                    run.failed(item, msg, durationMs);
                    break;
                }
                case 'skipped':
                    run.skipped(item);
                    break;
            }
        }
    }

    private buildTestItemMap(): Map<string, vscode.TestItem> {
        const map = new Map<string, vscode.TestItem>();
        this.controller.items.forEach(classItem => {
            classItem.children.forEach(caseItem => {
                map.set(caseItem.id, caseItem);
                map.set(caseItem.label, caseItem);
            });
        });
        return map;
    }
}
