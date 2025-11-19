import * as vscode from 'vscode';
import * as path from 'path';
import { IContextProvider, ContextSnippet } from '../IContextProvider';


// Gathers context from other open tabs in the editor
export class OpenFileContextProvider implements IContextProvider {
    providerName = 'openFiles';

    async getContext(document: vscode.TextDocument, position: vscode.Position): Promise<ContextSnippet[]> {
        const openFiles: ContextSnippet[] = [];
        const currentFilePath = document.uri.fsPath;

        for (const tabGroup of vscode.window.tabGroups.all) {
            for (const tab of tabGroup.tabs) {
                if (tab.input instanceof vscode.TabInputText && tab.input.uri.fsPath !== currentFilePath) {
                    try {
                        const doc = await vscode.workspace.openTextDocument(tab.input.uri);
                        const content = doc.getText().substring(0, 1000); // Limit content size
                        const relativePath = vscode.workspace.asRelativePath(doc.uri);

                        openFiles.push({
                            content: `<file_context file_path="${relativePath}">\n${content}\n</file_context>`,
                            priority: 50 // Medium priority
                        });
                    } catch (e) {
                        console.error(`Could not read open file: ${tab.input.uri.fsPath}`, e);
                    }
                }
            }
        }
        return openFiles;
    }
}
