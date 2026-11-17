// SKIP non è PASS (U11): l'esecutore dice «TUTTO VERDE» solo se ogni prova è stata eseguita ed
// è passata. Qui lo si lancia su cartelle di fixture e si guarda verdetto e codice d'uscita.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const RUN = path.join(__dirname, 'run.js');
const FIXTURE = path.join(__dirname, 'fixtures', 'esecutore');

function esegui(cartella, ...args) {
  // Dentro una prova NODE_TEST_CONTEXT è impostata, e con quella un secondo esecutore non
  // lancerebbe nessun file.
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, [RUN, '--radice', path.join(FIXTURE, cartella), ...args], { encoding: 'utf8', env });
  const out = r.stdout + r.stderr;
  return { status: r.status, out, verdetto: out.trim().split('\n').filter((l) => /VERDE/.test(l)) };
}

test('tutte passate: TUTTO VERDE, exit 0', () => {
  const r = esegui('verde');
  assert.equal(r.status, 0, r.out);
  assert.equal(r.verdetto.length, 1, r.out);
  assert.match(r.verdetto[0], /^TUTTO VERDE: 2 prove/);
});

test('un gruppo escluso con --senza: VERDE IN PARTE, il gruppo è nominato', () => {
  const r = esegui('verde', '--senza', 'extra');
  assert.equal(r.status, 0, r.out);
  assert.doesNotMatch(r.out, /TUTTO VERDE/);
  assert.match(r.verdetto[0], /^VERDE IN PARTE: 1 prov[ae].*extra/);
});

test('prove saltate o da fare: NON VERDE, exit 1, con file e motivo', () => {
  const r = esegui('salto');
  assert.equal(r.status, 1, r.out);
  assert.equal(r.verdetto.length, 1, r.out);
  assert.match(r.verdetto[0], /^NON VERDE: 0 fallite, 4 saltate/);
  for (const motivo of ['motivo uno', 'motivo due', 'motivo tre', 'motivo quattro']) {
    assert.ok(r.out.includes(`a.test.js`) && r.out.split('NON VERDE')[1].includes(motivo), `manca «${motivo}» nell'elenco: ${r.out}`);
  }
});

test('una prova fallita: NON VERDE, exit 1', () => {
  const r = esegui('rosso');
  assert.equal(r.status, 1, r.out);
  assert.match(r.verdetto[0], /^NON VERDE: 1 fallit[ae], 0 saltate/);
});

test('nessuna prova trovata: NON VERDE, exit 1', () => {
  const r = esegui('vuota');
  assert.equal(r.status, 1, r.out);
  assert.match(r.verdetto[0], /^NON VERDE: nessuna prova/);
});

test('--senza con un gruppo che non esiste: errore d\'uso, exit 2', () => {
  const r = esegui('verde', '--senza', 'inesistente');
  assert.equal(r.status, 2, r.out);
  assert.match(r.out, /inesistente/);
  assert.doesNotMatch(r.out, /VERDE/);
});
