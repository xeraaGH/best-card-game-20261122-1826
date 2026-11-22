// Ember Court — the opponent. The Warden plays in the open: it spends
// its mana on the biggest creatures it can afford, saves a burn spell
// for a killing blow, and attacks the weakest creature it can kill —
// otherwise it goes for your life. Every choice lands in the log, so
// its plan is readable and counterable: hold a big blocker, and it
// wastes its attack on the board instead of your face.
//
// The UI asks for one move at a time (aiNextMove) and plays each out
// with a pause, so the player watches the Warden think.

import { attack, canPlay, playCard } from './state.js';

/**
 * The Warden's next move, or { type: 'end' } when it is done.
 * Moves are computed fresh each call, so the board the UI shows is
 * always the board the move is made on.
 */
export function aiNextMove(g) {
  const ai = g.ai;

  // Play a card while mana lasts, biggest first — but keep a Fireball
  // in hand unless it finishes the player.
  const options = ai.hand
    .filter((c) => canPlay(g, 'ai', c))
    .sort((a, b) => b.cost - a.cost || b.atk - a.atk);
  for (const pick of options) {
    if (pick.effect === 'burn' && g.player.life > 4) continue;
    return { type: 'play', uid: pick.uid, name: pick.name };
  }

  // Attack with every ready creature: kill the weakest enemy it can
  // finish, otherwise strike your life directly.
  for (const c of ai.field) {
    if (c.justPlayed) continue;
    const prey = g.player.field
      .filter((d) => d.hp <= c.atk)
      .sort((a, b) => a.hp - b.hp)[0];
    if (prey) {
      return { type: 'attack', uid: c.uid, name: c.name, target: { kind: 'creature', uid: prey.uid } };
    }
    return { type: 'attack', uid: c.uid, name: c.name, target: { kind: 'hero', who: 'player' } };
  }

  return { type: 'end' };
}

/** Carry out one move the AI chose, against the live game state. */
export function aiDoMove(g, move) {
  if (move.type === 'play') playCard(g, 'ai', move.uid);
  else if (move.type === 'attack') attack(g, 'ai', move.uid, move.target);
}

/** A one-line summary of what the Warden just did, for the game log. */
export function summarizeAiTurn(moves) {
  const plays = moves.filter((m) => m.type === 'play').length;
  const attacks = moves.filter((m) => m.type === 'attack').length;
  if (plays === 0 && attacks === 0) return 'The Warden passes, biding its time.';
  return `The Warden plays ${plays} card${plays === 1 ? '' : 's'} and attacks ${attacks} time${attacks === 1 ? '' : 's'}.`;
}
