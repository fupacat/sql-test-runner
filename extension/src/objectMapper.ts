import * as fs from 'fs';
import * as path from 'path';

export type SqlObjectType = 'PROCEDURE' | 'FUNCTION' | 'VIEW' | 'TABLE';

export interface SqlObject {
    schema: string;
    name: string;
    type: SqlObjectType;
    filePath: string;
}

const OBJECT_PATTERNS: Array<{ type: SqlObjectType; pattern: RegExp }> = [
    {
        type: 'PROCEDURE',
        pattern: /CREATE\s+(?:OR\s+ALTER\s+)?PROC(?:EDURE)?\s+(?:\[?(\w+)\]?\.)?\[?(\w+)\]?/i
    },
    {
        type: 'FUNCTION',
        pattern: /CREATE\s+(?:OR\s+ALTER\s+)?FUNCTION\s+(?:\[?(\w+)\]?\.)?\[?(\w+)\]?/i
    },
    {
        type: 'VIEW',
        pattern: /CREATE\s+(?:OR\s+ALTER\s+)?VIEW\s+(?:\[?(\w+)\]?\.)?\[?(\w+)\]?/i
    },
    {
        type: 'TABLE',
        pattern: /CREATE\s+TABLE\s+(?:\[?(\w+)\]?\.)?\[?(\w+)\]?/i
    }
];

/**
 * Parses SQL source files to extract object definitions and maintains a
 * reverse index from object name to the set of tSQLt tests that reference it.
 */
export class ObjectMapper {
    /** Map from filePath to the SQL object defined in that file */
    private fileObjectIndex = new Map<string, SqlObject>();

    /** Map from objectName (lower) to set of test full names */
    private objectToTests = new Map<string, Set<string>>();

    /**
     * Parses a SQL file and extracts the primary object defined in it.
     */
    parseFile(filePath: string): SqlObject | null {
        let content: string;
        try {
            content = fs.readFileSync(filePath, 'utf8');
        } catch {
            return null;
        }
        return this.parseContent(content, filePath);
    }

    /**
     * Parses SQL text and extracts the first matching object definition.
     */
    parseContent(content: string, filePath: string): SqlObject | null {
        for (const { type, pattern } of OBJECT_PATTERNS) {
            const match = pattern.exec(content);
            if (match) {
                const schema = match[1] ?? 'dbo';
                const name = match[2];
                if (name) {
                    const obj: SqlObject = { schema, name, type, filePath };
                    this.fileObjectIndex.set(filePath, obj);
                    return obj;
                }
            }
        }
        return null;
    }

    /**
     * Indexes a test file body so we can build reverse object→test mappings.
     * Searches for EXEC ObjectName and FROM ObjectName patterns in test SQL.
     */
    indexTestFile(testFilePath: string, testFullName: string): void {
        let content: string;
        try {
            content = fs.readFileSync(testFilePath, 'utf8');
        } catch {
            return;
        }
        this.indexTestContent(content, testFullName);
    }

    /**
     * Scans test SQL content for object references and updates the reverse index.
     */
    indexTestContent(content: string, testFullName: string): void {
        // Match: EXEC [schema.]objectname or FROM [schema.]objectname
        const refPattern = /(?:EXEC|FROM)\s+(?:\[?\w+\]?\.)?\[?(\w+)\]?/gi;
        let match: RegExpExecArray | null;
        while ((match = refPattern.exec(content)) !== null) {
            const objName = match[1].toLowerCase();
            const tests = this.objectToTests.get(objName) ?? new Set();
            tests.add(testFullName);
            this.objectToTests.set(objName, tests);
        }
    }

    /**
     * Returns the SQL object defined in the given file, if any.
     */
    getObjectForFile(filePath: string): SqlObject | null {
        return this.fileObjectIndex.get(filePath) ?? null;
    }

    /**
     * Returns the set of test full names that reference the given object.
     */
    getTestsForObject(objectName: string): string[] {
        return Array.from(this.objectToTests.get(objectName.toLowerCase()) ?? []);
    }

    /**
     * Returns the object name part from a file path (used for heuristic matching).
     */
    getObjectNameFromPath(filePath: string): string {
        return path.basename(filePath, path.extname(filePath));
    }

    removeFile(filePath: string): void {
        this.fileObjectIndex.delete(filePath);
    }
}
