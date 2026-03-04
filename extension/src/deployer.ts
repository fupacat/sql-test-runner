import * as cp from 'child_process';
import * as vscode from 'vscode';

export interface DeployResult {
    success: boolean;
    error?: DeployError;
}

export interface DeployError {
    message: string;
    line?: number;
    column?: number;
    filePath: string;
}

/**
 * Deploys changed SQL files incrementally using sqlcmd.
 * On failure, parses the error output and creates VS Code diagnostics.
 */
export class IncrementalDeployer {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private _sqlcmdPath: string;
    private _connectionString: string;

    constructor(
        sqlcmdPath: string,
        connectionString: string,
        diagnosticCollection: vscode.DiagnosticCollection
    ) {
        this._sqlcmdPath = sqlcmdPath;
        this._connectionString = connectionString;
        this.diagnosticCollection = diagnosticCollection;
    }

    /**
     * Deploys a single SQL file using sqlcmd.
     */
    async deployFile(filePath: string): Promise<DeployResult> {
        const connArgs = this.buildConnectionArgs(this._connectionString);
        const args = [...connArgs, '-i', filePath];

        return new Promise(resolve => {
            cp.execFile(this._sqlcmdPath, args, (error, stdout, stderr) => {
                if (error) {
                    const deployError = this.parseError(stderr || stdout, filePath);
                    this.applyDiagnostic(filePath, deployError);
                    resolve({ success: false, error: deployError });
                } else {
                    // Clear any existing diagnostics for this file on success
                    this.diagnosticCollection.delete(vscode.Uri.file(filePath));
                    resolve({ success: true });
                }
            });
        });
    }

    /**
     * Parses sqlcmd error output to extract line number and message.
     * Typical format: "Msg 2714, Level 16, State 3, Server ..., Procedure ..., Line 5"
     */
    parseError(output: string, filePath: string): DeployError {
        let line: number | undefined;
        let column: number | undefined;

        // Try to extract line number from sqlcmd output
        // Pattern: "Line N" at end of message
        const lineMatch = /[Ll]ine\s+(\d+)/i.exec(output);
        if (lineMatch) {
            line = parseInt(lineMatch[1], 10) - 1; // VS Code lines are 0-based
        }

        // Pattern: "Col N"
        const colMatch = /[Cc]ol\s+(\d+)/i.exec(output);
        if (colMatch) {
            column = parseInt(colMatch[1], 10) - 1;
        }

        // Extract the primary message (first non-empty line)
        const message = output
            .split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 0)[0] ?? 'Deployment failed';

        return { message, line, column, filePath };
    }

    /**
     * Creates a VS Code Diagnostic for the deployment error.
     */
    private applyDiagnostic(filePath: string, error: DeployError): void {
        const uri = vscode.Uri.file(filePath);
        const line = error.line ?? 0;
        const col = error.column ?? 0;
        const range = new vscode.Range(line, col, line, Number.MAX_SAFE_INTEGER);
        const diag = new vscode.Diagnostic(
            range,
            error.message,
            vscode.DiagnosticSeverity.Error
        );
        diag.source = 'SQL Test Runner';
        this.diagnosticCollection.set(uri, [diag]);
    }

    /**
     * Parses a SQL Server connection string into sqlcmd arguments.
     * Supports: Server=..., Database=..., User Id=..., Password=..., TrustServerCertificate=...
     */
    buildConnectionArgs(connectionString: string): string[] {
        const args: string[] = [];
        const parts = connectionString.split(';').filter(p => p.trim().length > 0);
        const params: Record<string, string> = {};
        for (const part of parts) {
            const eqIdx = part.indexOf('=');
            if (eqIdx >= 0) {
                const key = part.substring(0, eqIdx).trim().toLowerCase();
                const val = part.substring(eqIdx + 1).trim();
                params[key] = val;
            }
        }

        const server = params['server'] ?? params['data source'];
        const database = params['database'] ?? params['initial catalog'];
        const user = params['user id'] ?? params['uid'];
        const password = params['password'] ?? params['pwd'];
        const trustCert = params['trustservercertificate'];

        if (server) { args.push('-S', server); }
        if (database) { args.push('-d', database); }
        if (user) {
            args.push('-U', user);
        }
        if (password) {
            args.push('-P', password);
        }
        if (!user) {
            // Windows integrated auth
            args.push('-E');
        }
        if (trustCert && trustCert.toLowerCase() === 'true') {
            args.push('-C');
        }

        return args;
    }

    updateConfig(sqlcmdPath: string, connectionString: string): void {
        this._sqlcmdPath = sqlcmdPath;
        this._connectionString = connectionString;
    }
}
