#!/usr/bin/env node
// mamp.js — trova MAMP PRO e prepara ciò che serve a WP-CLI nel progetto, senza chiedere nulla.
//
//   node mamp.js --site <site-root> [--db <nome>] [--mamp <cartella>]
//
// In ordine: trova la cartella di MAMP e le versioni di PHP installate; scarica wp-cli.phar
// nella site root se manca; sceglie il PHP più recente con cui WP-CLI parte senza avvisi (può
// essere diverso da quello dell'host: è voluto); prova il database di MAMP; con --db crea il
// database del progetto, se non c'è; scrive `{wp-cli}` (e `{db-socket}` dove c'è un socket) in
// DESIGN.md → Project Config → Paths; prova la riga appena scritta. Su stdout il riepilogo in
// JSON. Si può rilanciare quante volte si vuole.
//
// Database: su macOS per socket, su Windows per porta (127.0.0.1:8889), sempre con l'utente
// predefinito di MAMP (root / root). Un database che esiste già e contiene tabelle può essere di
// un altro progetto: non si usa, non si svuota e non si cancella, a meno che sia quello del
// wp-config.php di questo sito (il rilancio dopo un'interruzione).
//
// Windows: scritto dalla documentazione di MAMP PRO, non ancora provato su una macchina.
//
// Exit: 0 fatto · 1 manca qualcosa che l'utente deve sistemare (il messaggio dice cosa) ·
// 2 errore d'uso.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { imposta, argomenti, comando } = require('../../../shared/scripts/lib/design-md.js');

const PHAR_URL = 'https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar';
const USO = 'uso: node mamp.js --site <site-root> [--db <nome>] [--mamp <cartella-di-MAMP>]';

// ─── Parti che non toccano la macchina (la piattaforma è un argomento) ───────────────────────

const percorsi = (piattaforma) => (piattaforma === 'win32' ? path.win32 : path.posix);
const barre = (percorso) => percorso.replace(/\\/g, '/');

function radiceMamp(piattaforma) {
  return piattaforma === 'win32' ? 'C:\\MAMP' : '/Applications/MAMP';
}

// Gli eseguibili di PHP, dalla versione più recente. `cartelle` è il contenuto di bin/php.
function candidatiPhp(cartelle, radice, piattaforma) {
  const p = percorsi(piattaforma);
  return cartelle
    .map((nome) => /^php(\d+)\.(\d+)\.(\d+)$/.exec(nome))
    .filter(Boolean)
    .sort((a, b) => b[1] - a[1] || b[2] - a[2] || b[3] - a[3])
    .map((m) => (piattaforma === 'win32' ? p.join(radice, 'bin', 'php', m[0], 'php.exe') : p.join(radice, 'bin', 'php', m[0], 'bin', 'php')));
}

function connessione(piattaforma, radice) {
  if (piattaforma === 'win32') return { host: '127.0.0.1', porta: 8889, socket: '' };
  return { host: 'localhost', porta: 0, socket: percorsi(piattaforma).join(radice, 'tmp', 'mysql', 'mysql.sock') };
}

// Il valore di DB_HOST per wp-config.php.
function dbHost(conn) {
  return conn.socket ? conn.host : `${conn.host}:${conn.porta}`;
}

// Su Windows MAMP PRO genera il php.ini a ogni avvio dei server: è quello che attiva mysqli.
function iniDiMampPro(piattaforma) {
  return piattaforma === 'win32' ? 'C:\\Users\\Public\\Documents\\Appsolute\\MAMPPRO\\conf\\php.ini' : null;
}

// Gli argomenti di {wp-cli}. Sempre con la barra in avanti: PHP e WP-CLI la accettano anche su
// Windows, e in Git Bash una barra rovesciata fuori dalle virgolette sparirebbe.
function wpCli({ php, ini, socket, phar, sito }) {
  return [
    barre(php), '-d', 'memory_limit=512M', '-d', 'display_errors=stderr',
    ...(ini ? ['-c', barre(ini)] : []),
    ...(socket ? ['-d', `mysqli.default_socket=${barre(socket)}`] : []),
    barre(phar), `--path=${barre(sito)}`,
  ];
}

// Il nome entra in una query: solo lettere, cifre, trattino e trattino basso.
function nomeDbValido(nome) {
  return /^[A-Za-z0-9_-]+$/.test(nome);
}

// ─── Parti che toccano la macchina ───────────────────────────────────────────────────────────

// Un problema che l'utente può sistemare: messaggio semplice, exit 1, nessuna traccia.
class Fermo extends Error {}

// Scarica in un file provvisorio e rinomina alla fine: un download interrotto non lascia un
// wp-cli.phar a metà, e il rilancio riparte da capo.
async function scarica(url, destinazione) {
  const provvisorio = `${destinazione}.parziale`;
  try {
    const risposta = await fetch(url);
    if (!risposta.ok) throw new Error(`risposta ${risposta.status}`);
    const dati = Buffer.from(await risposta.arrayBuffer());
    const atteso = Number(risposta.headers.get('content-length'));
    if (dati.length === 0 || (atteso && dati.length !== atteso)) throw new Error('file incompleto');
    fs.writeFileSync(provvisorio, dati);
    fs.renameSync(provvisorio, destinazione);
  } catch (errore) {
    fs.rmSync(provvisorio, { force: true });
    throw errore;
  }
}

// Il PHP più recente con cui WP-CLI parte ed è pulito (su un PHP troppo nuovo il phar stampa
// «Deprecated»). null se nessuno va bene.
function scegliPhp(candidati, phar, ini) {
  for (const php of candidati) {
    const r = spawnSync(php, ['-d', 'display_errors=stderr', ...(ini ? ['-c', ini] : []), phar, '--version'], { encoding: 'utf8', timeout: 60000 });
    const uscita = `${r.stdout || ''}${r.stderr || ''}`;
    if (!r.error && r.status === 0 && /WP-CLI/.test(uscita) && !/Deprecated|Warning|Fatal error/.test(uscita)) return php;
  }
  return null;
}

// Esegue un pezzo di PHP collegato al MySQL di MAMP. Lancia se la connessione fallisce.
function sql(php, ini, conn, nome, codice) {
  const sorgente = 'mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);'
    + ' $m = new mysqli($argv[1], "root", "root", "", (int) $argv[2], $argv[3] !== "" ? $argv[3] : null);'
    + ` $db = $argv[4]; ${codice}`;
  const r = spawnSync(php, [...(ini ? ['-c', ini] : []), '-r', sorgente, '--', conn.host, String(conn.porta), conn.socket, nome], { encoding: 'utf8', timeout: 30000 });
  if (r.error || r.status !== 0) throw new Error((r.stderr || r.stdout || (r.error && r.error.message) || '').trim());
  return r.stdout.trim();
}

const TABELLE = '$s = $m->prepare("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?"); $s->bind_param("s", $db); $s->execute(); $tabelle = (int) $s->get_result()->fetch_row()[0];';
const ESISTE = '$s = $m->prepare("SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?"); $s->bind_param("s", $db); $s->execute(); $esiste = (int) $s->get_result()->fetch_row()[0];';

// Crea il database se non c'è. Ritorna 'creato', 'vuoto' (c'era, senza tabelle) o 'del progetto'
// (ha tabelle, ed è quello di wp-config.php). Ogni altro database con tabelle ferma il setup.
function preparaDatabase(php, ini, conn, nome, sito) {
  const stato = JSON.parse(sql(php, ini, conn, nome, `${ESISTE} ${TABELLE} echo json_encode(array("esiste" => $esiste, "tabelle" => $tabelle));`));
  if (stato.tabelle > 0) {
    const config = path.join(sito, 'wp-config.php');
    const suo = fs.existsSync(config) && new RegExp(`define\\(\\s*['"]DB_NAME['"]\\s*,\\s*['"]${nome}['"]\\s*\\)`).test(fs.readFileSync(config, 'utf8'));
    if (suo) return 'del progetto';
    throw new Fermo(`Esiste già un database «${nome}» con ${stato.tabelle} tabelle: può essere di un altro progetto, quindi non lo tocco. Scegli un altro nome per il progetto, oppure elimina quel database da MAMP PRO (phpMyAdmin) se sei sicuro che non serve, e rilancia.`);
  }
  if (stato.esiste) return 'vuoto';
  sql(php, ini, conn, nome, '$m->query("CREATE DATABASE IF NOT EXISTS `$db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");');
  return 'creato';
}

function opzioni(argv) {
  const lette = {};
  for (let i = 0; i < argv.length; i += 2) {
    const nome = argv[i];
    if (!['--site', '--db', '--mamp'].includes(nome)) return { errore: `argomento non riconosciuto: ${nome}` };
    if (argv[i + 1] === undefined || argv[i + 1].startsWith('--')) return { errore: `${nome} vuole un valore` };
    lette[nome.slice(2)] = argv[i + 1];
  }
  if (!lette.site) return { errore: 'manca --site' };
  if (lette.db !== undefined && !nomeDbValido(lette.db)) return { errore: `--db ammette solo lettere, cifre, "-" e "_" (ricevuto: ${lette.db})` };
  return lette;
}

async function main(argv) {
  const opt = opzioni(argv);
  if (opt.errore) {
    console.error(`mamp: ${opt.errore}\n${USO}`);
    return 2;
  }
  const sito = path.resolve(opt.site);
  if (!fs.existsSync(sito) || !fs.statSync(sito).isDirectory()) {
    console.error(`mamp: --site non è una cartella: ${sito}\n${USO}`);
    return 2;
  }

  const piattaforma = process.platform;
  const radice = opt.mamp ? path.resolve(opt.mamp) : radiceMamp(piattaforma);
  const cartellaPhp = path.join(radice, 'bin', 'php');
  const candidati = fs.existsSync(cartellaPhp) ? candidatiPhp(fs.readdirSync(cartellaPhp), radice, piattaforma).filter((php) => fs.existsSync(php)) : [];
  if (candidati.length === 0) {
    throw new Fermo(`Non trovo MAMP PRO su questo computer (cercato in ${radice}). Installa MAMP PRO, crea l'host del sito e rilancia.`);
  }

  const phar = path.join(sito, 'wp-cli.phar');
  if (!fs.existsSync(phar)) {
    try {
      await scarica(PHAR_URL, phar);
    } catch (errore) {
      throw new Fermo(`Non riesco a scaricare WP-CLI (${errore.message}). Controlla la connessione a internet e rilancia: il download riparte da capo.`);
    }
  }

  const iniMamp = iniDiMampPro(piattaforma);
  const ini = iniMamp && fs.existsSync(iniMamp) ? iniMamp : null;
  const php = scegliPhp(candidati, phar, ini);
  if (!php) {
    throw new Fermo(`Nessuna versione di PHP di MAMP avvia WP-CLI senza errori (provate: ${candidati.map((c) => path.basename(path.dirname(piattaforma === 'win32' ? c : path.dirname(c)))).join(', ')}). Cancella wp-cli.phar dalla cartella del sito e rilancia: verrà scaricato di nuovo. Se non basta, aggiorna MAMP PRO.`);
  }

  const conn = connessione(piattaforma, radice);
  try {
    sql(php, ini, conn, '', 'echo 1;');
  } catch (errore) {
    // Il caso vero è MAMP con i server fermi. Per ogni altro (su Windows: PHP senza l'estensione
    // del database) resta il dettaglio, da riferire: da qui non si ripara in automatico.
    const dettaglio = errore.message.split('\n')[0].replace(/^(PHP )?Fatal error:\s+Uncaught\s+/, '').slice(0, 200);
    throw new Fermo(`Il database di MAMP PRO non risponde. Avvia i server di MAMP PRO (pulsante Start) e rilancia. Se i server sono già avviati e questo messaggio torna, il collegamento al database non si può preparare in automatico: riferisci a chi segue il progetto questo dettaglio: ${dettaglio}`);
  }
  const database = opt.db ? { nome: opt.db, stato: preparaDatabase(php, ini, conn, opt.db, sito) } : null;

  const riga = comando(wpCli({ php, ini, socket: conn.socket, phar, sito }));
  const design = path.join(sito, 'DESIGN.md');
  let designMd = 'assente';
  if (fs.existsSync(design)) {
    let testo = fs.readFileSync(design, 'utf8');
    try {
      if (conn.socket) testo = imposta(testo, '{db-socket}', barre(conn.socket));
      testo = imposta(testo, '{wp-cli}', riga);
    } catch (errore) {
      throw new Fermo(`${errore.message} Scrivi prima DESIGN.md → Project Config con le tabelle Identity e Paths, poi rilancia.`);
    }
    fs.writeFileSync(design, testo);
    designMd = 'scritto';
  }

  // La prova si fa sulla riga scritta, riletta: è quella che useranno le skill.
  const [eseguibile, ...resto] = argomenti(riga);
  const prova = spawnSync(eseguibile, [...resto, '--version'], { encoding: 'utf8', timeout: 60000 });
  if (prova.error || prova.status !== 0) {
    throw new Fermo(`La riga {wp-cli} composta non parte (${(prova.stderr || (prova.error && prova.error.message) || '').trim().split('\n')[0]}). Rilancia; se il problema resta, cancella wp-cli.phar dalla cartella del sito e rilancia.`);
  }

  process.stdout.write(JSON.stringify({
    mamp: radice,
    php,
    wpCliVersione: prova.stdout.trim(),
    dbHost: dbHost(conn),
    dbSocket: conn.socket || null,
    database,
    wpCli: riga,
    designMd,
  }, null, 2) + '\n');
  return 0;
}

module.exports = { radiceMamp, candidatiPhp, connessione, dbHost, iniDiMampPro, wpCli, nomeDbValido, scarica };

if (require.main === module) {
  main(process.argv.slice(2)).then((codice) => { process.exitCode = codice; }, (errore) => {
    if (errore instanceof Fermo) console.error(errore.message);
    else console.error(`mamp: errore imprevisto: ${errore.stack || errore}`);
    process.exitCode = 1;
  });
}
