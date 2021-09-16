import { info } from 'console';
import * as vscode from 'vscode';
import { Card } from './card';
import { CardDB } from './card_db';

const cardDecorationType: vscode.TextEditorDecorationType = vscode.window.createTextEditorDecorationType({});

const lineSplitterRegexp: RegExp = /\r?\n/g;
let cardLineRegexp: RegExp = /^(\d+) +(.+)$/;

export async function setCardDecorations(editor: vscode.TextEditor, cardDB: CardDB) {
    await vscode.window.withProgress({
        cancellable: false,
        location: vscode.ProgressLocation.Window,
        title: 'Adding Card Decorations'
    }, async (progress) => {
        let decorations: vscode.DecorationOptions[] = [];

        const lines: string[] = editor.document.getText().split(lineSplitterRegexp);
        for (const [lineNum, line] of lines.entries()) {
            progress.report({
                increment: (lineNum / lines.length) * 100.0
            });

            const search = cardLineRegexp.exec(line);
            if (!search || search.length !== 3) {
                continue;
            }

            let card: Card;
            try {
                card = await cardDB.getCard(search[2]);
            }
            catch (e) {
                continue;
            }

            const infos: string[] = [];
            if (card.manaCost) {
                infos.push(card.manaCost);
            } else if (card.cardFaces) {
                infos.push(
                    card.cardFaces.map(
                        cardFace => cardFace.manaCost
                    ).filter(
                        manaCost => manaCost !== undefined && manaCost.length > 0
                    ).join(' // '));
            }
            if (card.typeLine) {
                infos.push(card.typeLine);
            }
            if (card.power || card.toughness) {
                infos.push(`${card.power}/${card.toughness}`);
            }
            const infoStr: string = infos.join(' | ');

            decorations.push(
                {
                    range: new vscode.Range(
                        new vscode.Position(lineNum, search[0].length),
                        new vscode.Position(lineNum, search[0].length)
                    ),
                    renderOptions: {
                        after: {
                            contentText: infoStr,
                            margin: '10px',
                            color: new vscode.ThemeColor('badge.background')
                        }
                    }
                }
            );
        }

        editor.setDecorations(cardDecorationType, decorations);
    });
}