import * as vscode from 'vscode';
import { Card } from "./card";
import { CardDB } from "./card_db";
import { Ruling } from './card_rulings';
import { cardLineRegExp } from './regular_expressions';

function getHTMLImagesLine(card: Card): string | undefined {
    let oracleText = card.oracleText ?
        card.oracleText?.replace(/\"/g, "'") :
        card.cardFaces ?
            card.cardFaces.map(cardFace => cardFace.oracleText ? cardFace.oracleText.replace(/\"/g, "'") : '').join('\n//\n')
            : 'no oracle text';

    return card.imageUris ?
        `<img src="${card.imageUris?.small}" alt="image of ${card.name}" title="${oracleText}"/>` :
        card.cardFaces?.map(cardFace => `<img src="${cardFace.imageUris?.small}" alt="image of ${cardFace.name}" title="${cardFace.oracleText?.replace(/\"/g, "'")}"/>`).join('');
}

function getPriceLine(card: Card): string | undefined {
    let usdPrice = `${card.prices?.usd ? card.prices?.usd : card.prices?.usdFoil ? card.prices?.usdFoil : ' - '}`;
    let eurPrice = `${card.prices?.eur ? card.prices?.eur : card.prices?.eurFoil ? card.prices?.eurFoil : ' - '}`;
    return `<p><b>Price: </b>${usdPrice}$ / ${eurPrice}€</p>`;
}

export function searchCards(cardDB: CardDB) {
    return async (searchStr: string | undefined) => {
        await vscode.window.withProgress({
            cancellable: false,
            location: vscode.ProgressLocation.Notification,
            title: 'Searching for Cards',
        }, async (progress) => {
            if (searchStr === undefined) {
                searchStr = await vscode.window.showInputBox({
                    placeHolder: 'Enter your search query...',
                });
            }

            if (searchStr === undefined) {
                return;
            }

            let cards: Card[];
            try {
                let cardNames = await cardDB.searchCardsAdvanced(searchStr);
                cards = await Promise.all(cardNames.map(cardName => cardDB.getCard(cardName)));
            } catch (e) {
                vscode.window.showErrorMessage(`search failed: ${e}`);
                return;
            }

            let searchDocumentContent = `<h1>Search: ${searchStr}</h1>${cards.map((card) => {
                let imagesLine = getHTMLImagesLine(card);
                let priceLine = getPriceLine(card);
                return `<h2 style="padding-top: 12px;">${card.name}</h2>${imagesLine}${priceLine}`;
            }).join('')}`;

            const panel = vscode.window.createWebviewPanel(
                'Search Result',
                `Search: ${searchStr}`,
                vscode.ViewColumn.Two,
                {
                    enableScripts: false,
                    enableCommandUris: false,
                    enableFindWidget: false,
                },
            );

            panel.webview.html = searchDocumentContent;
        });
    };
}

export function showCardRulings(cardDB: CardDB) {
    return async (cardName: string | undefined) => {
        await vscode.window.withProgress({
            cancellable: false,
            location: vscode.ProgressLocation.Notification,
            title: 'Loading Card Rulings',
        }, async (progress) => {
            if (cardName === undefined) {
                const line = vscode.window.activeTextEditor?.document.lineAt(vscode.window.activeTextEditor.selection.active.line).text;
                if (line === undefined) {
                    return;
                }

                let search = cardLineRegExp.exec(line);

                if (!search || search.length < 3) {
                    return new vscode.Hover('');
                }

                cardName = search[2].trim();
            }

            let rulings: Ruling[];
            let card: Card;
            try {
                card = await cardDB.getCard(cardName);
                rulings = await cardDB.getCardRulings(card);
            } catch (e) {
                vscode.window.showErrorMessage(`failed to get card: ${e}`);
                return;
            }

            
            const rulingsStr = rulings.map((ruling) => {
                return `<h2>${ruling.publishedAt?.toLocaleDateString()}</h2><p>${ruling.comment}</p>`;
            }).join('');
            
            const content = `<div style="padding-bottom: 20px;">
            <h1>Rulings for '${card.name}'</h1>
            ${rulingsStr}
            </div>`;

            const panel = vscode.window.createWebviewPanel(
                'Card Rulings',
                `Rulings for '${cardName}'`,
                vscode.ViewColumn.Two,
                {
                    enableScripts: false,
                    enableCommandUris: false,
                    enableFindWidget: false,
                },
            );

            panel.webview.html = content;
        });
    };
}