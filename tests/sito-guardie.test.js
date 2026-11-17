// Il reset del sito di prova cancella una cartella e un database: le guardie devono rifiutare
// tutto ciò che non è un sito di prova. Qui non si tocca né il disco né il database.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const sito = require('./lib/sito');

function cartella(nome) {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wdm-agent-guardie-')), nome);
  fs.mkdirSync(dir);
  return dir;
}

function config(valori) {
  return { site: cartella('prova-test'), url: 'http://localhost', db: 'prova-test', php: 'php', socket: '/tmp/mysql.sock', phar: 'wp-cli.phar', ...valori };
}

test('una cartella e un database che finiscono con -test passano', () => {
  assert.doesNotThrow(() => sito.controlla(config({})));
});

test('cartella senza -test: rifiutata', () => {
  assert.throws(() => sito.controlla(config({ site: cartella('il-mio-sito') })), /-test/);
});

test('database senza -test: rifiutato', () => {
  assert.throws(() => sito.controlla(config({ db: 'il-mio-sito' })), /-test/);
});

test('cartella relativa: rifiutata', () => {
  assert.throws(() => sito.controlla(config({ site: 'prova-test' })), /assolut/);
});

test('cartella con un DESIGN.md o un .git (un progetto): rifiutata', () => {
  for (const nome of ['DESIGN.md', '.git']) {
    const site = cartella('progetto-test');
    fs.writeFileSync(path.join(site, nome), '');
    assert.throws(() => sito.controlla(config({ site })), /progetto/);
  }
});

test('una chiave mancante: rifiutata, con il nome della chiave', () => {
  const cfg = config({});
  delete cfg.socket;
  assert.throws(() => sito.controlla(cfg), /socket/);
});

// La configurazione si legge al momento della chiamata: un processo figlio con WDM_AGENT_SITO.
function conConfig(file, codice) {
  return spawnSync(process.execPath, ['-e', codice], {
    encoding: 'utf8',
    env: { ...process.env, WDM_AGENT_SITO: file, SITO: path.join(__dirname, 'lib', 'sito.js') },
  });
}

test('configurazione assente: nonDisponibile() dice cosa fare, senza eccezioni', () => {
  const r = conConfig(path.join(os.tmpdir(), 'wdm-agent-inesistente.json'), 'console.log(require(process.env.SITO).nonDisponibile())');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /sito\.example\.json/);
});

test('configurazione che punta a un progetto: il reset da riga di comando si rifiuta', () => {
  const site = cartella('progetto-test');
  fs.writeFileSync(path.join(site, 'DESIGN.md'), 'da non cancellare');
  const file = path.join(path.dirname(site), 'sito.json');
  fs.writeFileSync(file, JSON.stringify(config({ site })));
  const r = spawnSync(process.execPath, [path.join(__dirname, 'lib', 'sito.js'), 'reset'], { encoding: 'utf8', env: { ...process.env, WDM_AGENT_SITO: file } });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.equal(fs.readFileSync(path.join(site, 'DESIGN.md'), 'utf8'), 'da non cancellare');
});
