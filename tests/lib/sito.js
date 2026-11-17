#!/usr/bin/env node
// Sito di prova del plugin wdm-agent: un'installazione di WordPress usa e getta, in una cartella
// e in un database riservati alle prove. Serve solo a chi sviluppa il plugin.
//
//   node tests/lib/sito.js install   scarica WordPress, crea wp-config.php, installa
//   node tests/lib/sito.js reset     svuota la cartella e ricrea vuoto il database
//   node tests/lib/sito.js status    dice cosa c'è nella cartella e nel database
//   node tests/lib/sito.js wp ...    esegue WP-CLI sul sito di prova
//
// I valori della macchina stanno in tests/sito.local.json (non versionato; modello:
// tests/sito.example.json). La variabile WDM_AGENT_SITO indica un file diverso.
// Le prove usano prepara() all'inizio e reset() alla fine: il sito resta vuoto.

const { execFileSync, spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const CHIAVI = ['site', 'url', 'db', 'php', 'socket', 'phar'];
const WP_VERSION = '7.1.3';
const ADMIN = 'testadmin';

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
  if (!path.basename(cfg.site).endsWith('-test') || !cfg.db.endsWith('-test')) {
    throw new Error('configurazione del sito di prova: la cartella "site" e il database "db" devono finire con "-test".');
  }
  for (const nome of ['DESIGN.md', '.git']) {
    if (fs.existsSync(path.join(cfg.site, nome))) {
      throw new Error(`configurazione del sito di prova: ${cfg.site} contiene ${nome}, quindi è un progetto e non si tocca.`);
    }
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
function db(cfg, codice) {
  const php = `mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT); $m = new mysqli('localhost', 'root', 'root', '', 0, $argv[1]); $db = $argv[2]; ${codice}`;
  return execFileSync(cfg.php, ['-r', php, '--', cfg.socket, cfg.db], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 20000 }).trim();
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
  try {
    db(cfg, 'echo 1;');
  } catch (error) {
    return `sito di prova: database non raggiungibile su ${cfg.socket}. Avvia i server di MAMP PRO e riprova.`;
  }
  return null;
}

function installa() {
  const cfg = config();
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
  for (const entry of fs.readdirSync(cfg.site)) {
    fs.rmSync(path.join(cfg.site, entry), { recursive: true, force: true });
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

function stato() {
  const cfg = config();
  return `cartella: ${fs.readdirSync(cfg.site).length} elementi · database: ${tabelle(cfg)} tabelle`;
}

module.exports = { leggiConfig, controlla, nonDisponibile, wp, prepara, reset, stato };

if (require.main === module) {
  const [comando, ...resto] = process.argv.slice(2);
  const comandi = {
    install: () => console.log(`installato: WordPress ${WP_VERSION} su ${installa().url}`),
    reset: () => { reset(); console.log(stato()); },
    status: () => console.log(stato()),
    // Il codice d'uscita di WP-CLI passa così com'è.
    wp: () => { const cfg = config(); process.exitCode = spawnSync(cfg.php, [...argomentiWp(cfg), ...resto], { stdio: 'inherit' }).status; },
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
