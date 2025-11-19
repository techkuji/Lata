import * as vscode from 'vscode';
import { exec } from 'child_process';
import { IContextProvider, ContextSnippet } from '../IContextProvider';

// Gathers context from `git diff` to see the recent, uncommitted changes.
export class GitDiffContextProvider implements IContextProvider {
    providerName = 'gitDiff';

    async getContext(document: vscode.TextDocument, position: vscode.Position): Promise<ContextSnippet[]> {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder) {
            return [];
        }

        return new Promise((resolve) => {
            exec('git diff --staged', { cwd: workspaceFolder.uri.fsPath }, (error, stdout, stderr) => {
                if (error || stderr) {
                    return resolve([]);
                }
                
                if (stdout.trim().length > 0) {
                    resolve([{
                        content: `<git_diff>\n${stdout}\n</git_diff>`,
                        priority: 80
                    }]);
                } else {
                    resolve([]);
                }
            });
        });
    }
}
