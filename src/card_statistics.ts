import { TextEditorRevealType } from "vscode";
import { Card } from "./card";
import { CardDB } from "./card_db";
import { cardLineRegExp } from "./regular_expressions";

export class CardLine {
    constructor(quantity: number, card: Card) {
        this.quantity = quantity;
        this.card = card;
    }

    quantity: number;
    card: Card;
}

export async function parseCardLine(lineStr: string, cardDB: CardDB): Promise<CardLine> {
    const search = cardLineRegExp.exec(lineStr);
    if (!search || search.length !== 3) {
        throw Error(`'${lineStr}' is not a card line`);
    }

    let card: Card;
    try {
        card = await cardDB.getCard(search[2]);
    }
    catch (e) {
        throw Error(`failed to get card information: ${e}`);
    }

    let quantity: number;
    try {
        quantity = parseInt(search[1]);
    }
    catch (e) {
        throw Error(`invalid card quantity '${search[1]}'`);
    }

    return new CardLine(quantity, card);
}

export function getNumberOfCards(cardLines: CardLine[]): number {
    if (cardLines.length === 0) {
        return 0;
    }

    const numCards = cardLines
        .map((cardLine) => { return cardLine.quantity; })
        .reduce((sum, quantity) => { return sum + quantity; });
    return numCards;
}

export function getManaCostDistribution(cardLines: CardLine[]): number[] {
    if (cardLines.length === 0) {
        return [];
    }

    const includedCardLines = cardLines
        .filter((cardLine) => !cardLine.card.typeLine?.includes('Land'));

    if (includedCardLines.length === 0) {
        return [];
    }

    const maxManaCost = includedCardLines
        .map((cardLine) => { return cardLine.card.cmc ? cardLine.card.cmc : 0; })
        .reduce((maxCMC, cmc) => { return Math.max(maxCMC, cmc); });

    const cardDistribution = new Array<number>(maxManaCost + 1).fill(0);

    if (cardDistribution.length === 0) {
        return [];
    }

    for (const cardLine of includedCardLines) {
        if (cardLine.card.cmc === undefined) {
            continue;
        }

        cardDistribution[cardLine.card.cmc] += cardLine.quantity;
    }

    return cardDistribution;
}

export function renderManaCostDistributionToString(manaCostDistribution: number[]): string {
    if (manaCostDistribution.length === 0) {
        return '';
    }

    return manaCostDistribution.map(v => `${v}`).reduce((p, c) => `${p} | ${c}`);
}

export function computeMeanManaCost(manaCostDistribution: number[]): number {
    const numCards = manaCostDistribution.reduce((p, c) => p + c);
    return manaCostDistribution.map((v, i) => (v / numCards) * i).reduce((p, c) => p + c);
}