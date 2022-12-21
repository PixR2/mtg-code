import * as vscode from 'vscode';
import { lineSplitterRegExp, searchLineRegExp } from './regular_expressions';

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