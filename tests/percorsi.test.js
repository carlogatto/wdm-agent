// Il plugin gira ovunque sia installato: nessun file contiene la cartella personale di qualcuno,
// e fuori dalle prove nessuno cita ~/.claude. Restano fuori docs/ e README.md (raccontano la
// storia del plugin) e i file locali non versionati.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RADICE = path.join(__dirname, '..');
const ESCLUSI = ['.git', '.DS_Store', 'node_modules', 'docs', 'README.md', path.join('tests', 'sito.local.json')];

function file(cartella) {
  return fs.readdirSync(cartella, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(cartella, e.name);
    if (ESCLUSI.includes(path.relative(RADICE, p))) return [];
    return e.isDirectory() ? file(p) : [p];
  });
}

function righe(elenco, modello) {
  return elenco.flatMap((f) => fs.readFileSync(f, 'utf8').split('\n')
    .flatMap((riga, i) => (modello.test(riga) ? [`${path.relative(RADICE, f)}:${i + 1}: ${riga.trim()}`] : [])));
}

const TUTTI = file(RADICE);
const PROVE = path.join(RADICE, 'tests') + path.sep;

test('il plugin ha file da controllare', () => {
  assert.ok(TUTTI.length > 20, `trovati ${TUTTI.length} file`);
  assert.ok(TUTTI.some((f) => f.startsWith(PROVE)), 'le prove non sono tra i file controllati');
});

test('nessuna cartella personale, nemmeno nelle prove', () => {
  assert.deepEqual(righe(TUTTI, /\/Users\/[\w.-]+|[A-Za-z]:\\Users\\[\w.-]+|\/home\/[\w.-]+/), []);
});

test('fuori dalle prove nessun riferimento a ~/.claude', () => {
  assert.deepEqual(righe(TUTTI.filter((f) => !f.startsWith(PROVE)), /~\/\.claude|\$HOME\/\.claude/), []);
});
