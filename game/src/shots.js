// Ember Court — screenshot scenes. The game takes its own pictures
// through ?shot=<name>: each scene sets the game to a real, playable
// state — hands, fields, life, mana, the log — using the same state
// the rules engine plays with, and the renderer draws it. Nothing is
// staged art: the same code draws it for a player.
//
//   ?shot=title  the title screen over a fresh table
//   ?shot=play   mid-duel: creatures on both fields, full hands, log
//   ?shot=win    the VICTORY screen over the final table
//   ?shot=loss   the DEFEAT screen over the final table

import { makeCard } from './cards.js';
import { createGame, startGame, log } from './state.js';

/** A tiny seeded RNG (mulberry32) so every shot is identical run to run. */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Put a card straight onto a field, as if it had been played earlier. */
function fieldCard(g, who, id, opts = {}) {
  const card = makeCard(id, g[who].field.length + 100);
  card.justPlayed = opts.justPlayed ?? false;
  if (opts.atk !== undefined) card.atk = opts.atk;
  if (opts.hp !== undefined) { card.hp = opts.hp; card.maxHp = opts.hp; }
  g[who].field.push(card);
  return card;
}

/** Put a card into a hand. */
function handCard(g, who, id) {
  const card = makeCard(id, g[who].hand.length + 200);
  g[who].hand.push(card);
  return card;
}

/** The mid-duel table every end screen stands on. */
function midDuel(g) {
  startGame(g);
  g.turn = 6;
  g.player.life = 14;
  g.ai.life = 17;
  g.player.maxMana = 6;
  g.player.mana = 3;
  g.ai.maxMana = 6;
  g.ai.mana = 2;
  g.player.hand = [];
  g.ai.hand = [];
  g.player.field = [];
  g.ai.field = [];
  // A busy, readable board: three creatures each side, one of them hurt.
  fieldCard(g, 'player', 'knight', { atk: 4, hp: 2 });
  fieldCard(g, 'player', 'reef', { hp: 3 });
  fieldCard(g, 'player', 'hound');
  fieldCard(g, 'ai', 'warden');
  fieldCard(g, 'ai', 'herald', { hp: 3 });
  fieldCard(g, 'ai', 'bat');
  handCard(g, 'player', 'fireball');
  handCard(g, 'player', 'drake');
  handCard(g, 'player', 'surge');
  handCard(g, 'player', 'imp');
  handCard(g, 'player', 'elder');
  handCard(g, 'ai', 'imp');
  handCard(g, 'ai', 'hound');
  handCard(g, 'ai', 'sprite');
  handCard(g, 'ai', 'mend');
  handCard(g, 'ai', 'stalker');
  g.log.length = 0;
  log(g, 'THORN COMBO — restore 3 life!');
  log(g, 'You play Grove Elder (3/6).');
  log(g, 'The Warden plays Storm Herald (4/4).');
  log(g, 'Flame Knight trades blows with Night Warden.');
  log(g, 'You draw Tidal Surge.');
  log(g, 'The duel begins. You go first — play a card, then End Turn.');
}

/**
 * Set the game to the named scene and return the fresh game. The caller
 * renders it; main.js reads ?shot= and calls this instead of starting
 * a normal game.
 */
export function stageShot(name) {
  const g = createGame(seededRandom(20261122));
  if (name === 'title') {
    g.phase = 'title';
    return g;
  }
  midDuel(g);
  if (name === 'win') {
    g.ai.life = 0;
    g.phase = 'win';
    log(g, 'VICTORY — the Ember Court is yours!');
  } else if (name === 'loss') {
    g.player.life = 0;
    g.phase = 'loss';
    log(g, 'DEFEAT — the Court claims another challenger.');
  }
  return g;
}
