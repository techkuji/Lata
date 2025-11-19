import * as vscode from 'vscode';
import { IContextProvider, ContextSnippet } from '../IContextProvider';

// To provides the raw text from the current file, surrounding the cursor, split into a prefix and suffix.
export class SlidingWindowContextProvider implements IContextProvider {
    providerName = 'slidingWindow';

    async getContext(document: vscode.TextDocument, position: vscode.Position): Promise<ContextSnippet[]> {
        const fullText = document.getText();
        const offset = document.offsetAt(position);

        // window of 2000 chars before and 2000 after.
        const prefix = fullText.substring(Math.max(0, offset - 2000), offset);
        const suffix = fullText.substring(offset, Math.min(fullText.length, offset + 2000));

        return [
            { content: `<prefix>${prefix}</prefix>`, priority: 100 },
            { content: `<suffix>${suffix}</suffix>`, priority: 100 }
        ];
    }
}
