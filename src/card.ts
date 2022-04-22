// To parse this data:
//
//   import { Convert, Card } from "./file";
//
//   const card = Convert.toCard(json);
//
// These functions will throw an error if the JSON doesn't
// match the expected interface, even if the JSON is valid.

export interface Card {
    object?: string;
    id?: string;
    oracleID?: string;
    multiverseIDS?: number[];
    mtgoID?: number;
    mtgoFoilID?: number;
    tcgplayerID?: number;
    tcgplayerEtchedID?: number;
    cardmarketID?: number;
    arenaID?: number;
    name?: string;
    printedName?: string;
    lang?: string;
    releasedAt?: Date;
    uri?: string;
    scryfallURI?: string;
    layout?: string;
    highresImage?: boolean;
    imageStatus?: string;
    imageUris?: ImageUris;
    manaCost?: string;
    cmc?: number;
    typeLine?: string;
    printedTypeLine?: string;
    oracleText?: string;
    printedText?: string;
    power?: string;
    toughness?: string;
    loyalty?: string;
    colors?: string[];
    colorIndicator?: string;
    colorIdentity?: string[];
    keywords?: string[];
    producedMana?: string[];
    allParts?: AllPart[];
    cardFaces?: CardFace[];
    legalities?: Legalities;
    games?: string[];
    reserved?: boolean;
    foil?: boolean;
    nonfoil?: boolean;
    finishes?: string[];
    oversized?: boolean;
    promo?: boolean;
    reprint?: boolean;
    variation?: boolean;
    setID?: string;
    set?: string;
    setName?: string;
    setType?: string;
    setURI?: string;
    setSearchURI?: string;
    scryfallSetURI?: string;
    rulingsURI?: string;
    printsSearchURI?: string;
    collectorNumber?: string;
    digital?: boolean;
    rarity?: string;
    watermark?: string;
    flavorText?: string;
    flavorName?: string;
    cardBackID?: string;
    artist?: string;
    artistIDS?: string[];
    illustrationID?: string;
    borderColor?: string;
    frame?: string;
    frameEffects?: string[];
    securityStamp?: string;
    fullArt?: boolean;
    textless?: boolean;
    booster?: boolean;
    storySpotlight?: boolean;
    promoTypes?: string[];
    edhrecRank?: number;
    prices?: Prices;
    preview?: Preview;
    relatedUris?: RelatedUris;
    purchaseUris?: PurchaseUris;
}

export interface AllPart {
    object?: string;
    id?: string;
    component?: string;
    name?: string;
    typeLine?: string;
    uri?: string;
}

export interface CardFace {
    object?: string;
    name?: string;
    manaCost?: string;
    typeLine?: string;
    oracleText?: string;
    watermark?: string;
    colors?: string[];
    colorIndicator?: string[];
    power?: string;
    toughness?: string;
    flavorText?: string;
    flavorName?: string;
    artist?: string;
    artistID?: string;
    illustrationID?: string;
    imageUris?: ImageUris;
}

export interface ImageUris {
    small?: string;
    normal?: string;
    large?: string;
    png?: string;
    artCrop?: string;
    borderCrop?: string;
}

export interface Legalities {
    standard?: string;
    future?: string;
    historic?: string;
    gladiator?: string;
    pioneer?: string;
    explorer?: string;
    modern?: string;
    legacy?: string;
    pauper?: string;
    vintage?: string;
    penny?: string;
    commander?: string;
    brawl?: string;
    historicbrawl?: string;
    alchemy?: string;
    paupercommander?: string;
    duel?: string;
    oldschool?: string;
    premodern?: string;
}

export interface Preview {
    source?: string;
    sourceURI?: string;
    previewedAt?: Date;
}

export interface Prices {
    usd?: string;
    usdFoil?: string;
    usdEtched?: string;
    eur?: string;
    eurFoil?: string;
    eurEtched?: string;
    tix?: string;
}

export interface PurchaseUris {
    tcgplayer?: string;
    cardmarket?: string;
    cardhoarder?: string;
}

export interface RelatedUris {
    gatherer?: string;
    tcgplayerInfiniteArticles?: string;
    tcgplayerInfiniteDecks?: string;
    edhrec?: string;
    mtgtop8?: string;
}

// Converts JSON strings to/from your types
// and asserts the results of JSON.parse at runtime
export class Convert {
    public static toCardFromObject(json: object): Card {
        return cast(json, r("Card"));
    }

    public static toCard(json: string): Card {
        return cast(JSON.parse(json), r("Card"));
    }

    public static cardToJson(value: Card): string {
        return JSON.stringify(uncast(value, r("Card")), null, 2);
    }
}

function invalidValue(typ: any, val: any, key: any = ''): never {
    if (key) {
        throw Error(`Invalid value for key "${key}". Expected type ${JSON.stringify(typ)} but got ${JSON.stringify(val)}`);
    }
    throw Error(`Invalid value ${JSON.stringify(val)} for type ${JSON.stringify(typ)}`,);
}

function jsonToJSProps(typ: any): any {
    if (typ.jsonToJS === undefined) {
        const map: any = {};
        typ.props.forEach((p: any) => map[p.json] = { key: p.js, typ: p.typ });
        typ.jsonToJS = map;
    }
    return typ.jsonToJS;
}

function jsToJSONProps(typ: any): any {
    if (typ.jsToJSON === undefined) {
        const map: any = {};
        typ.props.forEach((p: any) => map[p.js] = { key: p.json, typ: p.typ });
        typ.jsToJSON = map;
    }
    return typ.jsToJSON;
}

function transform(val: any, typ: any, getProps: any, key: any = ''): any {
    function transformPrimitive(typ: string, val: any): any {
        if (typeof typ === typeof val) { return val; }
        return invalidValue(typ, val, key);
    }

    function transformUnion(typs: any[], val: any): any {
        // val must validate against one typ in typs
        const l = typs.length;
        for (let i = 0; i < l; i++) {
            const typ = typs[i];
            try {
                return transform(val, typ, getProps);
            } catch (_) { }
        }
        return invalidValue(typs, val);
    }

    function transformEnum(cases: string[], val: any): any {
        if (cases.indexOf(val) !== -1) { return val; }
        return invalidValue(cases, val);
    }

    function transformArray(typ: any, val: any): any {
        // val must be an array with no invalid elements
        if (!Array.isArray(val)) { return invalidValue("array", val); }
        return val.map(el => transform(el, typ, getProps));
    }

    function transformDate(val: any): any {
        if (val === null) {
            return null;
        }
        const d = new Date(val);
        if (isNaN(d.valueOf())) {
            return invalidValue("Date", val);
        }
        return d;
    }

    function transformObject(props: { [k: string]: any }, additional: any, val: any): any {
        if (val === null || typeof val !== "object" || Array.isArray(val)) {
            return invalidValue("object", val);
        }
        const result: any = {};
        Object.getOwnPropertyNames(props).forEach(key => {
            const prop = props[key];
            const v = Object.prototype.hasOwnProperty.call(val, key) ? val[key] : undefined;
            result[prop.key] = transform(v, prop.typ, getProps, prop.key);
        });
        Object.getOwnPropertyNames(val).forEach(key => {
            if (!Object.prototype.hasOwnProperty.call(props, key)) {
                result[key] = transform(val[key], additional, getProps, key);
            }
        });
        return result;
    }

    if (typ === "any") { return val; }
    if (typ === null) {
        if (val === null) { return val; }
        return invalidValue(typ, val);
    }
    if (typ === false) { return invalidValue(typ, val); }
    while (typeof typ === "object" && typ.ref !== undefined) {
        typ = typeMap[typ.ref];
    }
    if (Array.isArray(typ)) { return transformEnum(typ, val); }
    if (typeof typ === "object") {
        return typ.hasOwnProperty("unionMembers") ? transformUnion(typ.unionMembers, val)
            : typ.hasOwnProperty("arrayItems") ? transformArray(typ.arrayItems, val)
                : typ.hasOwnProperty("props") ? transformObject(getProps(typ), typ.additional, val)
                    : invalidValue(typ, val);
    }
    // Numbers can be parsed by Date but shouldn't be.
    if (typ === Date && typeof val !== "number") { return transformDate(val); }
    return transformPrimitive(typ, val);
}

function cast<T>(val: any, typ: any): T {
    return transform(val, typ, jsonToJSProps);
}

function uncast<T>(val: T, typ: any): any {
    return transform(val, typ, jsToJSONProps);
}

function a(typ: any) {
    return { arrayItems: typ };
}

function u(...typs: any[]) {
    return { unionMembers: typs };
}

function o(props: any[], additional: any) {
    return { props, additional };
}

function m(additional: any) {
    return { props: [], additional };
}

function r(name: string) {
    return { ref: name };
}

const typeMap: any = {
    "Card": o([
        { json: "object", js: "object", typ: u(undefined, "") },
        { json: "id", js: "id", typ: u(undefined, "") },
        { json: "oracle_id", js: "oracleID", typ: u(undefined, "") },
        { json: "multiverse_ids", js: "multiverseIDS", typ: u(undefined, a(0)) },
        { json: "mtgo_id", js: "mtgoID", typ: u(undefined, 0) },
        { json: "mtgo_foil_id", js: "mtgoFoilID", typ: u(undefined, 0) },
        { json: "tcgplayer_id", js: "tcgplayerID", typ: u(undefined, 0) },
        { json: "tcgplayer_etched_id", js: "tcgplayerEtchedID", typ: u(undefined, 0) },
        { json: "cardmarket_id", js: "cardmarketID", typ: u(undefined, 0) },
        { json: "arena_id", js: "arenaID", typ: u(undefined, 0) },
        { json: "name", js: "name", typ: u(undefined, "") },
        { json: "printed_name", js: "printedName", typ: u(undefined, "") },
        { json: "lang", js: "lang", typ: u(undefined, "") },
        { json: "released_at", js: "releasedAt", typ: u(undefined, Date) },
        { json: "uri", js: "uri", typ: u(undefined, "") },
        { json: "scryfall_uri", js: "scryfallURI", typ: u(undefined, "") },
        { json: "layout", js: "layout", typ: u(undefined, "") },
        { json: "highres_image", js: "highresImage", typ: u(undefined, true) },
        { json: "image_status", js: "imageStatus", typ: u(undefined, "") },
        { json: "image_uris", js: "imageUris", typ: u(undefined, r("ImageUris")) },
        { json: "mana_cost", js: "manaCost", typ: u(undefined, "") },
        { json: "cmc", js: "cmc", typ: u(undefined, 0) },
        { json: "type_line", js: "typeLine", typ: u(undefined, "") },
        { json: "printed_type_line", js: "printedTypeLine", typ: u(undefined, "") },
        { json: "oracle_text", js: "oracleText", typ: u(undefined, "") },
        { json: "printed_text", js: "printedText", typ: u(undefined, "") },
        { json: "power", js: "power", typ: u(undefined, "") },
        { json: "toughness", js: "toughness", typ: u(undefined, "") },
        { json: "loyalty", js: "loyalty", typ: u(undefined, "") },
        { json: "colors", js: "colors", typ: u(undefined, a("")) },
        { json: "color_indicator", js: "colorIndicator", typ: u(undefined, a("")) },
        { json: "color_identity", js: "colorIdentity", typ: u(undefined, a("")) },
        { json: "keywords", js: "keywords", typ: u(undefined, a("")) },
        { json: "produced_mana", js: "producedMana", typ: u(undefined, a("")) },
        { json: "all_parts", js: "allParts", typ: u(undefined, a(r("AllPart"))) },
        { json: "card_faces", js: "cardFaces", typ: u(undefined, a(r("CardFace"))) },
        { json: "legalities", js: "legalities", typ: u(undefined, r("Legalities")) },
        { json: "games", js: "games", typ: u(undefined, a("")) },
        { json: "reserved", js: "reserved", typ: u(undefined, true) },
        { json: "foil", js: "foil", typ: u(undefined, true) },
        { json: "nonfoil", js: "nonfoil", typ: u(undefined, true) },
        { json: "finishes", js: "finishes", typ: u(undefined, a("")) },
        { json: "oversized", js: "oversized", typ: u(undefined, true) },
        { json: "promo", js: "promo", typ: u(undefined, true) },
        { json: "reprint", js: "reprint", typ: u(undefined, true) },
        { json: "variation", js: "variation", typ: u(undefined, true) },
        { json: "set_id", js: "setID", typ: u(undefined, "") },
        { json: "set", js: "set", typ: u(undefined, "") },
        { json: "set_name", js: "setName", typ: u(undefined, "") },
        { json: "set_type", js: "setType", typ: u(undefined, "") },
        { json: "set_uri", js: "setURI", typ: u(undefined, "") },
        { json: "set_search_uri", js: "setSearchURI", typ: u(undefined, "") },
        { json: "scryfall_set_uri", js: "scryfallSetURI", typ: u(undefined, "") },
        { json: "rulings_uri", js: "rulingsURI", typ: u(undefined, "") },
        { json: "prints_search_uri", js: "printsSearchURI", typ: u(undefined, "") },
        { json: "collector_number", js: "collectorNumber", typ: u(undefined, "") },
        { json: "digital", js: "digital", typ: u(undefined, true) },
        { json: "rarity", js: "rarity", typ: u(undefined, "") },
        { json: "watermark", js: "watermark", typ: u(undefined, "") },
        { json: "flavor_text", js: "flavorText", typ: u(undefined, "") },
        { json: "flavor_name", js: "flavorName", typ: u(undefined, "") },
        { json: "card_back_id", js: "cardBackID", typ: u(undefined, "") },
        { json: "artist", js: "artist", typ: u(undefined, "") },
        { json: "artist_ids", js: "artistIDS", typ: u(undefined, a("")) },
        { json: "illustration_id", js: "illustrationID", typ: u(undefined, "") },
        { json: "border_color", js: "borderColor", typ: u(undefined, "") },
        { json: "frame", js: "frame", typ: u(undefined, "") },
        { json: "frame_effects", js: "frameEffects", typ: u(undefined, a("")) },
        { json: "security_stamp", js: "securityStamp", typ: u(undefined, "") },
        
        { json: "full_art", js: "fullArt", typ: u(undefined, true) },
        { json: "textless", js: "textless", typ: u(undefined, true) },
        { json: "booster", js: "booster", typ: u(undefined, true) },
        { json: "story_spotlight", js: "storySpotlight", typ: u(undefined, true) },
        { json: "promo_types", js: "promoTypes", typ: u(undefined, a("")) },
        { json: "edhrec_rank", js: "edhrecRank", typ: u(undefined, 0) },
        { json: "prices", js: "prices", typ: u(undefined, r("Prices")) },
        { json: "preview", js: "preview", typ: u(undefined, r("Preview")) },
        { json: "related_uris", js: "relatedUris", typ: u(undefined, r("RelatedUris")) },
        { json: "purchase_uris", js: "purchaseUris", typ: u(undefined, r("PurchaseUris")) },
    ], false),
    "AllPart": o([
        { json: "object", js: "object", typ: u(undefined, "") },
        { json: "id", js: "id", typ: u(undefined, "") },
        { json: "component", js: "component", typ: u(undefined, "") },
        { json: "name", js: "name", typ: u(undefined, "") },
        { json: "type_line", js: "typeLine", typ: u(undefined, "") },
        { json: "uri", js: "uri", typ: u(undefined, "") },
    ], false),
    "CardFace": o([
        { json: "object", js: "object", typ: u(undefined, "") },
        { json: "name", js: "name", typ: u(undefined, "") },
        { json: "mana_cost", js: "manaCost", typ: u(undefined, "") },
        { json: "type_line", js: "typeLine", typ: u(undefined, "") },
        { json: "oracle_text", js: "oracleText", typ: u(undefined, "") },
        { json: "watermark", js: "watermark", typ: u(undefined, "") },
        { json: "colors", js: "colors", typ: u(undefined, a("")) },
        { json: "power", js: "power", typ: u(undefined, "") },
        { json: "toughness", js: "toughness", typ: u(undefined, "") },
        { json: "flavor_text", js: "flavorText", typ: u(undefined, "") },
        { json: "flavor_name", js: "flavorName", typ: u(undefined, "") },
        { json: "loyalty", js: "loyalty", typ: u(undefined, "") },
        { json: "artist", js: "artist", typ: u(undefined, "") },
        { json: "artist_id", js: "artistID", typ: u(undefined, "") },
        { json: "illustration_id", js: "illustrationID", typ: u(undefined, "") },
        { json: "image_uris", js: "imageUris", typ: u(undefined, r("ImageUris")) },
        { json: "color_indicator", js: "colorIndicator", typ: u(undefined, a("")) },
    ], false),
    "ImageUris": o([
        { json: "small", js: "small", typ: u(undefined, "") },
        { json: "normal", js: "normal", typ: u(undefined, "") },
        { json: "large", js: "large", typ: u(undefined, "") },
        { json: "png", js: "png", typ: u(undefined, "") },
        { json: "art_crop", js: "artCrop", typ: u(undefined, "") },
        { json: "border_crop", js: "borderCrop", typ: u(undefined, "") },
    ], false),
    "Legalities": o([
        { json: "standard", js: "standard", typ: u(undefined, "") },
        { json: "future", js: "future", typ: u(undefined, "") },
        { json: "historic", js: "historic", typ: u(undefined, "") },
        { json: "gladiator", js: "gladiator", typ: u(undefined, "") },
        { json: "pioneer", js: "pioneer", typ: u(undefined, "") },
        { json: "explorer", js: "explorer", typ: u(undefined, "") },
        { json: "modern", js: "modern", typ: u(undefined, "") },
        { json: "legacy", js: "legacy", typ: u(undefined, "") },
        { json: "pauper", js: "pauper", typ: u(undefined, "") },
        { json: "vintage", js: "vintage", typ: u(undefined, "") },
        { json: "penny", js: "penny", typ: u(undefined, "") },
        { json: "commander", js: "commander", typ: u(undefined, "") },
        { json: "brawl", js: "brawl", typ: u(undefined, "") },
        { json: "historicbrawl", js: "historicbrawl", typ: u(undefined, "") },
        { json: "alchemy", js: "alchemy", typ: u(undefined, "") },
        { json: "paupercommander", js: "paupercommander", typ: u(undefined, "") },
        { json: "duel", js: "duel", typ: u(undefined, "") },
        { json: "oldschool", js: "oldschool", typ: u(undefined, "") },
        { json: "premodern", js: "premodern", typ: u(undefined, "") },
    ], false),
    "Preview": o([
        { json: "source", js: "source", typ: u(undefined, "") },
        { json: "source_uri", js: "sourceURI", typ: u(undefined, "") },
        { json: "previewed_at", js: "previewedAt", typ: u(undefined, Date) },
    ], false),
    "Prices": o([
        { json: "usd", js: "usd", typ: u(undefined, "", null) },
        { json: "usd_foil", js: "usdFoil", typ: u(undefined, "", null) },
        { json: "usd_etched", js: "usdEtched", typ: u(undefined, "", null) },
        { json: "eur", js: "eur", typ: u(undefined, "", null) },
        { json: "eur_foil", js: "eurFoil", typ: u(undefined, "", null) },
        { json: "eur_etched", js: "eurEtched", typ: u(undefined, "", null) },
        { json: "tix", js: "tix", typ: u(undefined, "", null) },
    ], false),
    "PurchaseUris": o([
        { json: "tcgplayer", js: "tcgplayer", typ: u(undefined, "") },
        { json: "cardmarket", js: "cardmarket", typ: u(undefined, "") },
        { json: "cardhoarder", js: "cardhoarder", typ: u(undefined, "") },
    ], false),
    "RelatedUris": o([
        { json: "gatherer", js: "gatherer", typ: u(undefined, "") },
        { json: "tcgplayer_infinite_articles", js: "tcgplayerInfiniteArticles", typ: u(undefined, "") },
        { json: "tcgplayer_infinite_decks", js: "tcgplayerInfiniteDecks", typ: u(undefined, "") },
        { json: "edhrec", js: "edhrec", typ: u(undefined, "") },
        { json: "mtgtop8", js: "mtgtop8", typ: u(undefined, "") },
    ], false),
};
