#!/usr/bin/env node
// check-design-tokens.js — hook PostToolUse (Write|Edit) del plugin wdm-agent.
//
// Giudica solo {sito}/wp-content/themes/{tema}/theme.json di un progetto FSE (DESIGN.md →
// theme_family: fse). Lancia shared/scripts/sync-theme-json-tokens.js --check e, se i Design
// Tokens di DESIGN.md non sono più allineati, lo dice all'agente con
// hookSpecificOutput.additionalContext. L'hook non scrive mai nulla: theme.json resta l'unica
// fonte e la conferma resta al dev.
//
// Esiti del sync: 0 allineato (silenzio) · 1 token non allineati (conferma del dev prima di
// rigenerare) · 3 theme.json cambiato fuori dai token (si rigenera subito) · altro: il controllo
// non è riuscito, e il messaggio dice perché (es. theme.json non valido).

'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { comando } = require('../shared/scripts/lib/design-md.js');
const { fileDelTema } = require('./lib/ingresso.js');

const SYNC = path.join(__dirname, '..', 'shared', 'scripts', 'sync-theme-json-tokens.js');

function messaggio(stato, uscita, tema) {
  const rigenera = `  ${comando(['node', SYNC, tema])}`;
  if (stato === 1) {
    return [
      '⚠️ theme.json è stato modificato e i Design Tokens in DESIGN.md non sono più allineati.',
      uscita,
      '',
      'PRIMA di rigenerare: mostra queste differenze al dev e chiedi conferma esplicita. Solo dopo la conferma esegui:',
      rigenera,
      'Se il dev NON conferma, la modifica a theme.json va riconsiderata o ripristinata.',
      'Eccezioni già autorizzate (fondamenta §12), in cui si rigenera subito senza chiedere: la voce styles.blocks richiesta dal README di un blocco; i token scritti dentro fse-brief.',
    ].join('\n');
  }
  if (stato === 3) {
    return [
      '⚠️ theme.json è stato modificato fuori dai token: il CSS globale del kit (assets/css/wp-global-styles.css) non lo riflette più.',
      uscita,
      '',
      'Nessun token è cambiato, quindi non serve una conferma: rigenera subito con',
      rigenera,
    ].join('\n');
  }
  return [
    '⚠️ theme.json è stato modificato, ma il controllo dei Design Tokens non è riuscito:',
    uscita,
    '',
    'Correggi la causa prima di proseguire: finché il controllo non passa, DESIGN.md e il CSS globale del kit non sono verificati.',
  ].join('\n');
}

function main() {
  const scritto = fileDelTema();
  if (!scritto || scritto.resto.length !== 1 || scritto.resto[0] !== 'theme.json') return;
  const r = spawnSync(process.execPath, [SYNC, scritto.tema, '--check'], { encoding: 'utf8' });
  if (r.status === 0) return;
  const uscita = `${r.stdout || ''}${r.stderr || ''}`.trim() || (r.error ? r.error.message : `exit ${r.status}`);
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: messaggio(r.status, uscita, scritto.tema) },
  }) + '\n');
}

main();
