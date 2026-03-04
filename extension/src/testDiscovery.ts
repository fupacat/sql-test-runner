import * as vscode from 'vscode';
import { SqlConnectionManager } from './sqlConnection';

export interface TsqltTestClass {
    className: string;
}

export interface TsqltTestCase {
    className: string;
    testName: string;
    fullName: string;
}

/**
 * Discovers tSQLt test classes and test cases from the database and
 * builds the VS Code Test Explorer tree.
 */
export class TestDiscovery {
    constructor(
        private readonly connection: SqlConnectionManager,
        private readonly controller: vscode.TestController
    ) {}

    /**
     * Runs full discovery: fetches all test classes and test cases and
     * populates the VS Code TestController tree.
     */
    async discoverAll(): Promise<void> {
        const classes = await this.fetchTestClasses();
        const cases = await this.fetchTestCases();

        // Clear existing items
        this.controller.items.replace([]);

        // Group test cases by class
        const casesByClass = new Map<string, TsqltTestCase[]>();
        for (const tc of cases) {
            const list = casesByClass.get(tc.className) ?? [];
            list.push(tc);
            casesByClass.set(tc.className, list);
        }

        for (const cls of classes) {
            const classItem = this.controller.createTestItem(
                cls.className,
                cls.className
            );
            classItem.canResolveChildren = true;

            const classCases = casesByClass.get(cls.className) ?? [];
            for (const tc of classCases) {
                const caseItem = this.controller.createTestItem(
                    tc.fullName,
                    tc.testName
                );
                classItem.children.add(caseItem);
            }

            this.controller.items.add(classItem);
        }
    }

    async fetchTestClasses(): Promise<TsqltTestClass[]> {
        const rows = await this.connection.query<Array<{ ClassName: string }>>(
            'SELECT ClassName FROM tSQLt.TestClasses ORDER BY ClassName'
        );
        return rows.map(r => ({ className: r.ClassName }));
    }

    async fetchTestCases(): Promise<TsqltTestCase[]> {
        const rows = await this.connection.query<Array<{ TestCase: string }>>(
            "SELECT TestCase FROM tSQLt.TestCases ORDER BY TestCase"
        );
        return rows.map(r => {
            // tSQLt TestCase format: [ClassName].[test name] or ClassName.test name
            const raw = r.TestCase;
            const dotIdx = raw.indexOf('.');
            const className = dotIdx >= 0 ? raw.substring(0, dotIdx).replace(/^\[|\]$/g, '') : raw;
            const testName = dotIdx >= 0 ? raw.substring(dotIdx + 1).replace(/^\[|\]$/g, '') : raw;
            return { className, testName, fullName: raw };
        });
    }

    /**
     * Returns a flat map from full test name to TestItem for quick lookup.
     */
    buildTestItemMap(): Map<string, vscode.TestItem> {
        const map = new Map<string, vscode.TestItem>();
        this.controller.items.forEach(classItem => {
            classItem.children.forEach(caseItem => {
                map.set(caseItem.id, caseItem);
            });
        });
        return map;
    }
}
