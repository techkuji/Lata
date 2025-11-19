import * as vscode from 'vscode';
import * as path from 'path';
import { spawn } from 'child_process';
import { IContextProvider, ContextSnippet } from '../IContextProvider';
import { ParseMode, parseTsJsFile } from './tsJsParser';


// To get a structural summary of the current file by running the correct AST (Abstract Syntax Tree) parser.

const config = vscode.workspace.getConfiguration('lata');

export class AstContextProvider implements IContextProvider {
    providerName = 'ast';

    async getContext(document: vscode.TextDocument, position: vscode.Position): Promise<ContextSnippet[]> {
        const languageId = document.languageId;
        const filePath = document.uri.fsPath;
        const fileContent = document.getText();

        const mode: ParseMode =  config.get<ParseMode>('intelligent') || 'intelligent';

        let parsedContext = "";
        if (["typescript", "javascript", "typescriptreact", "javascriptreact"].includes(languageId)) {
            parsedContext = parseTsJsFile(filePath, fileContent, mode);
        } else if (languageId === 'python') {
            parsedContext = await this.runPythonParser(filePath, fileContent, mode);
        }

        if (parsedContext) {
            return [{
                content: `<ast_summary file_path="${path.basename(filePath)}">\n${parsedContext}\n</ast_summary>`,
                priority: 70 // High priority, but less than the immediate sliding window
            }];
        }
        return [];
    }

    private async runPythonParser(filePath: string, fileContent: string, mode: ParseMode): Promise<string> {
        const parserScriptPath = path.join(__dirname, 'pythonParser.py');
        return new Promise((resolve) => {
            const process = spawn('python3', [parserScriptPath, filePath, mode]);
            
            process.stdin.write(fileContent);
            process.stdin.end();

            let stdoutData = '', stderrData = '';
            process.stdout.on('data', (data) => stdoutData += data.toString());
            process.stderr.on('data', (data) => stderrData += data.toString());
            process.on('close', (code) => {
                if (code !== 0) {
                    console.error(`Python parser failed with code ${code}:`, stderrData);
                    resolve("");
                } else {
                    resolve(stdoutData);
                }
            });
        });
    }
}
