#!/usr/bin/env node
// Hook SessionStart con matcher `compact`: dopo una compattazione del contesto (automatica o
// chiesta con /compact) la cronologia è un riassunto. Se si lavora in un progetto FSE, ricorda
// all'agente dove sta lo stato, perché lo rilegga dal disco invece di fidarsi del riassunto.
// Ciò che stampa su stdout, con exit 0, entra nel contesto di Claude (tetto: 10.000 caratteri).
// Fuori da un progetto FSE, o con un ingresso che non è quello di una compattazione, tace.
// Non esce mai con un codice diverso da 0: non deve poter disturbare la ripresa del lavoro.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { sitoDi } = require('./lib/ingresso.js');

const PLUGIN = path.join(__dirname, '..');

function ingresso() {
  try {
    const dati = JSON.parse(fs.readFileSync(0, 'utf8'));
    return dati && typeof dati === 'object' ? dati : null;
  } catch {
    return null;
  }
}

function promemoria(sito) {
  return [
    `Il contesto di questa conversazione è stato appena compattato: ciò che ricordi del lavoro in corso è un riassunto. Stai lavorando in un progetto FSE (famiglia wdm-theme) in ${sito}. Prima di proseguire rileggi dal disco:`,
    `1. ${path.join(sito, 'DESIGN.md')}: Project Config, le tabelle di stato (Telaio, Pagine, Blocchi, Navigazione) e ## Domande aperte. Le righe ⏳ dicono che cosa era in corso e che cosa aspetta il dev.`,
    '2. Se era in corso un kit o una build (fse-kit, fse-build): girano in un sotto-agente, e tu sei la conversazione principale. Non rileggere il loro SKILL.md e non fare il loro lavoro: DESIGN.md dice a che punto sono (un kit in revisione aspetta l\'ok del dev; una riga «⏳ build sito» rimasta dice che una build si è interrotta) e, se c\'è lavoro da riprendere, invoca di nuovo la skill con il messaggio del dev. Che cosa fai tu è scritto nel CLAUDE.md del progetto («Who runs what»).',
    `3. Se invece la skill la esegui tu (il setup, il brief, una modifica a un blocco, i menu; oppure sei il sotto-agente di un kit o di una build, e il tuo primo messaggio è il testo della skill): rileggi per intero il suo SKILL.md (${path.join(PLUGIN, 'skills', '<nome>', 'SKILL.md')}) e i paragrafi delle fondamenta che cita (${path.join(PLUGIN, 'shared', 'fse-foundations.md')}). Riprendi dal passo che le righe ⏳ e lo stato sul disco indicano, non da quello che ricordi.`,
    '4. Un gate già aperto resta aperto: l\'ok del dev arriva in un turno successivo, e un «confirm» vale solo se è scritto in un suo messaggio. Ciò che il riassunto dà per approvato si verifica in DESIGN.md prima di agire.',
  ].join('\n');
}

const dati = ingresso();
if (dati && dati.source === 'compact') {
  const sito = sitoDi(typeof dati.cwd === 'string' && dati.cwd !== '' ? dati.cwd : process.cwd());
  if (sito) process.stdout.write(`${promemoria(sito)}\n`);
}
process.exit(0);
