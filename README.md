# Ember Court — a duel of suits and embers

[![make.fun](https://make.fun/badge/best-card-game-20261122-1826.svg)](https://make.fun/c/best-card-game-20261122-1826)
[![rank](https://make.fun/badge/best-card-game-20261122-1826/xeraaGH/best-card-game-20261122-1826/rank.svg)](https://make.fun/c/best-card-game-20261122-1826)
[![reward](https://make.fun/badge/best-card-game-20261122-1826/xeraaGH/best-card-game-20261122-1826/reward.svg)](https://make.fun/c/best-card-game-20261122-1826)

An original card battler for the make.fun **best-card-game-20261122-1826** bounty.
You challenge the Warden of the Ember Court to a duel of cards: play creatures,
cast spells, and chain two cards of one suit for a combo. Reduce the Warden to
0 life before it does the same to you.

## How to play

Serve `game/` with any static server and open `index.html` in desktop Chrome.
No network, no build step — every file the game loads lives under `game/`.

- **Goal:** reduce the Warden from 20 life to 0.
- **Mana:** you gain 1 mana crystal each turn (up to 10); a card costs its blue gem.
- **Creatures:** click a card to play it onto your side of the table. A creature
  cannot attack the turn it is played (it shows 💤). Click your creature, then
  an enemy creature to fight it (both deal damage) or the Warden's portrait to
  strike its life directly.
- **Spells:** click a spell, then its target when one is needed (Fireball).
- **Combos:** play two cards of one suit in a single turn to trigger a bonus —
  ▲ Ember: your creatures gain +2 attack · ● Tide: draw a card ·
  ◆ Thorn: restore 3 life · ☾ Gloom: deal 2 damage to the foe.
- **End Turn** hands the table to the Warden, which plays in the open and
  narrates every move in the Court Log.
- **Keyboard:** `1–7` select a hand card, `Enter` ends the turn (or starts the
  game), `Esc` cancels a selection.

Suits are told apart by colour *and* shape, never by text alone:
▲ Ember (red), ● Tide (blue), ◆ Thorn (green), ☾ Gloom (violet).

## The deck

19 original cards across the four suits — 13 creatures and 6 spells —
including Flame Knight, Pyre Drake, Storm Herald, Grove Elder, Night Warden,
Fireball, Tidal Surge, Mend, Soul Drain, Ember Nova and Moonfall. Every name,
rule and piece of art is original to this game.

## Structure

- `game/index.html` — the page, nothing but the table and its scripts
- `game/style.css` — the felt, the cards, the deal/flip/snap animations
- `game/src/cards.js` — the 19 cards, the four suits, deck building, combos
- `game/src/state.js` — the rules: turns, mana, combat, spells, winning
- `game/src/ai.js` — the Warden: one readable move at a time
- `game/src/render.js` — the table: cards, fields, log, title/win/loss screens
- `game/src/audio.js` — WebAudio sound effects, synthesized live, no files
- `game/src/shots.js` — deterministic screenshot scenes (`?shot=title|play|win|loss`)
- `game/src/main.js` — input, keyboard, the AI turn driver
- `main.ts` — the entry program: copies `game/` and `screenshots/` to
  `/output` and writes `dossier.json` with the vendored make.fun library
- `screenshots/` — four real renders of the game's own code in headless Chromium

## Screenshots

The game takes its own pictures: `?shot=title|play|win|loss` stages a real,
playable game state and the renderer draws it, frozen mid-animation so every
run is identical.

## License

MIT — see `LICENSE`.
