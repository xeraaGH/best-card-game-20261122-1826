// Ember Court — the cards. Four suits, each told apart by colour AND
// shape: Ember is a flame (red-orange), Tide a droplet (blue), Thorn a
// leaf (green), Gloom a crescent moon (violet). Every card is an original
// creation of this game; no card copies a commercial game.

export const SUITS = {
  ember: { name: 'Ember', glyph: '▲', color: '#ff6b35', dark: '#c2410c', glow: 'rgba(255,107,53,.55)' },
  tide: { name: 'Tide', glyph: '●', color: '#38bdf8', dark: '#0369a1', glow: 'rgba(56,189,248,.55)' },
  thorn: { name: 'Thorn', glyph: '◆', color: '#4ade80', dark: '#15803d', glow: 'rgba(74,222,128,.55)' },
  gloom: { name: 'Gloom', glyph: '☾', color: '#c084fc', dark: '#7e22ce', glow: 'rgba(192,132,252,.55)' },
};

/**
 * One card definition. Creatures carry atk/hp; spells carry an effect
 * key the rules engine reads. `text` is the rules line printed on the
 * card itself, so a player never has to guess what a card does.
 */
export const CARD_DEFS = [
  { id: 'imp', name: 'Ember Imp', suit: 'ember', cost: 1, kind: 'creature', atk: 2, hp: 1, text: 'Quick and reckless.' },
  { id: 'hound', name: 'Cinder Hound', suit: 'ember', cost: 2, kind: 'creature', atk: 3, hp: 2, text: 'It hunts in pairs.' },
  { id: 'knight', name: 'Flame Knight', suit: 'ember', cost: 3, kind: 'creature', atk: 4, hp: 3, text: 'Armour forged in the Court.' },
  { id: 'drake', name: 'Pyre Drake', suit: 'ember', cost: 5, kind: 'creature', atk: 6, hp: 5, text: 'The sky catches fire.' },
  { id: 'sprite', name: 'Tide Sprite', suit: 'tide', cost: 1, kind: 'creature', atk: 1, hp: 2, text: 'It slips between waves.' },
  { id: 'reef', name: 'Reef Guard', suit: 'tide', cost: 2, kind: 'creature', atk: 2, hp: 4, text: 'A wall that breathes.' },
  { id: 'herald', name: 'Storm Herald', suit: 'tide', cost: 4, kind: 'creature', atk: 4, hp: 4, text: 'Thunder follows it.' },
  { id: 'sprout', name: 'Thorn Sprout', suit: 'thorn', cost: 1, kind: 'creature', atk: 1, hp: 3, text: 'Small. Patient. Sharp.' },
  { id: 'wolf', name: 'Briar Wolf', suit: 'thorn', cost: 2, kind: 'creature', atk: 3, hp: 2, text: 'The forest hunts back.' },
  { id: 'elder', name: 'Grove Elder', suit: 'thorn', cost: 4, kind: 'creature', atk: 3, hp: 6, text: 'Older than the Court.' },
  { id: 'bat', name: 'Gloom Bat', suit: 'gloom', cost: 1, kind: 'creature', atk: 2, hp: 1, text: 'It sees you first.' },
  { id: 'stalker', name: 'Shade Stalker', suit: 'gloom', cost: 3, kind: 'creature', atk: 4, hp: 2, text: 'It strikes from nowhere.' },
  { id: 'warden', name: 'Night Warden', suit: 'gloom', cost: 4, kind: 'creature', atk: 3, hp: 5, text: 'Keeper of the dark gate.' },
  { id: 'fireball', name: 'Fireball', suit: 'ember', cost: 3, kind: 'spell', effect: 'burn', text: 'Deal 4 damage to any target.' },
  { id: 'surge', name: 'Tidal Surge', suit: 'tide', cost: 2, kind: 'spell', effect: 'surge', text: 'Draw 2 cards.' },
  { id: 'mend', name: 'Mend', suit: 'thorn', cost: 2, kind: 'spell', effect: 'mend', text: 'Restore 6 life.' },
  { id: 'drain', name: 'Soul Drain', suit: 'gloom', cost: 2, kind: 'spell', effect: 'drain', text: 'Deal 2 damage, heal 2.' },
  { id: 'nova', name: 'Ember Nova', suit: 'ember', cost: 5, kind: 'spell', effect: 'nova', text: 'Deal 3 to all enemy creatures.' },
  { id: 'moonfall', name: 'Moonfall', suit: 'gloom', cost: 4, kind: 'spell', effect: 'moonfall', text: 'Deal 3 damage to the foe.' },
];

export const DEFS_BY_ID = Object.fromEntries(CARD_DEFS.map((d) => [d.id, d]));

/** How many copies of each card a deck holds: two of every creature, one of every spell. */
const DECK_COUNTS = Object.fromEntries(
  CARD_DEFS.map((d) => [d.id, d.kind === 'creature' ? 2 : 1]),
);

/** A fresh 30-card deck, shuffled with the given random function. */
export function buildDeck(random = Math.random) {
  const ids = [];
  for (const [id, n] of Object.entries(DECK_COUNTS)) for (let i = 0; i < n; i++) ids.push(id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.map((id, i) => makeCard(id, i));
}

let uidCounter = 0;
/** One playable card instance: a def plus its own identity and live stats. */
export function makeCard(id, n) {
  const def = DEFS_BY_ID[id];
  return {
    uid: `c${uidCounter++}-${n ?? 0}`,
    id,
    name: def.name,
    suit: def.suit,
    cost: def.cost,
    kind: def.kind,
    effect: def.effect ?? null,
    text: def.text,
    atk: def.atk ?? 0,
    hp: def.hp ?? 0,
    maxHp: def.hp ?? 0,
    justPlayed: false,
  };
}

/**
 * The suit combo: playing a second card of a suit in one turn triggers
 * that suit's bonus. Returns the bonus key and its banner text, or null;
 * state.js applies the key (see applyCombo).
 */
export function comboBonus(suit) {
  switch (suit) {
    case 'ember': return { key: 'ember', text: 'EMBER COMBO — your creatures gain +2 attack this turn!' };
    case 'tide': return { key: 'tide', text: 'TIDE COMBO — draw a card!' };
    case 'thorn': return { key: 'thorn', text: 'THORN COMBO — restore 3 life!' };
    case 'gloom': return { key: 'gloom', text: 'GLOOM COMBO — deal 2 damage to the foe!' };
    default: return null;
  }
}
