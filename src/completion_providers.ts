import * as vscode from 'vscode';
import { CardDB } from './card_db';
import * as fuzzy from 'fuzzy';
import { log } from 'console';

export class CardCompletionItemProvider implements vscode.CompletionItemProvider {
    cardDB: CardDB;
    lineRegexp: RegExp = new RegExp('^(\\d+ )(.*)$');
    constructor(cardDB: CardDB) {
        this.cardDB = cardDB;
    }

    public async provideCompletionItems(
        document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken):
        Promise<vscode.CompletionItem[]> {
        let line = document.lineAt(position.line);
        let lineStr = line.text;
        let search = this.lineRegexp.exec(lineStr);
        if (!search || search.length !== 3) {
            return [];
        }

        let insertAt = lineStr.search(search[2]);

        let matches = this.cardDB.searchCardNamesFuzzy(search[2]);
        return matches.map((res) => {
            let item: vscode.CompletionItem = new vscode.CompletionItem(res.string);
            item.range = new vscode.Range(new vscode.Position(position.line, insertAt), line.range.end);
            item.label = res.string;
            return item;
        });
    }
}

export class SearchCompletionItemProvider implements vscode.CompletionItemProvider {
    searchParameters: string[];
    searchParameterVocabularies: Map<string, string[]>;

    lineRegexp: RegExp = /^(\/\/ *Search:)([^;]*).*$/;
    searchTermRegexp: RegExp = /(-{0,1})([^; \n()]+?)(:|=|>=|<=|<|>)((?:\"[^\"]*\")|(?:\/[^\/]*\/)|(?:'[^']*')|(?:[^; \n\"'\/()]*))/g;

    constructor(searchParameters: string[], searchParameterVocabularies: Map<string, string[]>) {
        this.searchParameters = searchParameters;
        this.searchParameterVocabularies = searchParameterVocabularies;
    }

    public async provideCompletionItems(
        document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken):
        Promise<vscode.CompletionItem[]> {

        let lineStr = document.lineAt(position.line).text;
        let search = this.lineRegexp.exec(lineStr);

        if (!search || search.length !== 3) {
            return [];
        }

        let queryStart = search[1].length;
        let queryEnd = queryStart + search[2].length;
        if (position.character < queryStart || position.character > queryEnd) {
            return [];
        }

        let searchTerms = search[2].matchAll(this.searchTermRegexp);
        for (const searchTerm of searchTerms) {
            if (!searchTerm.index) {
                continue;
            }

            let sti = searchTerm.index;
            if (position.character < queryStart + sti || position.character > queryStart + sti + searchTerm[0].length) {
                continue;
            }

            if (position.character < queryStart + sti + searchTerm[1].length + searchTerm[2].length + searchTerm[3].length) {
                let possibleParameters = fuzzy.filter(searchTerm[2], this.searchParameters);
                let insertAt = queryStart + sti + searchTerm[1].length;
                return possibleParameters.map((param) => {
                    let item: vscode.CompletionItem = new vscode.CompletionItem(param.string);
                    item.range = new vscode.Range(new vscode.Position(position.line, insertAt), new vscode.Position(position.line, queryStart + sti + searchTerm[1].length));
                    item.label = param.string;
                    return item;
                });
            }

            const paramName = searchTerm[2];
            const paramVocabulary = this.searchParameterVocabularies.get(paramName);
            if (!paramVocabulary) {
                return [];
            }

            const possibleParameterValues = fuzzy.filter(searchTerm[4], paramVocabulary);
            
            const insertAt = queryStart + sti + searchTerm[1].length + searchTerm[2].length + searchTerm[3].length;
            return possibleParameterValues.map((paramValue) => {
                let finalParameterValue = paramValue.string.includes(' ') ? `"${paramValue.string}"` : paramValue.string;
                let item: vscode.CompletionItem = new vscode.CompletionItem(finalParameterValue);
                item.range = new vscode.Range(new vscode.Position(position.line, insertAt), new vscode.Position(position.line, queryStart + sti + searchTerm[0].length));
                item.label = finalParameterValue;
                return item;
            });
        }

        let wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            return this.searchParameters.map((param) => {
                let item: vscode.CompletionItem = new vscode.CompletionItem(param);
                item.range = new vscode.Range(position, position);
                item.label = param;
                return item;
            });
        }

        let word = document.getText(wordRange);
        let possibleParameters = fuzzy.filter(word, this.searchParameters);
        return possibleParameters.map((param) => {
            let item: vscode.CompletionItem = new vscode.CompletionItem(param.string);
            item.range = wordRange;
            item.label = param.string;
            return item;
        });
    }
}