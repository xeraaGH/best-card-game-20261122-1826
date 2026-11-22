// Ember Court — the wiring. Input (mouse and keyboard), the AI turn
// driver, and the ?shot= scenes. The game itself lives in state.js;
// this file only connects a state to the screen.

import { createGame, startGame, endTurn, playCard, attack, canPlay, needsTarget, checkEnd } from './state.js';
import { aiNextMove, aiDoMove, summarizeAiTurn } from './ai.js';
import { render } from './render.js';
import { sfx, ensureAudio } from './audio.js';
import { stageShot } from './shots.js';

let g = createGame();
let aiTimer = null;
let aiMoves = [];

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');

/** Draw the table, and play the right sound for a phase change. */
function draw(prevPhase) {
  render(g, ui);
  if (prevPhase !== g.phase) {
    if (g.phase === 'win') sfx.win();
    else if (g.phase === 'loss') sfx.lose();
  }
  if (g.comboBanner) {
    sfx.combo();
    const banner = g.comboBanner;
    setTimeout(() => { if (g.comboBanner === banner) { g.comboBanner = null; draw(); } }, 2200);
  }
}

/** The AI's turn, one move every 750ms so the player can follow it. */
function runAiTurn() {
  aiMoves = [];
  const step = () => {
    if (g.phase !== 'play' || g.active !== 'ai') return;
    const move = aiNextMove(g);
    if (move.type === 'end') {
      const prev = g.phase;
      const summary = summarizeAiTurn(aiMoves);
      endTurn(g);
      g.log.unshift(summary);
      aiMoves = [];
      draw(prev);
      return;
    }
    const prev = g.phase;
    aiDoMove(g, move);
    aiMoves.push(move);
    if (move.type === 'play') sfx.playCard();
    else sfx.attack();
    draw(prev);
    aiTimer = setTimeout(step, 750);
  };
  aiTimer = setTimeout(step, 700);
}

function stopAi() {
  if (aiTimer !== null) { clearTimeout(aiTimer); aiTimer = null; }
}

const ui = {
  onPlay() {
    ensureAudio();
    sfx.deal();
    stopAi();
    g = createGame();
    startGame(g);
    draw('title');
  },

  onPlayAgain() {
    ensureAudio();
    sfx.deal();
    stopAi();
    g = createGame();
    startGame(g);
    draw('win');
  },

  onHandCard(card) {
    if (g.phase !== 'play' || g.active !== 'player') return;
    ensureAudio();
    if (g.targeting) { g.targeting = null; g.selected = null; draw(); return; }
    if (g.selected === card.uid) { g.selected = null; draw(); return; }
    if (!canPlay(g, 'player', card)) { sfx.click(); draw(); return; }
    if (card.kind === 'spell' && needsTarget(card)) {
      g.selected = card.uid;
      g.targeting = { cardUid: card.uid, effect: card.effect };
      sfx.click();
      draw();
      return;
    }
    const prev = g.phase;
    const result = playCard(g, 'player', card.uid);
    if (result === 'played') { sfx.playCard(); g.selected = null; draw(prev); }
  },

  onFieldCard(who, card) {
    if (g.phase !== 'play' || g.active !== 'player') return;
    ensureAudio();
    // A Fireball in hand wants a creature target.
    if (g.targeting) {
      const prev = g.phase;
      const t = playCard(g, 'player', g.targeting.cardUid, { kind: 'creature', who, uid: card.uid });
      if (t === 'played') { sfx.attack(); g.targeting = null; g.selected = null; draw(prev); }
      return;
    }
    // Attacking: click your own creature, then an enemy creature.
    if (who === 'player') {
      if (card.justPlayed) { sfx.click(); return; }
      g.attacker = g.attacker === card.uid ? null : card.uid;
      sfx.click();
      draw();
      return;
    }
    if (g.attacker) {
      const prev = g.phase;
      const ok = attack(g, 'player', g.attacker, { kind: 'creature', uid: card.uid });
      if (ok) { sfx.attack(); g.attacker = null; draw(prev); }
    }
  },

  onHero(who) {
    if (g.phase !== 'play' || g.active !== 'player') return;
    ensureAudio();
    if (g.targeting) {
      const prev = g.phase;
      const t = playCard(g, 'player', g.targeting.cardUid, { kind: 'hero', who });
      if (t === 'played') { sfx.attack(); g.targeting = null; g.selected = null; draw(prev); }
      return;
    }
    if (who === 'ai' && g.attacker) {
      const prev = g.phase;
      const ok = attack(g, 'player', g.attacker, { kind: 'hero', who: 'ai' });
      if (ok) { sfx.hurt(); g.attacker = null; draw(prev); }
    }
  },

  onEndTurn() {
    if (g.phase !== 'play' || g.active !== 'player') return;
    ensureAudio();
    sfx.click();
    const prev = g.phase;
    endTurn(g);
    draw(prev);
    if (g.phase === 'play' && g.active === 'ai') runAiTurn();
  },
};

// Keyboard: 1–7 select a hand card, Enter ends the turn, Esc cancels.
document.addEventListener('keydown', (e) => {
  if (shotName) return;
  if (e.key >= '1' && e.key <= '7') {
    const card = g.player.hand[Number(e.key) - 1];
    if (card) ui.onHandCard(card);
  } else if (e.key === 'Enter') {
    if (g.phase === 'title' || g.phase === 'win' || g.phase === 'loss') ui.onPlay();
    else ui.onEndTurn();
  } else if (e.key === 'Escape') {
    g.selected = null;
    g.attacker = null;
    g.targeting = null;
    draw();
  }
});

// Screenshot mode: freeze animations and render the staged scene.
if (shotName) {
  document.body.classList.add('shot-mode');
  g = stageShot(shotName);
  draw('title');
} else {
  draw('title');
}

// Keep the game honest: nothing here reaches the network, and the
// table is always a real game state the rules engine can continue.
export { checkEnd };
