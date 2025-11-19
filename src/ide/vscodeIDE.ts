import * as vscode from 'vscode';

/**
 * An interface that defines all the actions we need from the IDE.
 * This allows us to decouple the core logic from the specific VS Code API.
 */
export interface IIDE {
    getActiveTextEditor(): vscode.TextEditor | undefined;
    getWorkspaceFolders(): readonly vscode.WorkspaceFolder[] | undefined;
    showErrorMessage(message: string): void;
}

/**
 * The concrete implementation of the IIDE interface for Visual Studio Code.
 */
export class VscodeIDE implements IIDE {
    getActiveTextEditor(): vscode.TextEditor | undefined {
        return vscode.window.activeTextEditor;
    }

    getWorkspaceFolders(): readonly vscode.WorkspaceFolder[] | undefined {
        return vscode.workspace.workspaceFolders;
    }

    showErrorMessage(message: string): void {
        vscode.window.showErrorMessage(message);
    }
}
