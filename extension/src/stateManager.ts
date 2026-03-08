import * as vscode from 'vscode';
import * as cp from 'child_process';

export interface StateInfo {
    currentBranch: string;
    lastDeployHash: string;
}

/**
 * Tracks internal state: current git branch, last deployed commit hash.
 * Detects branch changes and prompts the user to rebuild or sync.
 */
export class StateManager {
    private currentBranch: string = '';
    private lastDeployHash: string = '';
    private workspaceRoot: string;
    private branchPollInterval: ReturnType<typeof setInterval> | null = null;

    constructor(
        workspaceRoot: string,
        private readonly onBranchChange: (newBranch: string, oldBranch: string) => void
    ) {
        this.workspaceRoot = workspaceRoot;
    }

    /**
     * Starts polling for branch changes every 30 seconds.
     */
    startWatching(): void {
        this.updateCurrentBranch();
        this.branchPollInterval = setInterval(() => {
            this.checkBranchChange();
        }, 30000);
    }

    stopWatching(): void {
        if (this.branchPollInterval) {
            clearInterval(this.branchPollInterval);
            this.branchPollInterval = null;
        }
    }

    private async updateCurrentBranch(): Promise<void> {
        const branch = await this.getGitBranch();
        this.currentBranch = branch;
    }

    private async checkBranchChange(): Promise<void> {
        const newBranch = await this.getGitBranch();
        if (newBranch && newBranch !== this.currentBranch) {
            const oldBranch = this.currentBranch;
            this.currentBranch = newBranch;
            this.onBranchChange(newBranch, oldBranch);
        }
    }

    private getGitBranch(): Promise<string> {
        return new Promise(resolve => {
            cp.exec(
                'git rev-parse --abbrev-ref HEAD',
                { cwd: this.workspaceRoot },
                (error, stdout) => {
                    resolve(error ? '' : stdout.trim());
                }
            );
        });
    }

    updateLastDeployHash(hash: string): void {
        this.lastDeployHash = hash;
    }

    getState(): StateInfo {
        return {
            currentBranch: this.currentBranch,
            lastDeployHash: this.lastDeployHash
        };
    }

    /**
     * Prompts user when branch changes and executes the chosen action.
     */
    static async promptBranchChange(
        newBranch: string,
        oldBranch: string,
        onRebuild: () => Promise<void>,
        onIncrementalSync: () => Promise<void>
    ): Promise<void> {
        const choice = await vscode.window.showWarningMessage(
            `Branch changed from '${oldBranch}' to '${newBranch}'. How would you like to sync the database?`,
            'Full Rebuild',
            'Incremental Sync',
            'Do Nothing'
        );
        if (choice === 'Full Rebuild') {
            await onRebuild();
        } else if (choice === 'Incremental Sync') {
            await onIncrementalSync();
        }
    }
}
