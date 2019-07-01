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
let searchCache = [];
let cardPrices = {};

function nextSearchID() {
    return searchCache.length;
}

let diagnosticCollection: vscode.DiagnosticCollection;

let prefetchCardImage = async (card): Promise<string> => {
    let imgPath: string = `${__dirname}/img-cache/${card.id}.png`;
    if (!fs.existsSync(imgPath)) {
        
        let originalBuf = await imgDownload(card.image_uris.png);
        fs.writeFile(imgPath, originalBuf, (err) => {
            if (err) {
                
                return "";
            }
        });
        let smallBuf = await resizeImg(originalBuf, { width: 149, height: 208 });
        fs.writeFile(imgPath + '.small', smallBuf, (err) => {
            if (err) {
                
                return "";
            }
        });
    }

    return imgPath;
}

class CardHoverProvider implements vscode.HoverProvider {
    public async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken):
        Promise<vscode.Hover> {
        let regexp: RegExp = new RegExp('(\\d+) ((?:[^ {(]+ {0,1})+)(\\(.+\/.+\\))* *((?:\\{(?:\\d+|W|U|B|G|R)\\})*)');
        let search = regexp.exec(document.lineAt(position.line).text);
        if (!search || search.length < 3) {
            return undefined;
        }

        let cardName = search[2].trim();

        let cardPath: string = `${__dirname}/card-cache/${encodeURIComponent(cardName)}.json`;
        if (!fs.existsSync(cardPath)) {
            
            var newCard = await request.json<any>(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`);
            fs.writeFileSync(cardPath, JSON.stringify(newCard));
        }

        var stats = fs.statSync(cardPath);
        var mtime = stats.mtime;
        if(((new Date()) - stats.mtime) > 86400000) {
            var newCard = await request.json<any>(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`);
            fs.writeFileSync(cardPath, JSON.stringify(newCard));
        }

        var rawCard = fs.readFileSync(cardPath);
        var card = JSON.parse(rawCard.toString());

        const imgPath = await prefetchCardImage(card);
        if (imgPath === "") {
            return new vscode.Hover("failed to load card image");
        }

        return new vscode.Hover(new vscode.MarkdownString(`![image of ${card.name}](file://${imgPath + '.small'} "${card.oracle_text}")\n\nPrice: ${card.prices.usd}$ / ${card.prices.eur}€`));
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

        let insertAt = lineStr.search(search[2]);

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


function runDiagnostics(doc: vscode.TextDocument) {
    console.log('runDiagnostics')

    let diagnostics: vscode.Diagnostic[] = [];

    let regexp: RegExp = new RegExp('(\\d+) ((?:[^ {(]+ {0,1})+)(\\(.+\/.+\\))* *((?:\\{(?:\\d+|W|U|B|G|R)\\})*)');
    const cardStats = {};
    for (let i = 0; i < doc.lineCount; i++) {
        const lineStr: string = doc.lineAt(i).text;
        const search = regexp.exec(lineStr);
        if (search) {
            const cardName = search[2].trim();
            
            let cardNameStart = lineStr.search(cardName);
            let cardData = allCards[cardName];
            if (!cardData) {
                try{
                    diagnostics.push(new vscode.Diagnostic(new vscode.Range(new vscode.Position(i, cardNameStart), new vscode.Position(i, lineStr.length)), "unknown card '" + search[2] + "'"));
                } catch(e) {
                    console.log("unknown card: ",  cardName);
                }
            } 
            // else {
            //     if(cardPrices[cardName] == null) {
            //         cardPrices[cardName] = {}
            //     }
            // }

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
                diagnostics.push(new vscode.Diagnostic(new vscode.Range(new vscode.Position(line, 0), new vscode.Position(line, card.cardNameStart - 1)), "too many copies of '" + cardName + "'"));
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

    diagnosticCollection.set(doc.uri, diagnostics);

    // let priceRequests = []
    // cardNames = Object.getOwnPropertyNames(cardPrices);
    // for (let c = 0; c < cardNames.length; c++) {
    //     let cardName = cardNames[c];
    //     let price = cardPrices[cardName];

    //     if(price.prices == null) {
    //         priceRequests.push({name: cardName});
    //     }
    // }

    // while(priceRequests.length > 0) {
    //     const numCards = Math.min(priceRequests.length, 75);
    //     request.post('https://api.scryfall.com/cards/collection', {json: true}, {identifiers: priceRequests.slice(0, numCards)})
    //         .then(resp => {
    //             for(let c = 0; c < resp.content.data.length; c++) {
    //                 const card = resp.content.data[c];
    //                 cardPrices[card.name].prices = card.prices;
    //             }
    //         })
    //         .catch(err => console.log(err));

    //         priceRequests.splice(0, numCards)
    // }
}

function parseDecklist(doc: vscode.TextDocument) {
    runDiagnostics(doc);
}

async function performSearchQueries(e: vscode.TextEditor) {
    // Search: f:modern o:/deathtouch/ c:B; [1]
    let regexp: RegExp = new RegExp(`^\\/\\/ *Search: *(.*) *; *(?:\\[(\\d+)\\])? *$`);
    for (let i = 0; i < e.document.lineCount; i++) {
        const lineStr: string = e.document.lineAt(i).text;
        const search = regexp.exec(lineStr);

        if (search == undefined) {
            continue;
        }

        if(search[2] == null) {
            continue;
        }

        const id = parseInt(search[2]);
        if(searchCache[id] == null) {
            var resp = await request.json<any>(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(search[1])}`);

            searchCache[id] = {
                query: search[1],
                result: resp.data,
            }

            continue;
        }

        if(searchCache[id].query !== search[1]) {
            var resp = await request.json<any>(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(search[1])}`);
            
            searchCache[id] = {
                query: search[1],
                result: resp.data,
            }
            continue;
        }
    }
}

async function insertSearchResults(e: vscode.TextEditor) {
    let regexp: RegExp = new RegExp(`^ *\\[(\\d+)\\] *$`);

    let inserts = [];
    for (let i = 0; i < e.document.lineCount; i++) {
        const lineStr: string = e.document.lineAt(i).text;
        const search = regexp.exec(lineStr);

        if(search == null) {
            continue;
        }

        const id = parseInt(search[1]);
        if(id == null) {
            continue;
        }

        const cachedValue = searchCache[id];
        if(cachedValue == null) {
            continue;
        }

        let insertStr = "";
        for(var j = 0; j < cachedValue.result.length; j++) {
            insertStr += `1 ${cachedValue.result[j].name}\n`;
        }

        inserts.push({
            query: cachedValue.query,
            line: i,
            str: insertStr,
        })

        console.log("printing search result: ", cachedValue.result);

        await e.edit((eb: vscode.TextEditorEdit) => {
            for (let e = 0; e < inserts.length; e++) {
                eb.delete(
                    new vscode.Range(
                        new vscode.Position(inserts[e].line, 0),
                        new vscode.Position(inserts[e].line, inserts[e].str.length)));
                
                eb.insert(new vscode.Position(inserts[e].line, 0), `// Cards matching '${inserts[e].query}':\n${inserts[e].str}`);
            }
        });
    }
}

async function addManaCosts(e: vscode.TextEditor) {
    let edits = [];

    let regexp: RegExp = new RegExp('^(\\d+) (.*)$');
    for (let i = 0; i < e.document.lineCount; i++) {
        const lineStr: string = e.document.lineAt(i).text;
        const search = regexp.exec(lineStr);
        const card = search ? allCards[search[2]] : undefined;
        if (!card) {
            continue;
        }

        edits.push({ "pos": new vscode.Position(i, lineStr.length), "card": card });
    }

    await e.edit((eb: vscode.TextEditorEdit) => {
        for (let e = 0; e < edits.length; e++) {
            const edit = edits[e];
            let insertStr = "";
            if (edit.card.types.includes("Creature")) {
                insertStr += " (" + edit.card.power + "/" + edit.card.toughness + ")";
            }
            if (edit.card.manaCost) {
                insertStr += " " + edit.card.manaCost;
            }
            eb.insert(edit.pos, insertStr);
        }
    });

    addDecorations(e);
}

let prevManaDecos = {};
function addDecorations(e: vscode.TextEditor) {
    
    if (prevManaDecos[e.document.uri.toString()]) {
        const manaKeys = Object.getOwnPropertyNames(prevManaDecos[e.document.uri.toString()]);
        for (let i = 0; i < manaKeys.length; i++) {
            const k = manaKeys[i];
            prevManaDecos[e.document.uri.toString()][k].deco.dispose();
        }
    }

    let manaDecos = {
        "{W}": {
            "deco": vscode.window.createTextEditorDecorationType({
                color: 'rgba(0, 0, 0, 1)',
                backgroundColor: 'rgba(248, 246, 218, 1)',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderRadius: '2px',
                borderColor: 'rgba(0, 0, 0, 1)'
            }),
            "ranges": []
        },
        "{U}": {
            "deco": vscode.window.createTextEditorDecorationType({
                color: 'rgba(0, 0, 0, 1)',
                backgroundColor: 'rgba(194, 216, 232, 1)',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderRadius: '2px',
                borderColor: 'rgba(0, 0, 0, 1)'
            }),
            "ranges": []
        },
        "{B}": {
            "deco": vscode.window.createTextEditorDecorationType({
                color: 'rgba(0, 0, 0, 1)',
                backgroundColor: 'rgba(186, 177, 171, 1)',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderRadius: '2px',
                borderColor: 'rgba(0, 0, 0, 1)'
            }),
            "ranges": []
        },
        "{G}": {
            "deco": vscode.window.createTextEditorDecorationType({
                color: 'rgba(0, 0, 0, 1)',
                backgroundColor: 'rgba(164, 191, 150, 1)',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderRadius: '2px',
                borderColor: 'rgba(0, 0, 0, 1)'
            }),
            "ranges": []
        },
        "{R}": {
            "deco": vscode.window.createTextEditorDecorationType({
                color: 'rgba(0, 0, 0, 1)',
                backgroundColor: 'rgba(227, 153, 122, 1)',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderRadius: '2px',
                borderColor: 'rgba(0, 0, 0, 1)'
            }),
            "ranges": []
        },
        "{d}": {
            "deco": vscode.window.createTextEditorDecorationType({
                color: 'rgba(0, 0, 0, 1)',
                backgroundColor: 'rgba(202, 197, 192, 1)',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderRadius: '2px',
                borderColor: 'rgba(0, 0, 0, 1)'
            }),
            "ranges": []
        }
    };

    prevManaDecos[e.document.uri.toString()] = manaDecos;

    let regexp: RegExp = /(\{(?:\d+|W|U|B|G|R)\})/g;
    for (let i = 0; i < e.document.lineCount; i++) {
        const lineStr: string = e.document.lineAt(i).text;
        // 
        // 
        let match = undefined;
        let lastIndex = 0;
        while ((match = regexp.exec(lineStr))) {
            const symbolStart = lineStr.indexOf(match[1], lastIndex);
            lastIndex = regexp.lastIndex;
            if (match[1] === "{W}" || match[1] === "{U}" || match[1] === "{B}" || match[1] === "{G}" || match[1] === "{R}") {
                manaDecos[match[1]].ranges.push(new vscode.Range(new vscode.Position(i, symbolStart), new vscode.Position(i, symbolStart + match[1].length)));
            } else {
                manaDecos["{d}"].ranges.push(new vscode.Range(new vscode.Position(i, symbolStart), new vscode.Position(i, symbolStart + match[1].length)));
            }
        }
    }

    

    const manaKeys = Object.getOwnPropertyNames(prevManaDecos[e.document.uri.toString()]);
    for (let i = 0; i < manaKeys.length; i++) {
        const k = manaKeys[i];
        e.setDecorations(prevManaDecos[e.document.uri.toString()][k].deco, prevManaDecos[e.document.uri.toString()][k].ranges);
    }
}

async function updateAllCardsDB() {
    const allCardsJSON = await request.json<any>('https://mtgjson.com/json/AllCards.json');
    fs.writeFileSync(`${__dirname}/carddb/AllCards.json`, JSON.stringify(allCardsJSON));
    return allCardsJSON
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    
    

    fs.mkdir(`${__dirname}/img-cache`, e => {});
    fs.mkdir(`${__dirname}/card-cache`, e => {});
    fs.mkdir(`${__dirname}/searches`, e => {});
    fs.mkdir(`${__dirname}/carddb`, e => {});

    try {
        var rawAllCards = fs.readFileSync(`${__dirname}/carddb/AllCards.json`);
        allCards = JSON.parse(rawAllCards.toString());
    }
    catch(e) {
        allCards = await updateAllCardsDB();
    }
    

    context.subscriptions.push(vscode.languages.registerHoverProvider('mtg', new CardHoverProvider()));

    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz '\"".split("");
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider('mtg', new CardCompletionItemProvider(), ...alphabet));

    diagnosticCollection = vscode.languages.createDiagnosticCollection('mtg');
    context.subscriptions.push(diagnosticCollection);

    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent) => {
        
        parseDecklist(e.document);
        if (e.document.uri === vscode.window.activeTextEditor.document.uri) {
            addManaCosts(vscode.window.activeTextEditor);
            addDecorations(vscode.window.activeTextEditor);
            performSearchQueries(vscode.window.activeTextEditor);
            insertSearchResults(vscode.window.activeTextEditor)
        }
    }));

    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor((e: vscode.TextEditor) => {
        if(e == undefined || e.document == undefined) {
            return
        }
        addManaCosts(e);
        addDecorations(e);
        performSearchQueries(e);
        insertSearchResults(e);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('extension.searchCards', async () => {
        let query = await vscode.window.showInputBox({
            ignoreFocusOut: true,
            placeHolder: "Enter search query...",
            prompt: "Accepts scryfall.com search queries."
        });

        var resp = await request.json<any>(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}`);
        const cards = resp.data;

        const searchDir = `${__dirname}/searches`;
        if (!fs.existsSync(searchDir)) {
            fs.mkdirSync(searchDir);
        }
        const mdPath = `${searchDir}/${encodeURIComponent(query)}.html`;
        let content = `<html><body><h1>${query}</h1>`;
        for (let c = 0; c < cards.length; c++) {
            let card = cards[c];
            let imgPath: string = `${__dirname}/img-cache/${card.id}.png`;
            
            if (fs.existsSync(imgPath)) {
                
                content += `<img src="${imgPath}" alt="${card.name}" style="width: 229px;"/>`;
            } else {

                prefetchCardImage(card);
                content += `<img src="${card.image_uris.normal}" alt="${card.name}" style="width: 229px;"/>`;
            }
            // content += `![${card.name}](${imgPath} =372x)\n`;
            // content += `\n1 ${card.name} ${card.type_line.indexOf("Creature") !== -1 ? `(${card.power}/${card.toughness}) ` : ``}${card.mana_cost}`;
        }

        content += "</body></html>";

        fs.writeFileSync(mdPath, content, 'utf8');
        let res_doc = await vscode.workspace.openTextDocument(mdPath);
        await vscode.commands.executeCommand('vscode.previewHtml', res_doc.uri, vscode.ViewColumn.Two, `card search: ${query}`);
    }));
}

// this method is called when your extension is deactivated
export function deactivate() {
}