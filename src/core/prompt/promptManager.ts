import * as vscode from 'vscode';
import * as path from 'path';
import { IContextProvider, ContextSnippet } from '../../context/IContextProvider';
import { SlidingWindowContextProvider } from '../../context/providers/slidingWindow';
import { OpenFileContextProvider } from '../../context/providers/openFiles';
import { GitDiffContextProvider } from '../../context/providers/gitDiff';
import { AstContextProvider } from '../../context/ast/astProvider';
import { formatFimPrompt } from './templates';

// "dimag" of the operation. It orchestrates the entire context gathering
export class PromptManager {
    private providers: IContextProvider[];

    constructor() {
        this.providers = [
            new SlidingWindowContextProvider(),
            new OpenFileContextProvider(),
            new GitDiffContextProvider(),
            new AstContextProvider(),
        ];
    }

    /**
     * Gathers context from all providers and builds the final prompt.
     * @param document The active text document.
     * @param position The current cursor position.
     * @returns The fully formatted prompt string for the LLM.
     */
    public async buildPrompt(document: vscode.TextDocument, position: vscode.Position): Promise<string> {
        // 1. Run all context providers in parallel.
        const allContextPromises = this.providers.map(p => p.getContext(document, position));
        const allSnippets = (await Promise.all(allContextPromises)).flat();

        // 2. Sort the collected snippets by their priority score.
        allSnippets.sort((a, b) => b.priority - a.priority);

        // 3. Extract the essential prefix from the highest priority provider.
        const prefixSnippet = allSnippets.find(s => s.content.startsWith('<prefix>'));
        
        if (!prefixSnippet) {
            throw new Error("Core context (prefix) could not be gathered.");
        }

        const prefix = prefixSnippet.content.replace(/<\/?prefix>/g, '');
        
        // 4. Build the high-level context string from all other snippets.
        const highLevelContext = allSnippets
            .filter(s => !s.content.startsWith('<prefix>') && !s.content.startsWith('<suffix>'))
            .map(s => s.content)
            .join('\n\n');
        
        // 5. Pass everything to the formatter to assemble the final prompt.
        const config = vscode.workspace.getConfiguration('lata');
        const modelType = config.get<string>('modelType', 'default'); // 'codellama', 'deepseek', 'default', or others :)
        
        return formatFimPrompt(prefix, "", highLevelContext, modelType, document.languageId, path.basename(document.uri.fsPath));
    }
}
