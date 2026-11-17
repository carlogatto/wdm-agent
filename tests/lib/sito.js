#!/usr/bin/env node
// Sito di prova del plugin wdm-agent: un'installazione di WordPress usa e getta, in una cartella
// e in un database riservati alle prove, più una copia del tema base (wdm-theme) su cui provare
// setup, controlli e build. Serve solo a chi sviluppa il plugin.
//
//   node tests/lib/sito.js install   scarica WordPress, crea wp-config.php, installa
//   node tests/lib/sito.js reset     svuota la cartella e ricrea vuoto il database
//   node tests/lib/sito.js status    dice cosa c'è nella cartella e nel database
//   node tests/lib/sito.js wp ...    esegue WP-CLI sul sito di prova
//
// I valori della macchina stanno in tests/sito.local.json (non versionato; modello:
// tests/sito.example.json). La variabile WDM_AGENT_SITO indica un file diverso.
// Le prove usano prepara() all'inizio e reset() alla fine: il sito resta vuoto. Il tema base
// (chiave "base": la site root del repo wdm-theme) si legge soltanto: copiaBase() ne fa una copia.

const { execFileSync, spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const CHIAVI = ['site', 'url', 'db', 'php', 'socket', 'phar', 'base'];
const TEMA_BASE = path.join('wp-content', 'themes', 'wdm-theme');
const WP_VERSION = '7.1.3';
const ADMIN = 'testadmin';
// File che le prove lasciano nella cartella del sito di prova: è ciò che autorizza a svuotarla.
const SEGNO = '.wdm-agent-sito-di-prova';

function fileConfig() {
  return process.env.WDM_AGENT_SITO || path.join(__dirname, '..', 'sito.local.json');
}

function leggiConfig() {
  const file = fileConfig();
  if (!fs.existsSync(file)) {
    throw new Error(`manca la configurazione del sito di prova (${file}): copia tests/sito.example.json in tests/sito.local.json e scrivi i valori di questa macchina.`);
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`la configurazione del sito di prova (${file}) non è JSON valido: ${error.message}`);
  }
}

// Il reset cancella: cartella e database devono essere quelli di prova, mai un progetto.
function controlla(cfg) {
  for (const chiave of CHIAVI) {
    if (typeof cfg[chiave] !== 'string' || cfg[chiave] === '') {
      throw new Error(`configurazione del sito di prova: manca "${chiave}".`);
    }
  }
  if (!path.isAbsolute(cfg.site)) {
    throw new Error(`configurazione del sito di prova: "site" deve essere un percorso assoluto (${cfg.site}).`);
  }
  if (!path.basename(cfg.site).endsWith('-test')) {
    throw new Error('configurazione del sito di prova: la cartella "site" deve finire con "-test".');
  }
  // Il nome entra in una query: solo lettere, cifre, trattino e trattino basso.
  if (!/^[A-Za-z0-9_-]+-test$/.test(cfg.db)) {
    throw new Error('configurazione del sito di prova: "db" deve finire con "-test" e contenere solo lettere, cifre, "-" e "_".');
  }
  // Un repo non è mai il sito di prova. Un DESIGN.md sì, ma solo se ce l'ha messo una prova
  // (la copia del tema base): lo dice il segno lasciato nella cartella.
  if (fs.existsSync(path.join(cfg.site, '.git')) || (fs.existsSync(path.join(cfg.site, 'DESIGN.md')) && !fs.existsSync(path.join(cfg.site, SEGNO)))) {
    throw new Error(`configurazione del sito di prova: ${cfg.site} contiene un repo o un DESIGN.md senza il segno del sito di prova, quindi è un progetto e non si tocca.`);
  }
  // Il tema base si copia e basta: non può essere la cartella che le prove svuotano.
  if (!path.isAbsolute(cfg.base) || path.resolve(cfg.base) === path.resolve(cfg.site)) {
    throw new Error(`configurazione del sito di prova: "base" deve essere il percorso assoluto della site root di wdm-theme, diverso da "site" (${cfg.base}).`);
  }
  return cfg;
}

function config() {
  return controlla(leggiConfig());
}

function argomentiWp(cfg) {
  return ['-d', 'memory_limit=512M', '-d', `mysqli.default_socket=${cfg.socket}`, cfg.phar, `--path=${cfg.site}`];
}

// WP-CLI sul sito di prova. Non lancia: le prove leggono codice d'uscita e testo.
function wp(args, options = {}) {
  const cfg = config();
  const r = spawnSync(cfg.php, [...argomentiWp(cfg), ...args], { encoding: 'utf8', ...options });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '', out: (r.stdout || '') + (r.stderr || '') };
}

function wpRiuscito(args, options) {
  const r = wp(args, options);
  if (r.status !== 0) throw new Error(`wp ${args.join(' ')}: exit ${r.status}\n${r.out}`);
  return r.stdout;
}

// Il client mysql può non essere nel PATH: il database si raggiunge dal PHP della configurazione.
function db(cfg, codice, nome = cfg.db) {
  const php = `mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT); $m = new mysqli('localhost', 'root', 'root', '', 0, $argv[1]); $db = $argv[2]; ${codice}`;
  return execFileSync(cfg.php, ['-r', php, '--', cfg.socket, nome], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 20000 }).trim();
}

// Un database in più per le prove che ne creano uno (il setup). Stessa guardia del database del
// sito di prova: il nome finisce con -test, così nessuna prova può toccare quello di un progetto.
function databaseDiProva(nome) {
  if (!/^[A-Za-z0-9_-]+-test$/.test(nome)) throw new Error(`database di prova: il nome deve finire con "-test" (${nome}).`);
  const cfg = config();
  return {
    nome,
    elimina: () => db(cfg, '$m->query("DROP DATABASE IF EXISTS `$db`");', nome),
    collazione: () => db(cfg, '$s = $m->prepare("SELECT DEFAULT_COLLATION_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?"); $s->bind_param("s", $db); $s->execute(); $r = $s->get_result()->fetch_row(); echo $r ? $r[0] : "";', nome),
    tabelle: () => Number(db(cfg, '$s = $m->prepare("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?"); $s->bind_param("s", $db); $s->execute(); echo $s->get_result()->fetch_row()[0];', nome)),
    creaTabella: () => db(cfg, '$m->select_db($db); $m->query("CREATE TABLE dati_di_un_altro_progetto (id INT)");', nome),
  };
}

function tabelle(cfg) {
  return Number(db(cfg,
    '$s = $m->prepare("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?");'
    + ' $s->bind_param("s", $db); $s->execute(); echo $s->get_result()->fetch_row()[0];'
  ));
}

// null se il sito di prova si può usare, altrimenti il motivo. Le prove del gruppo sito lo
// passano a `skip`: l'esecutore conta il salto e non dà il verde.
function nonDisponibile() {
  let cfg;
  try {
    cfg = config();
  } catch (error) {
    return error.message;
  }
  for (const chiave of ['php', 'phar', 'site']) {
    if (!fs.existsSync(cfg[chiave])) return `sito di prova: ${chiave} non trovato (${cfg[chiave]}).`;
  }
  if (!fs.existsSync(path.join(cfg.base, TEMA_BASE, 'theme.json'))) {
    return `sito di prova: in "base" (${cfg.base}) non c'è il tema base ${TEMA_BASE}.`;
  }
  try {
    db(cfg, 'echo 1;');
  } catch (error) {
    return `sito di prova: database non raggiungibile su ${cfg.socket}. Avvia i server di MAMP PRO e riprova.`;
  }
  return null;
}

// Il nome della cartella non basta: un sito vero può chiamarsi cliente-test. Si scrive e si
// cancella solo in una cartella vuota, o in una che porta il segno lasciato da un lancio precedente.
function voci(cfg) {
  const trovate = fs.readdirSync(cfg.site);
  if (trovate.length > 0 && !trovate.includes(SEGNO)) {
    throw new Error(`${cfg.site} non è vuota e non porta il segno del sito di prova (${SEGNO}): non la tocco. Se è davvero la cartella del sito di prova, svuotala a mano e rilancia.`);
  }
  fs.writeFileSync(path.join(cfg.site, SEGNO), 'Cartella del sito di prova del plugin wdm-agent: le prove la svuotano.\n');
  return trovate.filter((voce) => voce !== SEGNO);
}

function installa() {
  const cfg = config();
  voci(cfg);
  if (fs.existsSync(path.join(cfg.site, 'wp-load.php')) || tabelle(cfg) > 0) {
    throw new Error('il sito di prova non è vuoto. Lancia prima "reset".');
  }
  // L'index.php segnaposto di MAMP PRO viene sostituito da quello di WordPress.
  wpRiuscito(['core', 'download', `--version=${WP_VERSION}`, '--locale=it_IT', '--quiet']);
  wpRiuscito(
    ['config', 'create', `--dbname=${cfg.db}`, '--dbuser=root', '--dbpass=root', '--dbhost=localhost',
      '--dbcharset=utf8mb4', '--extra-php', '--quiet'],
    { input: "define( 'WP_DEBUG', true );\ndefine( 'WP_DEBUG_DISPLAY', false );\ndefine( 'WP_DEBUG_LOG', true );\ndefine( 'WP_DEVELOPMENT_MODE', 'theme' );\n" }
  );
  // Password casuale e mai stampata: nel backend si entra con una sessione temporanea.
  wpRiuscito(['core', 'install', `--url=${cfg.url}`, '--title=wdm-agent test', `--admin_user=${ADMIN}`,
    `--admin_password=${crypto.randomBytes(24).toString('base64url')}`,
    '--admin_email=admin@example.com', '--skip-email', '--quiet']);
  return cfg;
}

function reset() {
  const cfg = config();
  for (const voce of voci(cfg)) {
    fs.rmSync(path.join(cfg.site, voce), { recursive: true, force: true });
  }
  db(cfg, '$m->query("DROP DATABASE IF EXISTS `$db`");'
    + ' $m->query("CREATE DATABASE `$db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");');
  return cfg;
}

// Punto di partenza di ogni prova che scrive: qualunque cosa ci fosse, sito appena installato.
function prepara() {
  reset();
  return installa();
}

// Copia in `destinazione` ciò che un clone del tema base conterrebbe: i file tracciati e quelli
// nuovi non ignorati, nello stato in cui sono ora su disco. `tieni(relativo)` filtra.
function copiaBase(destinazione, tieni = () => true) {
  const cfg = config();
  const elenco = execFileSync('git', ['-C', cfg.base, 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  for (const relativo of elenco.split('\0').filter(Boolean)) {
    const origine = path.join(cfg.base, ...relativo.split('/'));
    if (!tieni(relativo) || !fs.existsSync(origine)) continue;
    const copia = path.join(destinazione, ...relativo.split('/'));
    fs.mkdirSync(path.dirname(copia), { recursive: true });
    fs.copyFileSync(origine, copia);
  }
  return path.join(destinazione, TEMA_BASE);
}

// Le dipendenze npm del tema base, collegate in una copia: evita un `npm ci` per ogni prova.
// Solo nelle prove: il codice consegnato non usa collegamenti simbolici.
function collegaModuli(tema) {
  const moduli = path.join(config().base, TEMA_BASE, 'node_modules');
  if (!fs.existsSync(moduli)) throw new Error(`nel tema base manca node_modules (${moduli}): lancia npm install nel tema.`);
  fs.symlinkSync(moduli, path.join(tema, 'node_modules'), 'dir');
}

function stato() {
  const cfg = config();
  return `cartella: ${fs.readdirSync(cfg.site).filter((voce) => voce !== SEGNO).length} elementi · database: ${tabelle(cfg)} tabelle`;
}

module.exports = { SEGNO, TEMA_BASE, databaseDiProva, leggiConfig, controlla, nonDisponibile, wp, prepara, reset, stato, copiaBase, collegaModuli };

if (require.main === module) {
  const [comando, ...resto] = process.argv.slice(2);
  const comandi = {
    install: () => console.log(`installato: WordPress ${WP_VERSION} su ${installa().url}`),
    reset: () => { reset(); console.log(stato()); },
    status: () => console.log(stato()),
    // Il codice d'uscita di WP-CLI passa così com'è; se PHP non parte è un errore.
    wp: () => {
      const cfg = config();
      const r = spawnSync(cfg.php, [...argomentiWp(cfg), ...resto], { stdio: 'inherit' });
      if (r.error) throw new Error(`PHP non parte (${cfg.php}): ${r.error.message}`);
      process.exitCode = r.status === null ? 1 : r.status;
    },
  };
  if (!comandi[comando]) {
    console.error('Uso: node tests/lib/sito.js install | reset | status | wp <comando>');
    process.exit(2);
  }
  try {
    comandi[comando]();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
