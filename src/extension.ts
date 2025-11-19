import * as vscode from 'vscode';
import { CompletionProvider } from './core/completionProvider';
import { VscodeIDE } from './ide/vscodeIDE';


export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "Lata" is now active!');

    const ide = new VscodeIDE();
    const completionProvider = new CompletionProvider();

    // register the inline completion provider with VS Code
    const inlineCompletionProviderDisposable = vscode.languages.registerInlineCompletionItemProvider(
        { scheme: 'file' },
        completionProvider
    );
    
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = "$(circle-filled) Lata";
    statusBarItem.tooltip = "Click for Lata options";
    statusBarItem.command = 'lata.showStatusMenu';
    statusBarItem.show();

    const showStatusCommand = vscode.commands.registerCommand('lata.showStatusMenu', () => {
        vscode.window.showInformationMessage("Lata status menu clicked!");
    });

    context.subscriptions.push(
        inlineCompletionProviderDisposable,
        statusBarItem,
        showStatusCommand
    );
}

export function deactivate() {}
