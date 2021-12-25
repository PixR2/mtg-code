// TODO: Allow parenthesis, negation (-) and OR in search lines. (Syntax and HoverProvider)

'use strict';
import * as fs from 'fs';
import { stringify } from 'querystring';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { CardDB } from './card_db';
import { CardLine, getNumberOfCards, parseCardLine } from './card_statistics';
import { CardSearchLensProvider } from './code_lens_providers';
import { searchCards } from './commands';
import { CardCompletionItemProvider, SearchCompletionItemProvider } from './completion_providers';
import { setCardDecorations } from './decorators';
import { CardHoverProvider, CardSearchHoverProvider } from './hover_providers';

const languageID: string = 'mtg';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	if (!fs.existsSync('./card_db')) {
		fs.mkdirSync('./card_db');
	}
	var cardDB: CardDB = new CardDB('./card_db');
	await cardDB.isReady;

	context.subscriptions.push(vscode.commands.registerCommand('mtg-code.search-cards', searchCards(cardDB)));

	const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz '\":/<>=".split("");

	context.subscriptions.push(vscode.languages.registerCompletionItemProvider(languageID, new CardCompletionItemProvider(cardDB), ...alphabet));
	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider(
			languageID,
			new SearchCompletionItemProvider(
				['c', 'color', 'id', 'identity', 'commander', 't', 'type', 'o', 'oracle', 'm', 'mana', 'mv', 'manavalue', 'is', 'devotion', 'produces', 'pow', 'power', 'tou', 'toughness', 'pt', 'powtou', 'loyalty', 'loy', 'r', 'rarity', 'new', 'in', 's', 'set', 'e', 'edition', 'cn', 'number', 'b', 'block', 'st', 'cube', 'f', 'format', 'banned', 'restricted', 'usd', 'eur', 'tix', 'cheapest', 'a', 'artist', 'artists', 'ft', 'flavor', 'wm', 'watermark', 'has', 'illustrations', 'border', 'frame', 'game', 'year', 'art', 'atag', 'arttag', 'function', 'otag', 'oracletag', 'not', 'prints', 'paperprints', 'papersets', 'sets', 'lang', 'language', 'order', 'direction'],
				new Map([
					['type', cardDB.getAllTypes()],
					['color', cardDB.getAllColorCombinations()],
					['identity', cardDB.getAllColorCombinations()],
					['commander', cardDB.getAllColorCombinations()],
					['power', cardDB.getAllPowers()],
					['toughness', cardDB.getAllToughnesses()],
					['loyalty', cardDB.getAllLoyalties()],
					['rarity', cardDB.getAllRarities()],
					['set', cardDB.getAllSetNames()],
					['cube', cardDB.getAllCubes()],
					['format', cardDB.getAllFormats()],
					['artist', cardDB.getAllArtists()],
					['watermark', cardDB.getAllWatermarks()],
					['border', cardDB.getAllBorders()],
					['frame', cardDB.getAlllFrames()],
					['game', cardDB.getAllGames()],
					['order', ['name', 'set', 'released', 'rarity', 'color', 'usd', 'tix', 'eur', 'cmc', 'power', 'toughness', 'edhrec', 'artist']],
					['direction', ['asc', 'dsc']]
				])
			),
			...alphabet
		)
	);

	context.subscriptions.push(vscode.languages.registerHoverProvider(languageID, new CardHoverProvider(cardDB)));
	// context.subscriptions.push(vscode.languages.registerHoverProvider(languageID, new CardSearchHoverProvider(cardDB)));

	context.subscriptions.push(vscode.languages.registerCodeLensProvider(languageID, new CardSearchLensProvider()));

	vscode.workspace.onDidChangeTextDocument(async (e) => {
		if (e.document.languageId !== languageID) {
			return;
		}

		const editors = vscode.window.visibleTextEditors.filter((editor) => editor.document === e.document);
		for (const editor of editors) {
			await setCardDecorations(editor, cardDB);
		}
	});

	// TODO: On selection change compute stats: num. cards, mana distribution, type distribution.
	let statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
	vscode.window.onDidChangeTextEditorSelection(async (e) => {
		let cardLines: CardLine[] = [];
		for (const selection of e.selections) {
			for (let l = selection.start.line; l <= selection.end.line; l++) {
				const lineStr = e.textEditor.document.lineAt(l).text;
				try {
					const cardLine = await parseCardLine(lineStr, cardDB);
					cardLines.push(cardLine);
				}
				catch (e) {
					continue;
				}
			}
		}

		if (cardLines.length < 2) {
			statusBarItem.hide();
			return;
		}

		const numCardsInSelection = getNumberOfCards(cardLines);
		statusBarItem.text = `${numCardsInSelection} cards`;

		if (numCardsInSelection > 0) {
			statusBarItem.show();
		} else {
			statusBarItem.hide();
		}

	});

	vscode.window.onDidChangeActiveTextEditor((e) => {
		if (!e) {
			return;
		}

		setCardDecorations(e, cardDB);
	});

	const editors = vscode.window.visibleTextEditors.filter((editor) => editor.document.languageId === languageID);
	for (const editor of editors) {
		await setCardDecorations(editor, cardDB);
	}
}

// this method is called when your extension is deactivated
export function deactivate() {
}