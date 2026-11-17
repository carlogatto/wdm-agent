// I testi del plugin descrivono il sistema com'è oggi: nessun rimando a piani o fasi di piano,
// nessun residuo di regole superate (U30).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RADICE = path.join(__dirname, '..');

function file(cartella) {
  return fs.readdirSync(cartella, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(cartella, e.name);
    return e.isDirectory() ? file(p) : e.name === '.DS_Store' ? [] : [p];
  });
}

// Righe che il `filtro` segnala, come «file:riga: testo».
function righe(elenco, filtro) {
  return elenco.flatMap((f) => {
    const r = fs.readFileSync(f, 'utf8').split('\n');
    return r.flatMap((riga, i) => (filtro(riga, i, r) ? [`${path.relative(RADICE, f)}:${i + 1}: ${riga.trim()}`] : []));
  });
}

const SKILL_E_FONDAMENTA = [...file(path.join(RADICE, 'skills')), path.join(RADICE, 'shared', 'fse-foundations.md')];
const TESTI = [...file(path.join(RADICE, 'skills')), ...file(path.join(RADICE, 'shared')), ...file(path.join(RADICE, 'hooks')), path.join(RADICE, 'README.md')];

// Le «Phase 1–5» di fse-theme-setup sono le sue fasi di esecuzione e non rientrano nel modello.
test('skill e fondamenta non citano piani, fasi di piano o decisioni numerate', () => {
  const piano = /decision [0-9]+ of the plan|Phase [0-9]+ M[0-9]+|\bTask [0-9]+\b|docs\/superpowers\/plans|dry run Phase/;
  assert.deepEqual(righe(SKILL_E_FONDAMENTA, (riga) => piano.test(riga)), []);
});

test('nessun residuo del flusso a quattro gate', () => {
  assert.deepEqual(righe(TESTI, (riga) => /gate[- ]4|quattro gate|four gates/i.test(riga)), []);
});

// Una conversazione nuova serve in un caso solo: dopo un aggiornamento del plugin. La frase può
// andare a capo, quindi il caso ammesso si cerca anche nella riga prima e in quella dopo.
test('«conversazione nuova» solo per l\'aggiornamento del plugin', () => {
  const nuova = /new conversation|conversazione nuova|nuova conversazione/i;
  const ammesso = /plugin update|aggiornamento del plugin/i;
  assert.deepEqual(righe(TESTI, (riga, i, tutte) => nuova.test(riga) && !ammesso.test(tutte.slice(Math.max(0, i - 1), i + 2).join(' '))), []);
});
