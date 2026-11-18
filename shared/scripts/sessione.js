#!/usr/bin/env node
// Login dell'agente nel backend senza password: una sessione temporanea di WordPress, creata con
// WP-CLI per l'utente agente e sempre revocata.
//
//   node sessione.js apri   <site-root> <modello.js> [nome=valore …]
//   node sessione.js chiudi <site-root>
//
// apri   → chiude le sessioni rimaste, ne apre una di 15 minuti e scrive
//          <site-root>/.playwright-mcp/_run.js: il modello con i cookie di accesso al posto di
//          /*COOKIES*/ e i valori al posto dei segnaposto {{nome}} (nel modello stanno sempre
//          dentro una stringa tra apici singoli). Sempre disponibili:
//          {{local-url}} (senza barra finale), {{prefix}}, {{shots}} (cartella degli screenshot).
//          Gli altri si passano come nome=valore. Quel file si esegue con Playwright MCP
//          (browser_run_code_unsafe, filename), poi si lancia `chiudi`.
// chiudi → revoca ogni sessione dell'utente agente, toglie i blocchi di modifica che il suo
//          browser ha lasciato sulle pagine e cancella _run.js. Va lanciato dopo ogni
//          esecuzione, anche fallita. Ciò che resta aperto lo chiude l'hook del plugin a fine
//          turno (hooks/chiudi-sessione.js), che riconosce una sessione aperta dal file
//          .playwright-mcp/_sessione.json; in ogni caso la sessione scade da sola.
//
// Utente e comandi vengono da DESIGN.md → Project Config: {agent-admin-user}, {wp-cli},
// {local-url}. Nessuna password, in nessun file.
// Exit: 0 ok · 1 errore, con cosa fare · 2 uso.

'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const { valore, eFse, argomenti } = require('./lib/design-md.js');

const PHP = path.join(__dirname, 'sessione.php');
const USO = 'uso: node sessione.js apri <site-root> <modello.js> [nome=valore …] | chiudi <site-root>';

class Errore extends Error {}

function cartella(sito) {
  return path.join(sito, '.playwright-mcp');
}

function file(sito) {
  return { run: path.join(cartella(sito), '_run.js'), segno: path.join(cartella(sito), '_sessione.json') };
}

// Ciò che serve di DESIGN.md, o un errore che dice cosa manca.
function progetto(sito) {
  const designMd = path.join(sito, 'DESIGN.md');
  if (!fs.existsSync(designMd)) throw new Errore(`In ${sito} non c'è DESIGN.md: non è la cartella di un progetto.`);
  const design = fs.readFileSync(designMd, 'utf8');
  if (!eFse(design)) throw new Errore(`${designMd} non è di un progetto wdm-theme (riga theme_family).`);
  const leggi = (nome) => {
    const v = valore(design, nome);
    if (!v) throw new Errore(`In DESIGN.md → Project Config manca la riga \`${nome}\`: la scrive il setup del progetto (fse-theme-setup).`);
    return v;
  };
  return { utente: leggi('{agent-admin-user}'), wp: argomenti(leggi('{wp-cli}')), url: leggi('{local-url}').replace(/\/+$/, ''), prefisso: leggi('{prefix}') };
}

// Lancia sessione.php con la riga {wp-cli}, senza shell. Restituisce il JSON stampato.
function wp(p, comando) {
  const [php, ...resto] = p.wp;
  const r = spawnSync(php, [...resto, 'eval-file', PHP, comando, p.utente], { encoding: 'utf8', timeout: 60000 });
  if (r.error || r.status !== 0) {
    const dettaglio = r.error ? r.error.message : (r.stderr || r.stdout || '').trim();
    const mio = /^sessione: /m.test(dettaglio);
    throw new Errore(mio ? dettaglio.replace(/^sessione: /m, '') : `WordPress non risponde: avvia i server di MAMP PRO e riprova.\n${dettaglio}`);
  }
  try {
    return JSON.parse(r.stdout.trim().split('\n').pop());
  } catch {
    throw new Errore(`risposta di WordPress non leggibile: ${r.stdout.trim().slice(0, 300)}`);
  }
}

// Nei modelli un segnaposto sta sempre dentro una stringa JS tra apici singoli: il valore si
// scrive in modo che la stringa resti quella (un JSON con virgolette e apostrofi compreso).
function inStringa(valore) {
  return String(valore).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, '\\n');
}

// Il modello con i valori al posto dei segnaposto. Un segnaposto senza valore è un errore.
function componi(modello, valori, cookie) {
  if (!modello.includes('/*COOKIES*/')) throw new Errore('il modello non ha il segnaposto /*COOKIES*/: senza, il browser non entra nel backend.');
  const mancanti = new Set();
  const testo = modello.replace(/\{\{([a-z][a-z0-9-]*)\}\}/g, (tutto, nome) => {
    if (nome in valori) return inStringa(valori[nome]);
    mancanti.add(nome);
    return tutto;
  });
  if (mancanti.size) throw new Errore(`il modello chiede ${[...mancanti].map((n) => `{{${n}}}`).join(', ')}: aggiungi ${[...mancanti].map((n) => `${n}=valore`).join(' ')} al comando.`);
  return testo.replace('/*COOKIES*/', () => JSON.stringify(cookie));
}

function apri(sito, modelloFile, coppie) {
  const p = progetto(sito);
  if (!fs.existsSync(modelloFile)) throw new Errore(`modello non trovato: ${modelloFile}`);
  const valori = { 'local-url': p.url, prefix: p.prefisso, shots: path.join(cartella(sito), 'shots').split(path.sep).join('/') };
  for (const coppia of coppie) {
    const m = /^([a-z][a-z0-9-]*)=([\s\S]*)$/.exec(coppia);
    if (!m) throw new Errore(`argomento non valido: ${coppia} (atteso nome=valore)`);
    valori[m[1]] = m[2];
  }
  const modello = fs.readFileSync(modelloFile, 'utf8');
  componi(modello, valori, []);   // tutto ciò che può fallire, prima di creare la sessione
  const f = file(sito);
  const sessione = wp(p, 'crea');
  try {
    fs.mkdirSync(path.join(cartella(sito), 'shots'), { recursive: true });
    fs.writeFileSync(f.segno, JSON.stringify({ utente: p.utente, scade: sessione.scade }) + '\n');
    fs.writeFileSync(f.run, componi(modello, valori, sessione.cookies));
  } catch (errore) {
    // La sessione esiste già: non può restare aperta se il file da eseguire non c'è.
    chiudi(sito);
    throw new Errore(`non riesco a scrivere in ${cartella(sito)} (${errore.message}). La sessione è stata chiusa.`);
  }
  return { run: f.run, utente: p.utente };
}

// Cancella un file se c'è. Se al posto della cartella c'è altro, non c'è nulla da cancellare.
function togli(percorso) {
  try {
    fs.rmSync(percorso, { force: true });
  } catch (errore) {
    if (errore.code !== 'ENOTDIR') throw errore;
  }
}

// Revoca e pulizia. Restituisce quante sessioni restano all'utente agente (0).
function chiudi(sito) {
  const f = file(sito);
  togli(f.run);   // i cookie non restano su disco, comunque vada
  let scaduta = false;
  try {
    scaduta = JSON.parse(fs.readFileSync(f.segno, 'utf8')).scade < Date.now() / 1000;
  } catch { /* nessun segno, o illeggibile: si revoca comunque */ }
  let sessioni;
  try {
    sessioni = wp(progetto(sito), 'revoca').sessioni;
  } catch (errore) {
    // WordPress non risponde ma la sessione è già scaduta da sola: non resta nulla da chiudere.
    if (!scaduta) throw errore;
    sessioni = 0;
  }
  togli(f.segno);
  return sessioni;
}

module.exports = { apri, chiudi, componi, file, Errore };

if (require.main === module) {
  const [comando, sito, ...resto] = process.argv.slice(2);
  if (!['apri', 'chiudi'].includes(comando) || !sito || (comando === 'apri' && !resto.length) || (comando === 'chiudi' && resto.length)) {
    console.error(USO);
    process.exit(2);
  }
  try {
    if (comando === 'apri') {
      const r = apri(path.resolve(sito), path.resolve(resto[0]), resto.slice(1));
      console.log(`pronto: ${r.run}`);
      console.log(`Sessione di 15 minuti per «${r.utente}». Esegui il file con Playwright (browser_run_code_unsafe, filename), poi lancia: node sessione.js chiudi "${path.resolve(sito)}"`);
    } else {
      console.log(`sessioni attive: ${chiudi(path.resolve(sito))}`);
    }
  } catch (errore) {
    if (!(errore instanceof Errore)) throw errore;
    console.error(`sessione: ${errore.message}`);
    process.exit(1);
  }
}
