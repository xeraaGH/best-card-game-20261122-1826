// Ember Court — the entry program (Node 22, standard library only).
//
// What it does: the game lives in this directory's game/ folder as plain
// static files (index.html plus its ES modules, no library, nothing
// fetched over the network). This program hands the entry in: it copies
// game/ and screenshots/ next to this file into the output directory
// and writes dossier.json there, the summary the judge reads, using
// the vendored make.fun library (vendor/makefun-game.ts).
//
// How to run it: the grader runs it twice in a sandbox with /output
// writable; locally, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Both runs must write the same bytes. Before writing anything, the
// program checks the entry is complete (game/index.html present, 3 or 4
// screenshots present) and refuses with a clear error otherwise, so a
// broken entry fails loudly here instead of at the gate.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameDir = join(here, 'game');
const shotsDir = join(here, 'screenshots');

// The entry is not complete without its page and its pictures: check
// first, so a missing file is a loud error here, not a silent gap later.
if (!existsSync(join(gameDir, 'index.html'))) {
  throw new Error('main.ts: game/index.html is missing — the entry has no game to hand in');
}
const shots = existsSync(shotsDir)
  ? readdirSync(shotsDir).filter((n) => !n.startsWith('.') && /\.(png|jpe?g)$/i.test(n))
  : [];
if (shots.length < 3 || shots.length > 4) {
  throw new Error(`main.ts: screenshots/ holds ${shots.length} images — an entry needs 3 or 4`);
}
for (const name of shots) {
  if (statSync(join(shotsDir, name)).size > 262144) {
    throw new Error(`main.ts: screenshots/${name} is over the 256 KiB cap`);
  }
}

mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// The scorer's own caps: only text_max_bytes shapes the dossier's
// bytes; the rest refuse an entry the scorer would refuse — more than
// 4 screenshots or one over 256 KiB, more than 993 entries in game/
// or 48 MiB of game files, or a path under game/ over 1000 bytes
// (game/ counts beside /output's own 1000-entry cap, with
// screenshots/ and dossier.json).
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);

console.log(
  `Ember Court: wrote ${out} — game/ (${shots.length} screenshots: ${shots.join(', ')}), dossier.json ${dossier.length} bytes`,
);
