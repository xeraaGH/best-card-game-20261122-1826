// Ember Court — the table. Everything the player sees is DOM: cards are
// real elements with suit colours, shapes and big readable numbers, so
// the game stays legible at thumbnail size. render(g) rebuilds the
// table from the state each time; CSS transitions do the sliding,
// flipping and snapping.

import { SUITS } from './cards.js';
import { MAX_FIELD } from './state.js';

const seenUids = new Set();

/** Build one card element. `opts` picks face-down, playable, selected, attacking, targetable. */
export function cardElement(card, opts = {}) {
  const suit = SUITS[card.suit];
  const el = document.createElement('div');
  el.className = 'card';
  el.dataset.uid = card.uid;
  el.style.setProperty('--suit', suit.color);
  el.style.setProperty('--suit-dark', suit.dark);
  el.style.setProperty('--suit-glow', suit.glow);
  if (opts.mini) el.classList.add('mini');
  if (opts.tiny) el.classList.add('tiny');
  if (opts.back) {
    el.classList.add('back');
    el.innerHTML = `<div class="card-back-glyph">♛</div><div class="card-back-name">EMBER COURT</div>`;
    return el;
  }
  if (opts.playable) el.classList.add('playable');
  if (opts.selected) el.classList.add('selected');
  if (opts.attacking) el.classList.add('attacking');
  if (opts.targetable) el.classList.add('targetable');
  if (opts.justPlayed) el.classList.add('sick');
  if (!seenUids.has(card.uid)) {
    el.classList.add('dealt');
    seenUids.add(card.uid);
  }
  const stats = card.kind === 'creature'
    ? `<div class="card-stats"><span class="atk" title="Attack">⚔ ${card.atk}</span><span class="hp" title="Health">♥ ${card.hp}</span></div>`
    : `<div class="card-stats"><span class="spell-tag">SPELL</span></div>`;
  el.innerHTML = `
    <div class="card-cost" title="Mana cost">${card.cost}</div>
    <div class="card-suit" title="${suit.name}">${suit.glyph}</div>
    <div class="card-name">${card.name}</div>
    <div class="card-art" aria-hidden="true">${suit.glyph}</div>
    <div class="card-text">${card.text}</div>
    ${stats}`;
  return el;
}

/** A row of face-down card backs for the opponent's hand. */
function handBacks(n) {
  const row = document.createElement('div');
  row.className = 'opp-hand';
  for (let i = 0; i < Math.min(n, 7); i++) {
    const back = cardElement({ uid: `back-${i}`, suit: 'gloom' }, { back: true, tiny: true });
    back.style.setProperty('--i', i);
    row.appendChild(back);
  }
  return row;
}

/** Mana crystals: filled gems for mana left, dim for spent, empty slots for the rest. */
function manaPips(mana, max) {
  let html = '';
  for (let i = 0; i < 10; i++) {
    const cls = i < mana ? 'pip full' : i < max ? 'pip spent' : 'pip empty';
    html += `<span class="${cls}">◆</span>`;
  }
  return html;
}

/** Life as hearts: one heart per 2 life, half a heart for an odd point. */
function lifeHearts(life) {
  let html = '';
  for (let i = 0; i < 10; i++) {
    const v = life - i * 2;
    html += `<span class="heart ${v >= 2 ? 'full' : v === 1 ? 'half' : 'lost'}">♥</span>`;
  }
  return html;
}

/** The whole table, rebuilt from the game state. */
export function render(g, ui) {
  const app = document.getElementById('app');
  app.innerHTML = '';

  const table = document.createElement('div');
  table.className = 'table';
  if (g.phase === 'win') table.classList.add('over-win');
  if (g.phase === 'loss') table.classList.add('over-loss');

  const board = document.createElement('div');
  board.className = 'board';

  // --- Opponent bar: portrait, name, life, mana, deck ---
  const oppBar = document.createElement('div');
  oppBar.className = 'side-bar opp-bar';
  oppBar.innerHTML = `
    <div class="portrait warden" id="opp-hero" title="The Warden — click to attack with a creature">♛</div>
    <div class="side-info">
      <div class="side-name">THE WARDEN <span class="side-sub">Keeper of the Ember Court</span></div>
      <div class="life-row"><span class="life-num">${g.ai.life}</span>${lifeHearts(g.ai.life)}</div>
      <div class="mana-row"><span class="mana-label">MANA</span>${manaPips(g.ai.mana, g.ai.maxMana)}</div>
    </div>
    <div class="deck-pile" title="Opponent deck: ${g.ai.deck.length} cards">🂠<span>${g.ai.deck.length}</span></div>`;
  board.appendChild(oppBar);
  board.appendChild(handBacks(g.ai.hand.length));

  // --- Opponent field ---
  const oppField = document.createElement('div');
  oppField.className = 'field opp-field';
  if (g.ai.field.length === 0) oppField.innerHTML = '<div class="field-hint">The Warden has no creatures — strike now!</div>';
  for (const c of g.ai.field) {
    const el = cardElement(c, {
      mini: true,
      targetable: !!g.attacker || !!g.targeting,
      justPlayed: c.justPlayed,
    });
    el.addEventListener('click', () => ui.onFieldCard('ai', c));
    oppField.appendChild(el);
  }
  board.appendChild(oppField);

  // --- Middle strip: turn banner, combo banner, End Turn ---
  const mid = document.createElement('div');
  mid.className = 'mid-strip';
  const turnText = g.phase === 'play'
    ? g.active === 'player' ? 'YOUR TURN' : "THE WARDEN'S TURN…"
    : g.phase === 'win' ? 'VICTORY' : g.phase === 'loss' ? 'DEFEAT' : 'EMBER COURT';
  mid.innerHTML = `
    <div class="turn-banner ${g.active === 'player' && g.phase === 'play' ? 'yours' : ''}">${turnText}</div>
    <div class="combo-banner ${g.comboBanner ? 'show' : ''}">${g.comboBanner ?? ''}</div>
    <button class="end-turn" id="end-turn" ${g.phase !== 'play' || g.active !== 'player' ? 'disabled' : ''}>END TURN ⏎</button>`;
  board.appendChild(mid);

  // --- Player field ---
  const plField = document.createElement('div');
  plField.className = 'field pl-field';
  if (g.player.field.length === 0) plField.innerHTML = '<div class="field-hint">Your side of the table — play a creature to hold it.</div>';
  for (const c of g.player.field) {
    const el = cardElement(c, {
      mini: true,
      attacking: g.attacker === c.uid,
      justPlayed: c.justPlayed,
    });
    el.addEventListener('click', () => ui.onFieldCard('player', c));
    plField.appendChild(el);
  }
  board.appendChild(plField);

  // --- Player hand ---
  const hand = document.createElement('div');
  hand.className = 'hand';
  for (const c of g.player.hand) {
    const playable = g.phase === 'play' && g.active === 'player' && c.cost <= g.player.mana
      && (c.kind !== 'creature' || g.player.field.length < MAX_FIELD);
    const el = cardElement(c, {
      playable,
      selected: g.selected === c.uid,
    });
    el.addEventListener('click', () => ui.onHandCard(c));
    hand.appendChild(el);
  }
  board.appendChild(hand);

  // --- Player bar ---
  const plBar = document.createElement('div');
  plBar.className = 'side-bar pl-bar';
  plBar.innerHTML = `
    <div class="portrait you" id="pl-hero" title="You">♞</div>
    <div class="side-info">
      <div class="side-name">YOU <span class="side-sub">Challenger of the Court</span></div>
      <div class="life-row"><span class="life-num">${g.player.life}</span>${lifeHearts(g.player.life)}</div>
      <div class="mana-row"><span class="mana-label">MANA</span>${manaPips(g.player.mana, g.player.maxMana)}</div>
    </div>
    <div class="deck-pile" title="Your deck: ${g.player.deck.length} cards">🂠<span>${g.player.deck.length}</span></div>
    <div class="keys-hint" title="1–7 select a card · Enter end turn · Esc cancel">Keys: 1–7 · Enter · Esc</div>`;
  board.appendChild(plBar);

  // --- Sidebar: the game log ---
  const side = document.createElement('div');
  side.className = 'sidebar';
  side.innerHTML = `
    <div class="log-title">⚜ COURT LOG</div>
    <div class="log">${g.log.map((l) => `<div class="log-line">${escapeHtml(l)}</div>`).join('') || '<div class="log-line">No events yet.</div>'}</div>
    <div class="rules-box">
      <div class="rules-title">HOW TO PLAY</div>
      <div class="rules-line"><b>Goal:</b> reduce the Warden to 0 life.</div>
      <div class="rules-line"><b>Play:</b> click a card, then the table. Click a creature, then an enemy to attack.</div>
      <div class="rules-line"><b>Combo:</b> two of one suit in a turn — ▲ +2 attack, ● draw a card, ◆ heal 3, ☾ deal 2.</div>
      <div class="rules-line"><b>Mana:</b> grows 1 each turn, to 10.</div>
    </div>`;
  table.appendChild(board);
  table.appendChild(side);
  app.appendChild(table);

  // Wire the End Turn button and the hero portraits (attack targets).
  const endBtn = document.getElementById('end-turn');
  if (endBtn) endBtn.addEventListener('click', () => ui.onEndTurn());
  const oppHero = document.getElementById('opp-hero');
  if (oppHero) {
    if (g.attacker || g.targeting) oppHero.classList.add('targetable');
    oppHero.addEventListener('click', () => ui.onHero('ai'));
  }

  if (g.phase === 'title') app.appendChild(titleOverlay(ui));
  if (g.phase === 'win') app.appendChild(endOverlay(true, g, ui));
  if (g.phase === 'loss') app.appendChild(endOverlay(false, g, ui));
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** The title screen: big logo, the four suits, Play. */
export function titleOverlay(ui) {
  const ov = document.createElement('div');
  ov.className = 'overlay title-screen';
  ov.innerHTML = `
    <div class="title-suits"><span style="color:#ff6b35">▲</span><span style="color:#38bdf8">●</span><span style="color:#4ade80">◆</span><span style="color:#c084fc">☾</span></div>
    <h1 class="title-logo">EMBER<br>COURT</h1>
    <p class="title-tag">A duel of suits and embers. Outwit the Warden, play two of a suit for a combo, and take the Court.</p>
    <div class="title-cards">
      <div class="title-mini-card" style="--suit:#ff6b35"><span class="tmc-cost">3</span><span class="tmc-glyph">▲</span><span class="tmc-name">Flame Knight</span><span class="tmc-stats">⚔ 4 ♥ 3</span></div>
      <div class="title-mini-card" style="--suit:#38bdf8"><span class="tmc-cost">2</span><span class="tmc-glyph">●</span><span class="tmc-name">Tidal Surge</span><span class="tmc-stats">SPELL</span></div>
      <div class="title-mini-card" style="--suit:#c084fc"><span class="tmc-cost">4</span><span class="tmc-glyph">☾</span><span class="tmc-name">Night Warden</span><span class="tmc-stats">⚔ 3 ♥ 5</span></div>
    </div>
    <button class="play-btn" id="play-btn">▶ &nbsp;PLAY THE DUEL</button>
    <p class="title-foot">20 life · mana grows each turn · two of a suit = combo · keyboard 1–7, Enter, Esc</p>`;
  ov.querySelector('#play-btn').addEventListener('click', () => ui.onPlay());
  return ov;
}

/** The win and loss screens, with a flourish and a Play Again button. */
export function endOverlay(won, g, ui) {
  const ov = document.createElement('div');
  ov.className = `overlay end-screen ${won ? 'win' : 'loss'}`;
  ov.innerHTML = `
    <div class="end-glyph">${won ? '♛' : '☠'}</div>
    <h1 class="end-title">${won ? 'VICTORY' : 'DEFEAT'}</h1>
    <p class="end-sub">${won
      ? 'The Ember Court is yours. The Warden bows — the embers answer to you now.'
      : 'The Court claims another challenger. The Warden waits, patient as ever.'}</p>
    <div class="end-score">You ${g.player.life} ♥ &nbsp;·&nbsp; Warden ${g.ai.life} ♥ &nbsp;·&nbsp; ${g.turn} turn${g.turn === 1 ? '' : 's'}</div>
    <button class="play-btn" id="again-btn">↻ &nbsp;PLAY AGAIN</button>`;
  ov.querySelector('#again-btn').addEventListener('click', () => ui.onPlayAgain());
  return ov;
}
