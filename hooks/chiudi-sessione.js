#!/usr/bin/env node
// Hook Stop e SessionEnd: a fine turno nessuna sessione dell'utente agente resta aperta. Se il
// lavoro si è fermato prima di `sessione.js chiudi` (un errore, un'interruzione), la chiude lui.
// Una sessione aperta si riconosce dal file {site-root}/.playwright-mcp/_sessione.json: senza
// quel file l'hook esce subito, senza lanciare nulla.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { eFse } = require('../shared/scripts/lib/design-md.js');
const { chiudi, file } = require('../shared/scripts/sessione.js');

// La site root del progetto FSE che contiene `cartella` (le skill lavorano anche dentro il tema).
function sitoDi(cartella) {
  for (let c = path.resolve(cartella); ; c = path.dirname(c)) {
    const design = path.join(c, 'DESIGN.md');
    if (fs.existsSync(design) && eFse(fs.readFileSync(design, 'utf8'))) return c;
    if (c === path.dirname(c)) return null;
  }
}

function cwd() {
  try {
    const dati = JSON.parse(fs.readFileSync(0, 'utf8'));
    return typeof dati.cwd === 'string' && dati.cwd !== '' ? dati.cwd : process.cwd();
  } catch {
    return process.cwd();
  }
}

const sito = sitoDi(cwd());
if (sito && fs.existsSync(file(sito).segno)) {
  try {
    chiudi(sito);
  } catch (errore) {
    // Non blocca la fine del turno: la sessione scade da sola, e il prossimo turno riprova.
    console.error(`chiudi-sessione: sessione dell'utente agente non revocata (${errore.message}). Scade da sola entro 15 minuti.`);
  }
}
process.exit(0);
