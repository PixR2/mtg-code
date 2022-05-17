
import * as vscode from 'vscode';
import { Card } from './card';
import { CardDB } from './card_db';
import { lineSplitterRegExp, cardLineRegExp } from './regular_expressions';

export const UNKNOWN_CARD_CODE: string = 'unknown_card';

export async function refreshCardDiagnostics(document: vscode.TextDocument, cardDiagnostics: vscode.DiagnosticCollection, cardDB: CardDB) {
    await vscode.window.withProgress({
        cancellable: false,
        location: vscode.ProgressLocation.Window,
        title: 'Running Card Diagnostics'
    }, async (progress) => {
        const diagnostics: vscode.Diagnostic[] = [];

        const lines: string[] = document.getText().split(lineSplitterRegExp);
        for (const [lineNum, line] of lines.entries()) {
            progress.report({
                increment: (lineNum / lines.length) * 100.0
            });

            const search = cardLineRegExp.exec(line);
            if (!search || search.length !== 3) {
                continue;
            }

            let card: Card;
            try {
                card = await cardDB.getCard(search[2]);
            }
            catch (e) {
                const beginAt = line.indexOf(search[2]);
                const range = new vscode.Range(new vscode.Position(lineNum, beginAt), document.lineAt(lineNum).range.end);
                const diagnostic = new vscode.Diagnostic(range, `Unknown card '${search[2]}'.`, vscode.DiagnosticSeverity.Warning);
                diagnostic.code = UNKNOWN_CARD_CODE;
                diagnostics.push(diagnostic);
            }
        }

        cardDiagnostics.set(document.uri, diagnostics);
    });
}

export class FixCardNameCodeActionProvider implements vscode.CodeActionProvider {
    cardDB: CardDB;
    constructor(cardDB: CardDB) {
        this.cardDB = cardDB;
    }

    public static readonly providedCodeActionKinds = [
        vscode.CodeActionKind.QuickFix
    ];

    provideCodeActions(document: vscode.TextDocument, range: vscode.Range | vscode.Selection, context: vscode.CodeActionContext, token: vscode.CancellationToken): vscode.CodeAction[] {
        return context.diagnostics
            .filter(diagnostic => diagnostic.code === UNKNOWN_CARD_CODE)
            .map(diagnostic => this.createCommandCodeAction(diagnostic, document));
    }

    private createCommandCodeAction(diagnostic: vscode.Diagnostic, document: vscode.TextDocument): vscode.CodeAction {
        const matches = this.cardDB.searchCardNamesFuzzy(document.getText(diagnostic.range));

        if (matches.length === 0) {
            const action = new vscode.CodeAction('No closely matching cards.', vscode.CodeActionKind.QuickFix);
            action.diagnostics = [diagnostic];
            action.isPreferred = false;
            action.disabled = { reason: 'No closely matching cards.' };

            return action;
        }

        const bestMatch = matches[0].string;
        const action = new vscode.CodeAction(`Change to '${bestMatch}'.`, vscode.CodeActionKind.QuickFix);
        action.diagnostics = [diagnostic];
        action.isPreferred = true;
        
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, diagnostic.range, bestMatch);
        action.edit = edit;

        return action;
    }
}