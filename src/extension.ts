'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as request from "web-request";
import * as imgDownload from 'image-download';
import * as fs from 'fs';
import * as resizeImg from 'resize-img';
import * as fuzzy from 'fuzzy';

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
        var rawAllCards = fs.readFileSync(`${__dirname}/carddb/AllCards.json`);
        var allCards = JSON.parse(rawAllCards.toString());

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

function countAllCards(e: vscode.TextDocumentChangeEvent) {
    let regexp: RegExp = new RegExp('^(\\d+) .*$');
    const cardCounts: number[] = [];
    for (let i = 0; i < e.document.lineCount; i++) {
        const lineStr: string = e.document.lineAt(i).text;
        const search = regexp.exec(lineStr);
        if (search) {
            cardCounts.push(parseInt(search[1]));
        }
    }

    let totalCards = 0;
    cardCounts.forEach(c => totalCards += c);

    if (nCardsMsg) {
        nCardsMsg.dispose();
    }

    nCardsMsg = vscode.window.setStatusBarMessage("#cards: " + totalCards.toString());
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

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    context.subscriptions.push(vscode.commands.registerCommand('extension.sayHello', () => {
        // The code you place here will be executed every time your command is executed

        // Display a message box to the user
        vscode.window.showInformationMessage('Hello World!');
    }));

    context.subscriptions.push(vscode.languages.registerHoverProvider('mtg', new CardHoverProvider()));

    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz '\"".split("");
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider('mtg', new CardCompletionItemProvider(), ...alphabet));

    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(countAllCards));
}

// this method is called when your extension is deactivated
export function deactivate() {
}