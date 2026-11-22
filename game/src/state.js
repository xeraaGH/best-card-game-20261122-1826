// Ember Court — the rules. One game state, plain data, no DOM: the
// renderer draws it, the AI reads it, and the screenshot scenes set it
// up directly. A duel: 20 life each, mana that grows one crystal a turn
// (up to 10), creatures that fight, spells that strike, and a suit combo
// when two cards of one suit are played in a single turn.

import { buildDeck, comboBonus, DEFS_BY_ID } from './cards.js';

export const MAX_LIFE = 20;
export const MAX_MANA = 10;
export const MAX_HAND = 7;
export const MAX_FIELD = 7;

/** A fresh game. `random` is injectable so screenshots are deterministic. */
export function createGame(random = Math.random) {
  const g = {
    random,
    turn: 1,
    active: 'player', // whose turn it is: 'player' | 'ai'
    phase: 'title', // title | play | win | loss
    log: [],
    comboBanner: null,
    player: newSide(random),
    ai: newSide(random),
    selected: null, // uid of the selected hand card, or null
    attacker: null, // uid of the selected attacking creature, or null
    targeting: null, // spell awaiting a target: { card, effect } | null
  };
  return g;
}

function newSide(random) {
  return {
    life: MAX_LIFE,
    mana: 1,
    maxMana: 1,
    deck: buildDeck(random),
    hand: [],
    field: [],
    discard: [],
    suitsPlayed: [], // suits played this turn, for the combo
  };
}

/** Draw `n` cards for a side; an empty deck reshuffles the discard pile. */
export function drawCard(g, who, n = 1) {
  const side = g[who];
  for (let i = 0; i < n; i++) {
    if (side.deck.length === 0) {
      if (side.discard.length === 0) return;
      side.deck = side.discard;
      side.discard = [];
      shuffleInPlace(side.deck, g.random);
      log(g, `${nameOf(who)} reshuffles the discard pile.`);
    }
    const card = side.deck.pop();
    if (side.hand.length < MAX_HAND) side.hand.push(card);
    else side.discard.push(card);
  }
}

function shuffleInPlace(arr, random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/** Deal the opening hands and start turn 1. */
export function startGame(g) {
  drawCard(g, 'player', 4);
  drawCard(g, 'ai', 4);
  // Opening-hand guarantee: each side always opens with a 1-cost card
  // and a different 2-cost card in hand, so turns 1 and 2 are never
  // dead passes with nothing to play.
  guaranteeCost(g, 'player', 1);
  guaranteeCost(g, 'player', 2);
  guaranteeCost(g, 'ai', 1);
  guaranteeCost(g, 'ai', 2);
  g.phase = 'play';
  g.active = 'player';
  g.player.mana = 1;
  g.player.maxMana = 1;
  log(g, 'The duel begins. You go first — play a card, then End Turn.');
  log(g, 'Tip: two cards of one suit in a turn trigger a COMBO.');
}

/** Swap a card costing exactly `cost` from the deck into a hand that has none. */
function guaranteeCost(g, who, cost) {
  const side = g[who];
  if (side.hand.some((c) => c.cost === cost)) return;
  const idx = side.deck.findIndex((c) => c.cost === cost);
  if (idx < 0) return;
  const one = side.deck.splice(idx, 1)[0];
  const swapOut = side.hand.reduce((worst, c, i) => (c.cost > side.hand[worst].cost ? i : worst), 0);
  const out = side.hand[swapOut];
  side.hand[swapOut] = one;
  // The swapped-out card goes back into the deck at a random depth.
  side.deck.splice(Math.floor(g.random() * side.deck.length), 0, out);
}

/** Begin a side's turn: mana grows, a card is drawn, sickness clears. */
export function beginTurn(g, who) {
  const side = g[who];
  g.active = who;
  side.maxMana = Math.min(MAX_MANA, side.maxMana + (who === 'player' ? 0 : 1));
  if (who === 'player') side.maxMana = Math.min(MAX_MANA, g.turn);
  side.mana = side.maxMana;
  side.suitsPlayed = [];
  for (const c of side.field) c.justPlayed = false;
  drawCard(g, who, 1);
  log(g, `${nameOf(who)} — turn ${g.turn}. Mana ${side.mana}/${side.maxMana}.`);
}

/** End the current turn and hand over to the other side. */
export function endTurn(g) {
  if (g.phase !== 'play') return;
  g.selected = null;
  g.attacker = null;
  g.targeting = null;
  if (g.active === 'player') {
    g.active = 'ai';
    beginTurn(g, 'ai');
  } else {
    g.active = 'player';
    g.turn += 1;
    beginTurn(g, 'player');
  }
}

/** Can this side afford and play this hand card right now? */
export function canPlay(g, who, card) {
  const side = g[who];
  if (g.phase !== 'play' || g.active !== who) return false;
  if (card.cost > side.mana) return false;
  if (card.kind === 'creature' && side.field.length >= MAX_FIELD) return false;
  return true;
}

/**
 * Play a hand card. Creatures enter the field (sick until next turn);
 * spells resolve at once, or wait for a target when they need one.
 * Returns 'played' | 'targeting' | null (when illegal).
 */
export function playCard(g, who, cardUid, target = null) {
  const side = g[who];
  const idx = side.hand.findIndex((c) => c.uid === cardUid);
  if (idx < 0) return null;
  const card = side.hand[idx];
  if (!canPlay(g, who, card)) return null;
  if (card.kind === 'spell' && needsTarget(card) && !target) {
    g.targeting = { cardUid, effect: card.effect };
    return 'targeting';
  }
  side.hand.splice(idx, 1);
  side.mana -= card.cost;
  side.suitsPlayed.push(card.suit);
  if (card.kind === 'creature') {
    card.justPlayed = true;
    side.field.push(card);
    log(g, `${nameOf(who)} plays ${card.name} (${card.atk}/${card.hp}).`);
  } else {
    resolveSpell(g, who, card, target);
    side.discard.push(card);
  }
  checkCombo(g, who);
  return 'played';
}

/** Spells that need the player to pick a target first. */
export function needsTarget(card) {
  return card.effect === 'burn';
}

/** Apply a spell's effect. `target` is { kind: 'hero'|'creature', who, uid? }. */
export function resolveSpell(g, who, card, target) {
  const foe = who === 'player' ? 'ai' : 'player';
  const me = nameOf(who);
  switch (card.effect) {
    case 'burn': {
      if (target?.kind === 'hero') damageHero(g, target.who, 4);
      else if (target?.kind === 'creature') damageCreature(g, target.who, target.uid, 4);
      log(g, `${me} hurls Fireball for 4 damage.`);
      break;
    }
    case 'surge':
      drawCard(g, who, 2);
      log(g, `${me} draws 2 cards on the Surge.`);
      break;
    case 'mend':
      g[who].life = Math.min(MAX_LIFE, g[who].life + 6);
      log(g, `${me} mends 6 life.`);
      break;
    case 'drain':
      damageHero(g, foe, 2);
      g[who].life = Math.min(MAX_LIFE, g[who].life + 2);
      log(g, `${me} drains 2 life from the foe.`);
      break;
    case 'nova': {
      const victims = [...g[foe].field];
      for (const c of victims) damageCreature(g, foe, c.uid, 3);
      log(g, `${me} unleashes Ember Nova — 3 to all enemy creatures.`);
      break;
    }
    case 'moonfall':
      damageHero(g, foe, 3);
      log(g, `${me} calls Moonfall — 3 damage to the foe.`);
      break;
    default:
      log(g, `${me} casts ${card.name}.`);
  }
  checkEnd(g);
}

/** A creature attacks: another creature (both deal damage) or a hero. */
export function attack(g, who, attackerUid, target) {
  const side = g[who];
  const foe = who === 'player' ? 'ai' : 'player';
  const attacker = side.field.find((c) => c.uid === attackerUid);
  if (!attacker || attacker.justPlayed || g.phase !== 'play' || g.active !== who) return false;
  attacker.justPlayed = true; // one attack per turn
  if (target.kind === 'hero') {
    damageHero(g, target.who, attacker.atk);
    log(g, `${attacker.name} strikes ${nameOf(target.who)} for ${attacker.atk}.`);
  } else {
    const defender = g[foe].field.find((c) => c.uid === target.uid);
    if (!defender) return false;
    damageCreature(g, foe, target.uid, attacker.atk);
    damageCreature(g, who, attackerUid, defender.atk);
    log(g, `${attacker.name} trades blows with ${defender.name}.`);
  }
  checkEnd(g);
  return true;
}

/** Damage a hero; life never drops below 0 in the display. */
export function damageHero(g, who, n) {
  g[who].life = Math.max(0, g[who].life - n);
  checkEnd(g);
}

/** Damage a creature; the dead fall to the discard pile. */
export function damageCreature(g, who, uid, n) {
  const side = g[who];
  const c = side.field.find((x) => x.uid === uid);
  if (!c) return;
  c.hp -= n;
  if (c.hp <= 0) {
    side.field = side.field.filter((x) => x.uid !== uid);
    side.discard.push(c);
    log(g, `${c.name} falls.`);
  }
}

/** The combo check after every played card: two of a suit, one turn. */
export function checkCombo(g, who) {
  const side = g[who];
  const counts = {};
  for (const s of side.suitsPlayed) counts[s] = (counts[s] ?? 0) + 1;
  for (const [suit, n] of Object.entries(counts)) {
    if (n === 2) {
      const bonus = comboBonus(suit);
      if (bonus) {
        applyCombo(g, who, bonus.key);
        g.comboBanner = bonus.text;
        log(g, bonus.text);
        side.suitsPlayed = side.suitsPlayed.filter((s) => s !== suit);
      }
    }
  }
}

/** What each suit's combo actually does on the table. */
export function applyCombo(g, who, key) {
  const foe = who === 'player' ? 'ai' : 'player';
  if (key === 'ember') for (const c of g[who].field) c.atk += 2;
  if (key === 'tide') drawCard(g, who, 1);
  if (key === 'thorn') g[who].life = Math.min(MAX_LIFE, g[who].life + 3);
  if (key === 'gloom') damageHero(g, foe, 2);
}

/** Has anyone won? Sets the phase and logs the result. */
export function checkEnd(g) {
  if (g.phase !== 'play') return;
  if (g.ai.life <= 0) {
    g.phase = 'win';
    g.comboBanner = null;
    log(g, 'VICTORY — the Ember Court is yours!');
  } else if (g.player.life <= 0) {
    g.phase = 'loss';
    g.comboBanner = null;
    log(g, 'DEFEAT — the Court claims another challenger.');
  }
}

/** Append a line to the game log (newest first, capped at 30). */
export function log(g, text) {
  g.log.unshift(text);
  if (g.log.length > 30) g.log.length = 30;
}

export function nameOf(who) {
  return who === 'player' ? 'You' : 'The Warden';
}

/** The AI's readable difficulty: it never hides its plan — the log says what it does. */
export function aiHandSize(g) {
  return g.ai.hand.length;
}

export { DEFS_BY_ID };
