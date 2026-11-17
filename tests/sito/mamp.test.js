// mamp.js sul MAMP PRO di questa macchina: trova PHP e database da solo, scrive in DESIGN.md una
// riga {wp-cli} che funziona anche con spazi nel percorso, crea il database del progetto e non
// tocca quello di un altro (D1, U13, U42). Lavora in cartelle temporanee e su database di prova.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const sito = require('../lib/sito');
const { RADICE, assoluto } = require('../lib/citati');
const { valore, argomenti } = require(path.join(RADICE, 'shared', 'scripts', 'lib', 'design-md.js'));

const SCRIPT = assoluto('skills/fse-theme-setup/scripts/mamp.js');

describe('mamp.js sul MAMP PRO di questa macchina', { skip: sito.nonDisponibile() || false }, () => {
  let cfg, tmp, progetto, db;

  const mamp = (...args) => {
    const r = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
    return { status: r.status, stdout: r.stdout, stderr: r.stderr };
  };
  // Una site root nuova, in una cartella con spazi, con wp-cli.phar già presente (niente rete).
  const sitoNuovo = (nome, conDesign = true) => {
    const dir = path.join(tmp, 'Mario Rossi', nome);
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(cfg.phar, path.join(dir, 'wp-cli.phar'));
    if (conDesign) sito.copiaBase(dir, (relativo) => relativo === 'DESIGN.md');
    return dir;
  };

  before(() => {
    cfg = sito.leggiConfig();
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wdm-agent-mamp-'));
    progetto = sitoNuovo('il sito');
    db = sito.databaseDiProva(`${cfg.db}-setup-test`);
    db.elimina();
  });

  after(() => {
    if (db) db.elimina();
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('trova MAMP, sceglie il PHP e scrive {wp-cli} e {db-socket} in DESIGN.md', () => {
    const r = mamp('--site', progetto);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const esito = JSON.parse(r.stdout);
    assert.equal(esito.designMd, 'scritto');
    assert.equal(esito.database, null);
    assert.equal(esito.dbHost, 'localhost');
    const design = fs.readFileSync(path.join(progetto, 'DESIGN.md'), 'utf8');
    assert.equal(valore(design, '{wp-cli}'), esito.wpCli);
    assert.equal(valore(design, '{db-socket}'), esito.dbSocket);
    assert.match(esito.wpCli, /-d display_errors=stderr/);
    assert.ok(esito.wpCli.includes(`"--path=${progetto}"`), esito.wpCli);
  });

  it('la riga scritta, letta da DESIGN.md e lanciata senza shell, risponde senza avvisi di PHP', () => {
    const [php, ...resto] = argomenti(valore(fs.readFileSync(path.join(progetto, 'DESIGN.md'), 'utf8'), '{wp-cli}'));
    const r = spawnSync(php, [...resto, '--info'], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.doesNotMatch(r.stdout + r.stderr, /Deprecated|Warning/);
    assert.ok(resto.includes(`--path=${progetto}`), 'il percorso con spazi non è arrivato intero');
  });

  it('la stessa riga incollata in bash funziona (è così che la usano le skill)', () => {
    const riga = valore(fs.readFileSync(path.join(progetto, 'DESIGN.md'), 'utf8'), '{wp-cli}');
    const r = spawnSync('bash', ['-c', `${riga} --version`], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /^WP-CLI /);
  });

  it('senza DESIGN.md: non lo crea, e il riepilogo porta la riga da scrivere', () => {
    const dir = sitoNuovo('senza design', false);
    const r = mamp('--site', dir);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(JSON.parse(r.stdout).designMd, 'assente');
    assert.ok(!fs.existsSync(path.join(dir, 'DESIGN.md')));
  });

  it('MAMP con i server fermi: «Avvia i server di MAMP PRO», exit 1, niente stack', () => {
    // Un MAMP finto: lo stesso PHP (richiamato da uno script), ma nessun socket del database.
    const finto = path.join(tmp, 'MAMP finto');
    const bin = path.join(finto, 'bin', 'php', 'php8.4.99', 'bin');
    fs.mkdirSync(bin, { recursive: true });
    fs.writeFileSync(path.join(bin, 'php'), `#!/bin/sh\nexec "${cfg.php}" "$@"\n`, { mode: 0o755 });
    const r = mamp('--site', progetto, '--mamp', finto);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stderr, /Avvia i server di MAMP PRO/);
    assert.doesNotMatch(r.stderr, /\bat .*\.js:\d+|mysqli/);
    assert.equal(r.stdout, '');
  });

  it('un database che non esiste: lo crea, utf8mb4_unicode_ci', () => {
    const r = mamp('--site', progetto, '--db', db.nome);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.deepEqual(JSON.parse(r.stdout).database, { nome: db.nome, stato: 'creato' });
    assert.equal(db.collazione(), 'utf8mb4_unicode_ci');
  });

  it('rilancio con il database vuoto: lo usa', () => {
    const r = mamp('--site', progetto, '--db', db.nome);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(JSON.parse(r.stdout).database.stato, 'vuoto');
  });

  it('un database con tabelle di un altro progetto: si ferma e non lo tocca', () => {
    db.creaTabella();
    const r = mamp('--site', progetto, '--db', db.nome);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stderr, /non lo tocco/);
    assert.match(r.stderr, new RegExp(db.nome));
    assert.equal(r.stdout, '');
    assert.equal(db.tabelle(), 1);
  });

  it('lo stesso database, ma è quello del wp-config.php di questo sito: è una ripresa, prosegue', () => {
    fs.writeFileSync(path.join(progetto, 'wp-config.php'), `<?php\ndefine( 'DB_NAME', '${db.nome}' );\n`);
    const r = mamp('--site', progetto, '--db', db.nome);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(JSON.parse(r.stdout).database.stato, 'del progetto');
    assert.equal(db.tabelle(), 1);
  });
});
