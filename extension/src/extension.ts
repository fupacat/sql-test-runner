import * as vscode from 'vscode';
import { SqlConnectionManager } from './sqlConnection';
import { TestDiscovery } from './testDiscovery';
import { ObjectMapper } from './objectMapper';
import { IncrementalDeployer, DeployResult } from './deployer';
import { TestRunner } from './testRunner';
import { CiModeRunner } from './ciMode';
import { StateManager } from './stateManager';

let connectionManager: SqlConnectionManager | null = null;
let fileWatcher: vscode.FileSystemWatcher | null = null;
let stateManager: StateManager | null = null;
const outputChannel = vscode.window.createOutputChannel('SQL Test Runner');

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    outputChannel.appendLine('SQL Test Runner activating...');

    // Create TestController for VS Code Test Explorer
    const controller = vscode.tests.createTestController(
        'sqlTestRunner',
        'SQL Tests'
    );
    context.subscriptions.push(controller);

    // Create diagnostic collection for deployment errors
    const diagnostics = vscode.languages.createDiagnosticCollection('sqlTestRunner');
    context.subscriptions.push(diagnostics);

    // Initialise core services
    const config = getConfig();
    connectionManager = new SqlConnectionManager(config.connectionString);
    const objectMapper = new ObjectMapper();
    const deployer = new IncrementalDeployer(config.sqlcmdPath, config.connectionString, diagnostics);
    const discovery = new TestDiscovery(connectionManager, controller);
    const runner = new TestRunner(connectionManager, controller);

    // State manager for branch change detection
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();
    stateManager = new StateManager(workspaceRoot, async (newBranch, oldBranch) => {
        await StateManager.promptBranchChange(
            newBranch,
            oldBranch,
            async () => {
                await vscode.commands.executeCommand('sqlTestRunner.ciRebuildAndTest');
            },
            async () => {
                await discovery.discoverAll();
            }
        );
    });
    stateManager.startWatching();
    context.subscriptions.push({ dispose: () => stateManager?.stopWatching() });

    // Register test run handler
    controller.createRunProfile(
        'Run Tests',
        vscode.TestRunProfileKind.Run,
        async (request, token) => {
            const run = controller.createTestRun(request);
            try {
                if (request.include && request.include.length > 0) {
                    for (const item of request.include) {
                        if (token.isCancellationRequested) { break; }
                        run.started(item);
                        if (item.children.size === 0) {
                            // single test
                            await runner.runTest(run, item.id);
                        } else {
                            // class
                            item.children.forEach(child => run.started(child));
                            await runner.runClass(run, item.id);
                        }
                    }
                } else {
                    // Run all
                    controller.items.forEach(item => {
                        run.started(item);
                        item.children.forEach(child => run.started(child));
                    });
                    await runner.runAll(run);
                }
            } catch (err) {
                outputChannel.appendLine(`Test run error: ${err}`);
                vscode.window.showErrorMessage(`SQL Test Runner: ${err}`);
            } finally {
                run.end();
            }
        },
        true
    );

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('sqlTestRunner.runAll', async () => {
            const run = controller.createTestRun(new vscode.TestRunRequest());
            try {
                controller.items.forEach(item => {
                    run.started(item);
                    item.children.forEach(child => run.started(child));
                });
                await runner.runAll(run);
            } finally {
                run.end();
            }
        }),

        vscode.commands.registerCommand('sqlTestRunner.refreshTests', async () => {
            try {
                await discovery.discoverAll();
                outputChannel.appendLine('Test discovery complete.');
            } catch (err) {
                vscode.window.showErrorMessage(`Failed to discover tests: ${err}`);
            }
        }),

        vscode.commands.registerCommand('sqlTestRunner.ciRebuildAndTest', async () => {
            const cfg = getConfig();
            const ciRunner = new CiModeRunner(connectionManager!, runner, {
                dacpacPath: cfg.dacpacPath,
                junitOutputPath: cfg.junitOutputPath,
                sqlcmdPath: cfg.sqlcmdPath,
                connectionString: cfg.connectionString
            });
            const success = await ciRunner.run(outputChannel);
            if (!success) {
                vscode.window.showErrorMessage('SQL Test Runner: CI build FAILED. Check Output panel.');
            } else {
                vscode.window.showInformationMessage('SQL Test Runner: CI build PASSED.');
            }
        }),

        vscode.commands.registerCommand('sqlTestRunner.runClass', async () => {
            const classes: string[] = [];
            controller.items.forEach(item => classes.push(item.id));

            if (classes.length === 0) {
                vscode.window.showWarningMessage(
                    'SQL Test Runner: No test classes found. Run "Refresh Tests" first.'
                );
                return;
            }

            const selected = await vscode.window.showQuickPick(classes, {
                placeHolder: 'Select a test class to run'
            });
            if (!selected) { return; }

            const classItem = controller.items.get(selected);
            if (!classItem) {
                vscode.window.showErrorMessage(
                    `SQL Test Runner: Test class "${selected}" not found. Try refreshing tests.`
                );
                return;
            }

            const run = controller.createTestRun(new vscode.TestRunRequest());
            try {
                run.started(classItem);
                classItem.children.forEach(child => run.started(child));
                await runner.runClass(run, selected);
            } catch (err) {
                outputChannel.appendLine(`Run class error: ${err}`);
                vscode.window.showErrorMessage(`SQL Test Runner: ${err}`);
            } finally {
                run.end();
            }
        }),

        vscode.commands.registerCommand('sqlTestRunner.resetDatabase', async () => {
            const confirm = await vscode.window.showWarningMessage(
                'This will reset the dev database. Are you sure?',
                'Yes', 'Cancel'
            );
            if (confirm === 'Yes') {
                try {
                    await connectionManager!.query('EXEC tSQLt.Reset');
                    outputChannel.appendLine('Database reset complete.');
                    vscode.window.showInformationMessage('Database reset complete.');
                    await discovery.discoverAll();
                } catch (err) {
                    vscode.window.showErrorMessage(`Reset failed: ${err}`);
                }
            }
        })
    );

    // File watcher
    setupFileWatcher(context, config, deployer, objectMapper, discovery, runner, controller);

    // Configuration change listener
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('sqlTestRunner')) {
                const newConfig = getConfig();
                connectionManager!.updateConnectionString(newConfig.connectionString);
                deployer.updateConfig(newConfig.sqlcmdPath, newConfig.connectionString);
            }
        })
    );

    // Initial test discovery (non-blocking)
    discovery.discoverAll().then(() => {
        outputChannel.appendLine('Initial test discovery complete.');
    }).catch(err => {
        outputChannel.appendLine(`Initial test discovery failed (container may not be ready): ${err}`);
    });

    outputChannel.appendLine('SQL Test Runner activated.');
}

function setupFileWatcher(
    context: vscode.ExtensionContext,
    config: ReturnType<typeof getConfig>,
    deployer: IncrementalDeployer,
    objectMapper: ObjectMapper,
    discovery: TestDiscovery,
    runner: TestRunner,
    controller: vscode.TestController
): void {
    if (fileWatcher) {
        fileWatcher.dispose();
    }

    // Watch both source and test SQL files
    fileWatcher = vscode.workspace.createFileSystemWatcher('**/{src,tests}/**/*.sql');
    context.subscriptions.push(fileWatcher);

    fileWatcher.onDidChange(async (uri) => {
        if (!config.autoRunOnSave) { return; }
        await onSqlFileSaved(uri, deployer, objectMapper, discovery, runner, controller);
    });

    fileWatcher.onDidCreate(async (uri) => {
        if (!config.autoRunOnSave) { return; }
        await onSqlFileSaved(uri, deployer, objectMapper, discovery, runner, controller);
    });

    fileWatcher.onDidDelete((uri) => {
        objectMapper.removeFile(uri.fsPath);
    });
}

async function onSqlFileSaved(
    uri: vscode.Uri,
    deployer: IncrementalDeployer,
    objectMapper: ObjectMapper,
    discovery: TestDiscovery,
    runner: TestRunner,
    controller: vscode.TestController
): Promise<void> {
    outputChannel.appendLine(`[Deploy] ${uri.fsPath}`);

    // Deploy the changed file
    const result: DeployResult = await deployer.deployFile(uri.fsPath);
    if (!result.success) {
        outputChannel.appendLine(`[Deploy] FAILED: ${result.error?.message}`);
        return;
    }
    outputChannel.appendLine('[Deploy] Success');

    // Parse the object defined in this file
    const sqlObj = objectMapper.parseFile(uri.fsPath);

    // Determine which tests to run
    let testsToRun: string[] = [];

    if (sqlObj) {
        // Level 2: check reverse index
        testsToRun = objectMapper.getTestsForObject(sqlObj.name);
    }

    if (testsToRun.length === 0) {
        // Level 1 heuristic: find tests whose name contains the object name
        const objectName = sqlObj?.name ?? objectMapper.getObjectNameFromPath(uri.fsPath);
        const snapshot = buildTestItemSnapshot(controller);
        testsToRun = snapshot.filter(t => t.toLowerCase().includes(objectName.toLowerCase()));
    }

    if (testsToRun.length === 0) {
        outputChannel.appendLine('[Run] No specific tests found; running all tests.');
        const run = controller.createTestRun(new vscode.TestRunRequest());
        try {
            controller.items.forEach(item => {
                run.started(item);
                item.children.forEach(child => run.started(child));
            });
            await runner.runAll(run);
        } finally {
            run.end();
        }
        return;
    }

    outputChannel.appendLine(`[Run] Running ${testsToRun.length} test(s): ${testsToRun.join(', ')}`);
    const run = controller.createTestRun(new vscode.TestRunRequest());
    try {
        await runner.runTests(run, testsToRun);
    } finally {
        run.end();
    }
}

function buildTestItemSnapshot(controller: vscode.TestController): string[] {
    const names: string[] = [];
    controller.items.forEach(classItem => {
        classItem.children.forEach(caseItem => {
            names.push(caseItem.id);
        });
    });
    return names;
}

function getConfig() {
    const cfg = vscode.workspace.getConfiguration('sqlTestRunner');
    return {
        connectionString: cfg.get<string>('connectionString') ??
            'Server=localhost,1433;Database=DevDb;User Id=sa;Password=<YOUR_SA_PASSWORD>;TrustServerCertificate=true',
        sqlcmdPath: cfg.get<string>('sqlcmdPath') ?? 'sqlcmd',
        autoRunOnSave: cfg.get<boolean>('autoRunOnSave') ?? true,
        dacpacPath: cfg.get<string>('dacpacPath') ?? '',
        junitOutputPath: cfg.get<string>('junitOutputPath') ?? 'test-results/junit.xml'
    };
}

export function deactivate(): void {
    connectionManager?.disconnect();
    fileWatcher?.dispose();
    stateManager?.stopWatching();
    outputChannel.appendLine('SQL Test Runner deactivated.');
}
