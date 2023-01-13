import * as request from "web-request";
import * as fs from 'fs';
import * as path from 'path';
import * as fuzzy from 'fuzzy';

import { Card, toCard, toCardFromObject } from "./card";
import { RulingsResponse, Ruling, toRulingsResponse } from "./card_rulings";
import { assert } from "console";

export class CardDB {
    public isReady: Promise<any>;

    dbDirectoryPath: string = '.';
    maxDBAge: number = 7 * 24 * 60 * 60 * 1000;

    cardNames: string[] = [];
    artistNames: string[] = [];
    creatureTypes: string[] = [];
    planeswalkerTypes: string[] = [];
    landTypes: string[] = [];
    artifactTypes: string[] = [];
    enchantmentTypes: string[] = [];
    spellTypes: string[] = [];
    powers: string[] = [];
    toughnesses: string[] = [];
    loyalties: string[] = [];
    watermarks: string[] = [];
    keywordAbilities: string[] = [];
    keywordActions: string[] = [];
    abilityWords: string[] = [];
    setNames: string[] = [];

    cards: Map<string, Card | null> = new Map();
    advancedSearches: Map<string, string[]> = new Map();
    rulings: Map<string, Ruling[]> = new Map();

    constructor(dbDirectoryPath: string = '.', maxDBAge: number = 7 * 24 * 60 * 60 * 1000) {
        this.dbDirectoryPath = dbDirectoryPath;
        this.maxDBAge = maxDBAge;
        this.isReady = this.init();
    }

    // TODO: Add command to manually reload catalog data.
    async loadCatalog(scryfallURI: string, dbFilePath: string, maxDBAge: number): Promise<any> {
        if (!fs.existsSync(dbFilePath)) {
            let resp: any;
            try {
                resp = await request.json<any>(scryfallURI, { throwResponseError: true });
            } catch (requestException) {
                throw Error(`failed to load catalog data: no catalog db file at '${dbFilePath}' and request to scryfall failed with '${requestException}'`);
            }

            try {
                fs.writeFileSync(dbFilePath, JSON.stringify(resp));
            }
            catch (writeException) {
                console.log(`failed to write catalog db file: ${writeException}`);
            }

            return resp;
        }

        const fileStats = fs.statSync(dbFilePath);
        if (fileStats.mtime.getTime() < Date.now() - maxDBAge) {
            let resp: any;
            try {
                resp = await request.json<any>(scryfallURI, { throwResponseError: true });
            } catch (requestException) {
                try {
                    const respStr = fs.readFileSync(dbFilePath).toString();
                    return JSON.parse(respStr);
                }
                catch (readException) {
                    throw Error(`failed to load catalog data: failed to load catalog from '${dbFilePath}' (${readException}) and request to scryfall failed with '${requestException}'`);
                }
            }

            try {
                fs.writeFileSync(dbFilePath, JSON.stringify(resp));
            }
            catch (writeException) {
                console.log(`failed to write catalog db file: ${writeException}`);
            }

            return resp;
        }

        try {
            const respStr = fs.readFileSync(dbFilePath).toString();
            return JSON.parse(respStr);
        }
        catch (readException) {
            let resp: any;
            try {
                resp = await request.json<any>(scryfallURI, { throwResponseError: true });
            } catch (requestException) {
                throw Error(`failed to load catalog data: failed to load catalog from '${dbFilePath}' (${readException}) and request to scryfall failed with '${requestException}'`);
            }

            try {
                fs.writeFileSync(dbFilePath, JSON.stringify(resp));
            }
            catch (writeException) {
                console.log(`failed to write catalog db file: ${writeException}`);
            }

            return resp;
        }
    }

    async init(): Promise<any> {
        const cardNameResp: any = await this.loadCatalog('https://api.scryfall.com/catalog/card-names', path.join(this.dbDirectoryPath, 'card-names.json'), this.maxDBAge);
        this.cardNames = cardNameResp['data'];
        this.cardNames.forEach((cardName: string) => this.cards.set(cardName, null));

        const artistNamesResp: any = await this.loadCatalog('https://api.scryfall.com/catalog/artist-names', path.join(this.dbDirectoryPath, 'artist-names.json'), this.maxDBAge);
        this.artistNames = artistNamesResp['data'];

        const creatureTypesResp: any = await this.loadCatalog('https://api.scryfall.com/catalog/creature-types', path.join(this.dbDirectoryPath, 'creature-types.json'), this.maxDBAge);
        this.creatureTypes = creatureTypesResp['data'];

        const planeswalkerTypesResp: any = await this.loadCatalog('https://api.scryfall.com/catalog/planeswalker-types', path.join(this.dbDirectoryPath, 'planeswalker-types.json'), this.maxDBAge);
        this.planeswalkerTypes = planeswalkerTypesResp['data'];

        const landTypesResp: any = await this.loadCatalog('https://api.scryfall.com/catalog/land-types', path.join(this.dbDirectoryPath, 'land-types.json'), this.maxDBAge);
        this.landTypes = landTypesResp['data'];

        const artifactTypesResp: any = await this.loadCatalog('https://api.scryfall.com/catalog/artifact-types', path.join(this.dbDirectoryPath, 'artifact-types.json'), this.maxDBAge);
        this.artifactTypes = artifactTypesResp['data'];

        const enchantmentTypesResp: any = await this.loadCatalog('https://api.scryfall.com/catalog/enchantment-types', path.join(this.dbDirectoryPath, 'enchantment-types.json'), this.maxDBAge);
        this.enchantmentTypes = enchantmentTypesResp['data'];

        const spellTypesResp: any = await this.loadCatalog('https://api.scryfall.com/catalog/spell-types', path.join(this.dbDirectoryPath, 'spell-types.json'), this.maxDBAge);
        this.spellTypes = spellTypesResp['data'];

        const powersResp: any = await this.loadCatalog('https://api.scryfall.com/catalog/powers', path.join(this.dbDirectoryPath, 'powers.json'), this.maxDBAge);
        this.powers = powersResp['data'];

        const toughnessesResp: any = await this.loadCatalog('https://api.scryfall.com/catalog/toughnesses', path.join(this.dbDirectoryPath, 'toughnesses.json'), this.maxDBAge);
        this.toughnesses = toughnessesResp['data'];

        const loyaltiesResp: any = await this.loadCatalog('https://api.scryfall.com/catalog/loyalties', path.join(this.dbDirectoryPath, 'loyalties.json'), this.maxDBAge);
        this.loyalties = loyaltiesResp['data'];

        const watermarksResp: any = await this.loadCatalog('https://api.scryfall.com/catalog/watermarks', path.join(this.dbDirectoryPath, 'watermarks.json'), this.maxDBAge);
        this.watermarks = watermarksResp['data'];

        const keywordAbilitiesResp: any = await this.loadCatalog('https://api.scryfall.com/catalog/keyword-abilities', path.join(this.dbDirectoryPath, 'keyword-abilities.json'), this.maxDBAge);
        this.keywordAbilities = keywordAbilitiesResp['data'];

        const keywordActionsResp: any = await this.loadCatalog('https://api.scryfall.com/catalog/keyword-actions', path.join(this.dbDirectoryPath, 'keyword-actions.json'), this.maxDBAge);
        this.keywordActions = keywordActionsResp['data'];

        const abilityWordsResp: any = await this.loadCatalog('https://api.scryfall.com/catalog/ability-words', path.join(this.dbDirectoryPath, 'ability-words.json'), this.maxDBAge);
        this.abilityWords = abilityWordsResp['data'];

        const setsResp: any = await this.loadCatalog('https://api.scryfall.com/sets', path.join(this.dbDirectoryPath, 'sets.json'), this.maxDBAge);
        this.setNames = setsResp['data'].map((set: any) => set['name']);
    }

    async getCard(cardName: string): Promise<Card> {
        const card = this.cards.get(cardName);
        if (card === undefined) {
            throw Error('card not found');
        }

        if (card === null) {
            var cardJSONStr: string = '';
            try {
                const cardResp = await request.get('https://api.scryfall.com/cards/named', { qs: { exact: cardName }, throwResponseError: true });
                cardJSONStr = cardResp.content;
            }
            catch (e) {
                throw Error(`request to scryfall api failed: ${e}`);
            }

            var newCard: Card;
            try {
                newCard = toCard(cardJSONStr);
            }
            catch (e) {
                throw Error(`failed to parse card information from scryfall api: ${e}\n\nJSON String:\n\n${cardJSONStr}`);
            }

            this.cards.set(cardName, newCard);
            return newCard;
        }

        return card;
    }

    searchCardNamesFuzzy(searchStr: string): fuzzy.FilterResult<string>[] {
        return fuzzy.filter(searchStr, this.cardNames);
    }

    async searchCardsAdvanced(searchStr: string): Promise<string[]> {
        var cachedResult = this.advancedSearches.get(searchStr);
        if (cachedResult !== undefined) {
            return cachedResult;
        }

        var searchResp: any = {};
        try {
            var searchResp = await request.json<any>(`https://api.scryfall.com/cards/search`, {
                qs: {
                    q: searchStr
                },
                throwResponseError: true
            });
        }
        catch (e) {
            throw Error(`request to scryfall api failed: ${e}`);
        }

        if (searchResp['data'] === undefined) {
            throw Error(`request to scryfall api failed: no 'data' field in json`);
        }

        searchResp['data'].forEach((cardJSON: any) => {
            let card: Card;
            try {
                card = toCardFromObject(cardJSON);
                if (card.name === undefined) {
                    return;
                }
                this.cards.set(card.name, card);
            }
            catch (e) {
                throw Error(`failed to convert json object to card: ${e}\n\nJSON Object:\n\n${JSON.stringify(cardJSON)}`);
            }
        });

        let resultCardNames: string[] = searchResp['data'].map((cardJSON: any) => {
            if (cardJSON['name'] === undefined) {
                return '';
            }

            return cardJSON['name'];
        });

        this.advancedSearches.set(`${searchStr}`, resultCardNames);

        return resultCardNames;
    }

    getAllTypes(): string[] {
        let allTypes: string[] = [];
        allTypes = allTypes.concat(['Artifact', 'Conspiracy', 'Creature', 'Emblem', 'Enchantment', 'Hero', 'Instant', 'Land', 'Phenomenon', 'Plane', 'Planeswalker', 'Scheme', 'Sorcery', 'Tribal', 'Vanguard']);
        allTypes = allTypes.concat(['Basic', 'Elite', 'Legendary', 'Ongoing', 'Snow', 'Token', 'World']);
        allTypes = allTypes.concat(this.artifactTypes);
        allTypes = allTypes.concat(this.enchantmentTypes);
        allTypes = allTypes.concat(this.landTypes);
        allTypes = allTypes.concat(this.spellTypes);
        allTypes = allTypes.concat(this.planeswalkerTypes);
        allTypes = allTypes.concat(this.creatureTypes);
        allTypes = allTypes.concat(['Alara', 'Arkhos', 'Azgol', 'Belenon', 'Bola\'s Meditation Realm', 'Dominaria', 'Equilor', 'Ergamon', 'Fabacin', 'Innistrad', 'Iquatana', 'Ir', 'Kaldheim', 'Kamigawa', 'Karsus', 'Kephalai', 'Kinshala', 'Kolbahan', 'Kyneth', 'Lorwyn', 'Luvion', 'Mercadia', 'Mirrodin', 'Moag', 'Mongseng', 'Muraganda', 'New Phyrexia', 'Phyrexia', 'Pyrulea', 'Rabiah', 'Rath', 'Ravnica', 'Regatha', 'Segovia', 'Serra\'s Realm', 'Shadowmoor', 'Shandalar', 'Ulgrotha', 'Valla', 'Vryn', 'Wildfire', 'Xerex', 'Zendikar']);

        return allTypes;
    }

    getAllColorCombinations(): string[] {
        return [
            'C',
            'M',
            'W',
            'U',
            'B',
            'R',
            'G',
            'WU',
            'WB',
            'WR',
            'WG',
            'UB',
            'UR',
            'UG',
            'BR',
            'BG',
            'WUB',
            'WUR',
            'WUG',
            'WRG',
            'WBG',
            'WBR',
            'WUG',
            'WUR',
            'URG',
            'UBG',
            'UBR',
            'UBRG',
            'WBRG',
            'WURG',
            'WUBG',
            'WUBR',
            'WUBRG'
        ];
    }

    getAllPowers(): string[] {
        return this.powers;
    }

    getAllToughnesses(): string[] {
        return this.toughnesses;
    }

    getAllLoyalties(): string[] {
        return this.loyalties;
    }

    getAllRarities(): string[] {
        return [
            'common',
            'uncommon',
            'rare',
            'special',
            'mythic',
            'bonus'
        ];
    }

    getAllSetNames(): string[] {
        return this.setNames;
    }

    getAllCubes(): string[] {
        return [
            'arena',
            'grixis',
            'legacy',
            'chuck',
            'twisted',
            'protour',
            'uncommon',
            'april',
            'modern',
            'amaz',
            'tinkerer',
            'livethedream',
            'chromatic',
            'vintage'
        ];
    }

    getAllFormats(): string[] {
        return [
            'standard',
            'future',
            'historic',
            'gladiator',
            'pioneer',
            'modern',
            'legacy',
            'pauper',
            'vintage',
            'penny',
            'commander',
            'brawl',
            'historicbrawl',
            'paupercommander',
            'duel',
            'oldschool',
            'premodern'
        ];
    }

    getAllArtists() {
        return this.artistNames;
    }

    getAllWatermarks(): string[] {
        return this.watermarks;
    }

    getAllBorders(): string[] {
        return [
            'black',
            'white',
            'silver',
            'borderless'
        ];
    }

    getAlllFrames(): string[] {
        return [
            '1993',
            '1997',
            '2003',
            '2015',
            'future',
            'legendary',
            'colorshifted',
            'tombstone',
            'nyxtouched'
        ];
    }

    getAllGames(): string[] {
        return [
            'paper',
            'mtgo',
            'arena'
        ];
    }

    async getCardRulings(card: Card): Promise<Ruling[]> {
        if (card.id === undefined) {
            throw Error("card has no id");
        }

        if (card.rulingsURI === undefined) {
            return [];
        }

        const rulings = this.rulings.get(card.id);
        if (rulings !== undefined) {
            return rulings;
        }

        var rulingsRespJSONStr: string = '';
        try {
            const rulingsResp = await request.get(card.rulingsURI, { throwResponseError: true });
            rulingsRespJSONStr = rulingsResp.content;
        }
        catch (e) {
            throw Error(`request to scryfall api failed: ${e}`);
        }

        var parsedRulingsResp: RulingsResponse;
        try {
            parsedRulingsResp = toRulingsResponse(rulingsRespJSONStr);
        }
        catch (e) {
            throw Error(`failed to parse rulings information from scryfall api: ${e}\n\nJSON String:\n\n${rulingsRespJSONStr}`);
        }

        const newRulings = parsedRulingsResp.data === undefined ? [] : parsedRulingsResp.data;

        this.rulings.set(card.id, newRulings);

        return newRulings;
    }
}
