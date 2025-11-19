import * as vscode from 'vscode';


export function shouldTriggerCompletion(document: vscode.TextDocument, position: vscode.Position): boolean {
    const line = document.lineAt(position.line);
    const textBeforeCursor = line.text.substring(0, position.character);

    // 1. don't trigger in the middle of a word.
    const charAfterCursor = line.text.charAt(position.character);
    if (/\w/.test(charAfterCursor)) {
        return false;
    }

    // 2: don't trigger on an empty line if there's no text on the line above or below.
    if (line.isEmptyOrWhitespace) {
        const lineAbove = position.line > 0 ? document.lineAt(position.line - 1) : undefined;
        const lineBelow = position.line < document.lineCount - 1 ? document.lineAt(position.line + 1) : undefined;
        if (lineAbove?.isEmptyOrWhitespace && lineBelow?.isEmptyOrWhitespace) {
            return false;
        }
    }
    
    return true;
}
