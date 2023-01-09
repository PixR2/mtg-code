import * as vscode from 'vscode';
import { Card } from './card';
import { CardDB } from './card_db';
import { cardLineRegExp, lineSplitterRegExp, searchLineRegExp } from './regular_expressions';

export class CardSearchLensProvider implements vscode.CodeLensProvider {
    constructor() { }

    onDidChangeCodeLenses?: vscode.Event<void> | undefined;
    provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens[]> {
        const lines: string[] = document.getText().split(lineSplitterRegExp);

        let codeLenses: vscode.CodeLens[] = [];
        for (const [lineNum, line] of lines.entries()) {
            const search = searchLineRegExp.exec(line);
            if (!search || search.length !== 2) {
                continue;
            }

            let searchStr: string = search[1].trim();
            const cmd: vscode.Command = {
                command: 'mtg-code.search-cards',
                title: 'Search Cards',
                arguments: [searchStr]
            };

            const newCodeLens = new vscode.CodeLens(document.lineAt(lineNum).range, cmd);
            codeLenses.push(newCodeLens);
        }

        return codeLenses;
    }
}

export class CardRulingsLensProvider implements vscode.CodeLensProvider {
    cardDB: CardDB;

    constructor(cardDB: CardDB) {
        this.cardDB = cardDB;
    }

    onDidChangeCodeLenses?: vscode.Event<void> | undefined;
    async provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.CodeLens[] | null | undefined> {
        const lines: string[] = document.getText().split(lineSplitterRegExp);

        let codeLenses: vscode.CodeLens[] = [];
        for (const [lineNum, line] of lines.entries()) {
            const search = cardLineRegExp.exec(line);
            if (!search || search.length !== 3) {
                continue;
            }

            let card: Card;
            try {
                card = await this.cardDB.getCard(search[2]);
            }
            catch (e) {
                continue;
            }

            const cmd: vscode.Command = {
                command: 'mtg-code.show-card-rulings',
                title: 'Show Card Rulings',
                arguments: [card]
            };

            const newCodeLens = new vscode.CodeLens(document.lineAt(lineNum).range, cmd);
            codeLenses.push(newCodeLens);
        }

        return codeLenses;
    }
}