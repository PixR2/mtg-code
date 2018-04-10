'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as request from "web-request";
import * as imgDownload from 'image-download';
import * as fs from 'fs';
import * as resizeImg from 'resize-img';
import * as fuzzy from 'fuzzy';

let allCards = {};

let diagnosticCollection: vscode.DiagnosticCollection;

class CardHoverProvider implements vscode.HoverProvider {
    public async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken):
        Promise<vscode.Hover> {
        let regexp: RegExp = new RegExp('^\\d+ (.*)$');
        let search = regexp.exec(document.lineAt(position.line).text);
        if (!search || search.length !== 2) {
            return undefined;
        }

        let cardPath: string = `${__dirname}/card-cache/${encodeURIComponent(search[1])}.json`;
        if (!fs.existsSync(cardPath)) {
            console.log("sending request to scryfall to get card metadata");
            var newCard = await request.json<any>(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(search[1])}`);
            fs.writeFileSync(cardPath, JSON.stringify(newCard));
        }

        var rawCard = fs.readFileSync(cardPath);
        var card = JSON.parse(rawCard.toString());

        let imgPath: string = `${__dirname}/img-cache/${card.id}.png`;
        if (!fs.existsSync(imgPath)) {
            console.log(`Downloading image from ${card.image_uris.png}`);
            let originalBuf = await imgDownload(card.image_uris.png);
            fs.writeFile(imgPath, originalBuf, (err) => {
                if (err) {
                    console.log("failed to write image to cache");
                    return;
                }
            });
            let smallBuf = await resizeImg(originalBuf, { width: 149, height: 208 });
            fs.writeFile(imgPath + '.small', smallBuf, (err) => {
                if (err) {
                    console.log("failed to write small image to cache");
                    return;
                }
            });
        }


        return new vscode.Hover(new vscode.MarkdownString(`![image of ${card.name}](file://${imgPath + '.small'} "${card.oracle_text}")`));
    }
}

class CardCompletionItemProvider implements vscode.CompletionItemProvider {
    cardNames: string[];
    constructor() {
        this.cardNames = Object.getOwnPropertyNames(allCards);
    }

    public async provideCompletionItems(
        document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken):
        Promise<vscode.CompletionItem[]> {
        let regexp: RegExp = new RegExp('^(\\d+ )(.*)$');
        let line = document.lineAt(position.line);
        let lineStr = line.text;
        let search = regexp.exec(lineStr);
        if (!search || search.length !== 3) {
            return undefined;
        }

        console.log("search: " + search);
        let insertAt = lineStr.search(search[2]);
        console.log("insertAt: " + insertAt.toString());

        let matches = fuzzy.filter(search[2], this.cardNames);
        // matches.sort(function (a, b) {
        //     return a.score - b.score;
        // });
        return matches.map((res) => {
            let item: vscode.CompletionItem = new vscode.CompletionItem(res.string);
            item.range = new vscode.Range(new vscode.Position(position.line, insertAt), line.range.end);
            item.label = res.string;
            // item.range = new vscode.Range(new vscode.Position(position.line, insertAt), line.range.end);
            return item;
        });
    }

    // public resolveCompletionItem(item: vscode.CompletionItem, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CompletionItem> {
    // }
}

var nCardsMsg: vscode.Disposable;

function runDiagnostics(e: vscode.TextDocumentChangeEvent) {
    console.log("running diagnostics...");

    let diagnostics: vscode.Diagnostic[] = [];

    let regexp: RegExp = new RegExp('^(\\d+) (.*)$');
    const cardStats = {};
    for (let i = 0; i < e.document.lineCount; i++) {
        const lineStr: string = e.document.lineAt(i).text;
        const search = regexp.exec(lineStr);
        if (search) {
            let cardNameStart = lineStr.search(search[2]);
            let cardData = allCards[search[2]];
            if (!cardData) {
                diagnostics.push(new vscode.Diagnostic(new vscode.Range(new vscode.Position(i, cardNameStart), new vscode.Position(i, lineStr.length)), "unknown card '" + search[2] + "'"));
            }

            if (!cardStats[search[2]]) {
                cardStats[search[2]] = {
                    count: 0,
                    lines: [],
                    cardNameStart: cardNameStart,
                    cardData: cardData
                };
            }

            cardStats[search[2]].count += parseInt(search[1]);
            cardStats[search[2]].lines.push(i);
        }
    }

    let totalCardCount = 0;
    let cardNames = Object.getOwnPropertyNames(cardStats);
    for (let c = 0; c < cardNames.length; c++) {
        let cardName = cardNames[c];
        let card = cardStats[cardName];

        

        if (card.count > 4 && !card.cardData.types.includes("Land") && cardName !== "Relentless Rats") {
            for (let l = 0; l < card.lines.length; l++) {
                let line = card.lines[l];
                diagnostics.push(new vscode.Diagnostic(new vscode.Range(new vscode.Position(line, 0), new vscode.Position(line, card.cardNameStart-1)), "too many copies of '" + cardName + "'"));
            }
        }

        totalCardCount += card.count;
    }

    if (nCardsMsg) {
        nCardsMsg.dispose();
    }

    if (totalCardCount < 60) {
        nCardsMsg = vscode.window.setStatusBarMessage("#cards: " + totalCardCount.toString() + ", need at least 60");
    } else {
        nCardsMsg = vscode.window.setStatusBarMessage("#cards: " + totalCardCount.toString());
    }

    diagnosticCollection.set(e.document.uri, diagnostics);
}


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "mtg-code" is now active!');
    console.log(__dirname);

    fs.mkdir(`${__dirname}/img-cache`);
    fs.mkdir(`${__dirname}/card-cache`);

    var rawAllCards = fs.readFileSync(`${__dirname}/carddb/AllCards.json`);
    allCards = JSON.parse(rawAllCards.toString());

    context.subscriptions.push(vscode.languages.registerHoverProvider('mtg', new CardHoverProvider()));

    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz '\"".split("");
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider('mtg', new CardCompletionItemProvider(), ...alphabet));

    diagnosticCollection = vscode.languages.createDiagnosticCollection('mtg');
    context.subscriptions.push(diagnosticCollection);

    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(runDiagnostics));
}

// this method is called when your extension is deactivated
export function deactivate() {
}