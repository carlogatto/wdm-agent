#!/usr/bin/env node
// Hook Stop e SessionEnd: a fine turno nessuna sessione dell'utente agente resta aperta. Se il
// lavoro si è fermato prima di `sessione.js chiudi` (un errore, un'interruzione), la chiude lui.
// Una sessione aperta si riconosce dal file {site-root}/.playwright-mcp/_sessione.json: senza
// quel file l'hook esce subito, senza lanciare nulla.

'use strict';

const fs = require('node:fs');

const { chiudi, pulisci, file } = require('../shared/scripts/sessione.js');
const { sitoDi } = require('./lib/ingresso.js');

function cwd() {
  try {
    const dati = JSON.parse(fs.readFileSync(0, 'utf8'));
    return typeof dati.cwd === 'string' && dati.cwd !== '' ? dati.cwd : process.cwd();
  } catch {
    return process.cwd();
  }
}

// La sessione è già scaduta se il segno lo dice: WordPress non serve, basta togliere i file.
function scaduta(sito) {
  try {
    return JSON.parse(fs.readFileSync(file(sito).segno, 'utf8')).scade < Date.now() / 1000;
  } catch {
    return false;
  }
}

const sito = sitoDi(cwd());
if (sito && fs.existsSync(file(sito).segno)) {
  try {
    if (scaduta(sito)) pulisci(sito); else chiudi(sito);
  } catch (errore) {
    // Non blocca la fine del turno: la sessione scade da sola, e il prossimo turno riprova.
    console.error(`chiudi-sessione: sessione dell'utente agente non revocata (${errore.message}). Scade da sola entro 15 minuti.`);
  }
}
process.exit(0);
