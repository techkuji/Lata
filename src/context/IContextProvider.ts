import * as vscode from 'vscode';

//Represents a piece of context gathered for the LLM prompt.
export interface ContextSnippet {
    content: string;
    priority: number; // score to help rank context against others.
}

/**
 * The interface for all context providers. Each provider has a single job:
 * to gather one specific type of context.
 */
export interface IContextProvider {
    providerName: string;
    getContext(document: vscode.TextDocument, position: vscode.Position): Promise<ContextSnippet[]>;
}
