# Change Log

All notable changes to the "mtg-code" extension will be documented in this file.
## [Unreleased]

## [1.0.0] - 2022-02-28
### Added
- Syntax highlighting for deck lists, comments and search lines.
- Autocompletion for card names while typing in deck list.
- Card preview, including a small image and card prices, when hovering a card in the decklist.
- Card search using scryfall's advanced query API.
- Autocompletion for query terms and for some query parameter values in card search lines.
- Display card count when selecting multiple lines.

## [1.0.1] - 2022-04-22
### Fixed
- Fixed card parsing by adding the explorer format.

## [1.0.2] - 2022-04-22
### Fixed
- Fixed card parsing for cards which included a 'penny_rank' field.

## [1.1.0] - 2022-04-22
### Added
- Show mana curve of cards in selection in the status bar.
- Folding ranges for all blocks starting with a comment line (comment or search line).