import * as vscode from 'vscode';


function stripCommonPrefix(suggestion: string, document: vscode.TextDocument, position: vscode.Position): string {
    const lineTextBeforeCursor = document.lineAt(position.line).text.substring(0, position.character);
    const trimmedSuggestion = suggestion.trim();
    const trimmedLine = lineTextBeforeCursor.trim();

    if (trimmedSuggestion.startsWith(trimmedLine)) {
        // find index where our typing ends in the suggestion
        const matchIndex = suggestion.indexOf(lineTextBeforeCursor);
        if (matchIndex !== -1) {
            // return part of the suggestion that comes after what we typed
            return suggestion.substring(matchIndex + lineTextBeforeCursor.length);
        }
    }
    
    return suggestion;
}

// discards suggestions that are empty or just whitespace.
function nonEmtpyFilter(suggestion: string): boolean {
    return suggestion.trim().length > 0;
}

export function processSuggestion(suggestion: string, document: vscode.TextDocument, position: vscode.Position): string | null {
    // strip the overlapping prefix.
    let processedSuggestion = stripCommonPrefix(suggestion, document, position);

    // run validation filters on the result.
    if (!nonEmtpyFilter(processedSuggestion)) {
        return null;
    }
    
    return processedSuggestion;
}
