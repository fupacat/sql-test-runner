import * as assert from 'assert';
import { ResultParser } from '../../src/resultParser';

suite('ResultParser', () => {
    const parser = new ResultParser();

    test('parses passing test', () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="MyClass" tests="1" failures="0">
    <testcase name="test_should_pass" classname="MyClass" time="0.123"/>
  </testsuite>
</testsuites>`;
        const results = parser.parse(xml);
        assert.strictEqual(results.length, 1);
        assert.strictEqual(results[0].testName, 'test_should_pass');
        assert.strictEqual(results[0].className, 'MyClass');
        assert.strictEqual(results[0].result, 'passed');
        assert.strictEqual(results[0].duration, 123);
    });

    test('parses failing test with message', () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="MyClass" tests="1" failures="1">
    <testcase name="test_should_fail" classname="MyClass" time="0.050">
      <failure message="Expected 1 but got 2" type="tSQLtFailure">Stack at line 42</failure>
    </testcase>
  </testsuite>
</testsuites>`;
        const results = parser.parse(xml);
        assert.strictEqual(results.length, 1);
        assert.strictEqual(results[0].result, 'failed');
        assert.strictEqual(results[0].failureMessage, 'Expected 1 but got 2');
        assert.strictEqual(results[0].duration, 50);
    });

    test('parses skipped test', () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="MyClass" tests="1" skipped="1">
    <testcase name="test_skipped" classname="MyClass" time="0">
      <skipped/>
    </testcase>
  </testsuite>
</testsuites>`;
        const results = parser.parse(xml);
        assert.strictEqual(results.length, 1);
        assert.strictEqual(results[0].result, 'skipped');
    });

    test('parses multiple tests across classes', () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="ClassA" tests="2">
    <testcase name="test_a1" classname="ClassA" time="0.010"/>
    <testcase name="test_a2" classname="ClassA" time="0.020">
      <failure message="fail">trace</failure>
    </testcase>
  </testsuite>
  <testsuite name="ClassB" tests="1">
    <testcase name="test_b1" classname="ClassB" time="0.005"/>
  </testsuite>
</testsuites>`;
        const results = parser.parse(xml);
        assert.strictEqual(results.length, 3);
        assert.strictEqual(results[0].result, 'passed');
        assert.strictEqual(results[1].result, 'failed');
        assert.strictEqual(results[2].result, 'passed');
    });

    test('returns empty array for empty XML', () => {
        const results = parser.parse('<testsuites></testsuites>');
        assert.strictEqual(results.length, 0);
    });

    test('extractLineFromStack returns 0-based line', () => {
        const line = parser.extractLineFromStack('Error at line 10 in procedure');
        assert.strictEqual(line, 9);
    });

    test('extractLineFromStack returns undefined when no line', () => {
        const line = parser.extractLineFromStack('Some error without line info');
        assert.strictEqual(line, undefined);
    });
});
