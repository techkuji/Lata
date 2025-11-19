import * as vscode from 'vscode';
import { shouldTriggerCompletion } from '../prefiltering/shouldTrigger';
import { PromptManager } from './prompt/promptManager';
import { LLM, OllamaLLM, OpenAILLM, ClaudeLLM, GeminiLLM, SelfHostedLLM } from './llm';
import { cleanSuggestion } from '../postprocessing/clean';
import { processSuggestion } from '../postprocessing/filter';


// main controller for the inline completion, this class orchestrates the entire pipeline, from pre-filtering to post-processing.
export class CompletionProvider implements vscode.InlineCompletionItemProvider {
    private debounceTimer: NodeJS.Timeout | null = null;
    private promptManager: PromptManager;
    private llms: Map<string, LLM>;

    // cache for the last completion
    private lastCompletion: {
        uri: string;
        line: number;
        // full text of the line at moment of completion, including suggestion
        fullLineText: string;
    } | null = null;

    constructor() {
        this.promptManager = new PromptManager();
        
        this.llms = new Map();
        this.llms.set('local', new OllamaLLM());
        this.llms.set('openai', new OpenAILLM());
        this.llms.set('claude', new ClaudeLLM());
        this.llms.set('gemini', new GeminiLLM());
        this.llms.set('self_hosted', new SelfHostedLLM());
    }

    public async provideInlineCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.InlineCompletionContext,
        token: vscode.CancellationToken
    ): Promise<vscode.InlineCompletionItem[] | undefined> {
        
        if (!shouldTriggerCompletion(document, position)) {
            // invalidate cache if we decide not to trigger
            this.lastCompletion = null;
            return undefined;
        }

        // completion based cachingg
        const linePrefix = document.lineAt(position.line).text.substring(0, position.character);
        if (
            this.lastCompletion &&
            this.lastCompletion.uri === document.uri.toString() &&
            this.lastCompletion.line === position.line &&
            this.lastCompletion.fullLineText.startsWith(linePrefix)
        ) {
            const remainingSuggestion = this.lastCompletion.fullLineText.substring(linePrefix.length);
            if (remainingSuggestion) {
                console.log("Returning suggestion from completion cache.");
                return [{
                    insertText: remainingSuggestion,
                    range: new vscode.Range(position, position)
                }];
            }
        }

        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        return new Promise((resolve) => {
            this.debounceTimer = setTimeout(async () => {
                if (token.isCancellationRequested) {
                    this.lastCompletion = null; // invalidate cache on cancellation 
                    return resolve(undefined);
                }

                try {
                    const prompt = await this.promptManager.buildPrompt(document, position);
                    if (token.isCancellationRequested) return resolve(undefined);

                    const config = vscode.workspace.getConfiguration('lata');
                    const reqType = config.get<string>('reqType', 'local');
                    const llm = this.llms.get(reqType);

                    if (!llm) {
                        vscode.window.showErrorMessage(`Lata: Unknown request type '${reqType}' configured.`);
                        return resolve(undefined);
                    }
                    
                    const statusBarMessage = vscode.window.setStatusBarMessage(`$(sync~spin) Lata is thinking...`);
                    const rawSuggestion = await llm.getCompletion(prompt);
                    statusBarMessage.dispose();

                    if (token.isCancellationRequested) return resolve(undefined);
                    
                    const cleaned = cleanSuggestion(rawSuggestion);
                    const finalSuggestion = processSuggestion(cleaned, document, position);

                    if (finalSuggestion) {
                        // update the completion cache
                        this.lastCompletion = {
                            uri: document.uri.toString(),
                            line: position.line,
                            fullLineText: linePrefix + finalSuggestion
                        };

                        resolve([{
                            insertText: finalSuggestion,
                            range: new vscode.Range(position, position),
                        }]);
                    } else {
                        // invalidate cache if no suggestion was found
                        this.lastCompletion = null;
                        resolve(undefined);
                    }

                } catch (error) {
                    this.lastCompletion = null;
                    console.error("Error during completion pipeline:", error);
                    resolve(undefined);
                }
            }, 300);
        });
    }
}
