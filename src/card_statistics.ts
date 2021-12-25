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