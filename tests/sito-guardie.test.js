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
  return { site: cartella('prova-test'), url: 'http://localhost', db: 'prova-test', php: 'php', socket: path.join(os.tmpdir(), 'wdm-agent-nessun-socket.sock'), phar: 'wp-cli.phar', ...valori };
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

test('nome del database con caratteri che uscirebbero dalla query: rifiutato', () => {
  for (const db of ['lavoro` -- -test', 'a b-test', '-test', 'riga\nnuova-test']) {
    assert.throws(() => sito.controlla(config({ db })), /db/, JSON.stringify(db));
  }
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

// Il nome non basta: un sito vero può chiamarsi cliente-test. Il reset tocca solo una cartella
// vuota o una che porta il segno lasciato dalle prove.
function resetDaRigaDiComando(site) {
  const file = path.join(path.dirname(site), 'sito.json');
  fs.writeFileSync(file, JSON.stringify(config({ site })));
  return spawnSync(process.execPath, [path.join(__dirname, 'lib', 'sito.js'), 'reset'], { encoding: 'utf8', env: { ...process.env, WDM_AGENT_SITO: file } });
}

test('cartella non vuota senza il segno del sito di prova: il reset si rifiuta e non cancella', () => {
  const site = cartella('cliente-test');
  fs.writeFileSync(path.join(site, 'wp-config.php'), 'da non cancellare');
  const r = resetDaRigaDiComando(site);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.ok(r.stderr.includes(sito.SEGNO), r.stderr);
  assert.equal(fs.readFileSync(path.join(site, 'wp-config.php'), 'utf8'), 'da non cancellare');
});

test('collegamento simbolico verso una cartella senza il segno: il reset non la svuota', () => {
  const vera = cartella('documenti');
  fs.writeFileSync(path.join(vera, 'importante.txt'), 'da non cancellare');
  const site = path.join(path.dirname(vera), 'link-test');
  fs.symlinkSync(vera, site, 'dir');
  const r = resetDaRigaDiComando(site);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.equal(fs.readFileSync(path.join(vera, 'importante.txt'), 'utf8'), 'da non cancellare');
});

test('cartella con il segno: il reset la svuota e lascia il segno', () => {
  const site = cartella('prova-test');
  fs.writeFileSync(path.join(site, sito.SEGNO), '');
  fs.writeFileSync(path.join(site, 'wp-config.php'), 'residuo di una prova');
  resetDaRigaDiComando(site); // poi fallisce sul database, che qui non esiste
  assert.deepEqual(fs.readdirSync(site), [sito.SEGNO]);
});

test('wp da riga di comando con un PHP che non esiste: non esce con 0', () => {
  const site = cartella('prova-test');
  const file = path.join(path.dirname(site), 'sito.json');
  fs.writeFileSync(file, JSON.stringify(config({ site, php: path.join(site, 'php-che-non-esiste') })));
  const r = spawnSync(process.execPath, [path.join(__dirname, 'lib', 'sito.js'), 'wp', 'option', 'get', 'home'], { encoding: 'utf8', env: { ...process.env, WDM_AGENT_SITO: file } });
  assert.notEqual(r.status, 0, r.stdout + r.stderr);
});
