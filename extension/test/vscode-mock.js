/**
 * Minimal vscode mock for running unit tests outside VS Code.
 * Only implements the APIs used by the modules under test.
 */
const vscode = {
    Uri: {
        file: (p) => ({ fsPath: p, toString: () => p })
    },
    Range: class {
        constructor(startLine, startCol, endLine, endCol) {
            this.start = { line: startLine, character: startCol };
            this.end = { line: endLine, character: endCol };
        }
    },
    Diagnostic: class {
        constructor(range, message, severity) {
            this.range = range;
            this.message = message;
            this.severity = severity;
        }
    },
    DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2, Hint: 3 },
    TestMessage: class {
        constructor(message) {
            this.message = message;
        }
    },
    TestRunProfileKind: { Run: 1, Debug: 2, Coverage: 3 },
    window: {
        createOutputChannel: () => ({
            appendLine: () => {},
            show: () => {},
            dispose: () => {}
        }),
        showErrorMessage: () => Promise.resolve(undefined),
        showInformationMessage: () => Promise.resolve(undefined),
        showWarningMessage: () => Promise.resolve(undefined)
    },
    workspace: {
        getConfiguration: () => ({ get: () => undefined }),
        createFileSystemWatcher: () => ({
            onDidChange: () => ({ dispose: () => {} }),
            onDidCreate: () => ({ dispose: () => {} }),
            onDidDelete: () => ({ dispose: () => {} }),
            dispose: () => {}
        }),
        onDidChangeConfiguration: () => ({ dispose: () => {} }),
        workspaceFolders: []
    },
    languages: {
        createDiagnosticCollection: (name) => ({
            set: () => {},
            delete: () => {},
            clear: () => {},
            dispose: () => {}
        })
    },
    tests: {
        createTestController: () => ({
            items: { replace: () => {}, add: () => {}, forEach: () => {} },
            createTestItem: (id, label) => ({
                id,
                label,
                canResolveChildren: false,
                children: { add: () => {}, forEach: () => {}, size: 0 }
            }),
            createRunProfile: () => ({ dispose: () => {} }),
            createTestRun: () => ({
                started: () => {},
                passed: () => {},
                failed: () => {},
                skipped: () => {},
                end: () => {}
            }),
            dispose: () => {}
        })
    },
    commands: {
        registerCommand: (id, handler) => ({ dispose: () => {} }),
        executeCommand: () => Promise.resolve()
    },
    TestRunRequest: class {
        constructor(include, exclude, profile) {
            this.include = include;
            this.exclude = exclude;
            this.profile = profile;
        }
    }
};

module.exports = vscode;
