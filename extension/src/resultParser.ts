import { DOMParser } from '@xmldom/xmldom';

export type TestResult = 'passed' | 'failed' | 'skipped';

export interface ParsedTestResult {
    testName: string;
    className: string;
    result: TestResult;
    duration?: number;
    failureMessage?: string;
    stackTrace?: string;
}

/**
 * Parses the XML output produced by tSQLt.XmlResultFormatter.
 *
 * tSQLt produces JUnit-compatible XML in the form:
 *   <testsuites>
 *     <testsuite name="ClassName" ...>
 *       <testcase name="test_name" time="0.1" classname="ClassName">
 *         <failure message="..." type="...">stack trace</failure>  <!-- optional -->
 *         <skipped/>                                               <!-- optional -->
 *       </testcase>
 *     </testsuite>
 *   </testsuites>
 */
export class ResultParser {
    /**
     * Parses tSQLt XML result output into structured test results.
     */
    parse(xmlContent: string): ParsedTestResult[] {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlContent, 'text/xml');
        const results: ParsedTestResult[] = [];

        const testCases = doc.getElementsByTagName('testcase');
        for (let i = 0; i < testCases.length; i++) {
            const tc = testCases.item(i);
            if (!tc) { continue; }

            const name = tc.getAttribute('name') ?? '';
            const className = tc.getAttribute('classname') ?? '';
            const timeAttr = tc.getAttribute('time');
            const duration = timeAttr ? parseFloat(timeAttr) * 1000 : undefined; // convert to ms

            let result: TestResult = 'passed';
            let failureMessage: string | undefined;
            let stackTrace: string | undefined;

            const failures = tc.getElementsByTagName('failure');
            if (failures.length > 0) {
                result = 'failed';
                const failure = failures.item(0)!;
                failureMessage = failure.getAttribute('message') ?? failure.textContent ?? '';
                stackTrace = failure.textContent ?? undefined;
            }

            const skipped = tc.getElementsByTagName('skipped');
            if (skipped.length > 0) {
                result = 'skipped';
            }

            results.push({
                testName: name,
                className,
                result,
                duration,
                failureMessage,
                stackTrace
            });
        }

        return results;
    }

    /**
     * Attempts to extract a line number reference from a tSQLt failure stack trace.
     * tSQLt stack traces often include "at line N" references.
     */
    extractLineFromStack(stackTrace: string): number | undefined {
        const match = /[Ll]ine\s+(\d+)/.exec(stackTrace);
        if (match) {
            return parseInt(match[1], 10) - 1; // 0-based
        }
        return undefined;
    }
}
