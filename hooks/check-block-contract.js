#!/usr/bin/env node
// check-block-contract.js — hook PostToolUse (Write|Edit) del plugin wdm-agent.
//
// Giudica solo {sito}/wp-content/themes/{tema}/blocks/{cartella}/block.json di un progetto FSE
// (DESIGN.md → theme_family: fse). Un block.json con la chiave `acf` è di wdm-starter: ignorato.
// Contratto del blocco (fse-foundations.md):
//   - `name` = {prefix}/{slug}, con il {prefix} del progetto, e cartella = {prefix}-block-{slug}
//   - `render` presente e il suo file esiste (i blocchi sono sempre dinamici: render.php)
//   - ogni `file:./…` si risolve: un file di build deve avere il sorgente in src/
//     (build/index.js ← src/index.js, build/style-index.css ← src/style.scss,
//     build/index.css ← src/editor.scss, build/view.js ← src/view.js); ogni altro file esiste
//   - README.md (il contratto del blocco) esiste
//   - `version` presente e non vuota
// Una violazione: elenco su stderr ed exit 2 (l'agente lo riceve). Altrimenti exit 0 in
// silenzio. L'hook non scrive mai nulla.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { valore } = require('../shared/scripts/lib/design-md.js');
const { fileDelTema } = require('./lib/ingresso.js');

const SORGENTI = {
  'build/index.js': 'src/index.js',
  'build/style-index.css': 'src/style.scss',
  'build/index.css': 'src/editor.scss',
  'build/view.js': 'src/view.js',
};
const CHIAVI_FILE = ['render', 'editorScript', 'script', 'viewScript', 'viewScriptModule', 'style', 'editorStyle', 'viewStyle'];

function problemi(json, blocco, cartella, prefisso) {
  const trovati = [];
  const esiste = (relativo) => fs.existsSync(path.join(blocco, ...relativo.split('/')));

  if (typeof json.name !== 'string' || !json.name.includes('/')) {
    trovati.push('manca "name" nella forma {prefix}/{slug}');
  } else {
    const [suo, ...resto] = json.name.split('/');
    const slug = resto.join('/');
    if (prefisso && suo !== prefisso) {
      trovati.push(`name "${json.name}": il prefisso del progetto è "${prefisso}" (DESIGN.md → {prefix}), atteso "${prefisso}/${slug}"`);
    } else if (cartella !== `${suo}-block-${slug}`) {
      trovati.push(`name "${json.name}" ↔ cartella "${cartella}": attesa "${suo}-block-${slug}" (cartella = {prefix}-block-{slug}, name = {prefix}/{slug})`);
    }
  }

  if (typeof json.render !== 'string' || !json.render.startsWith('file:')) {
    trovati.push('manca "render": "file:./render.php" — i blocchi sono sempre dinamici (render.php), mai save()');
  }

  // Ogni riferimento file:./… (stringa o elenco, es. "style": ["wdm-swiper", "file:./build/style-index.css"])
  const riferimenti = CHIAVI_FILE.flatMap((chiave) => [].concat(json[chiave] || [])).filter((v) => typeof v === 'string' && v.startsWith('file:'));
  for (const riferimento of riferimenti) {
    const relativo = riferimento.slice('file:'.length).replace(/^\.\//, '');
    if (relativo.startsWith('build/')) {
      const sorgente = SORGENTI[relativo];
      if (!sorgente) trovati.push(`"${riferimento}": output di build non previsto dalla pipeline (ammessi: ${Object.keys(SORGENTI).join(', ')})`);
      else if (!esiste(sorgente)) trovati.push(`"${riferimento}": manca il sorgente ${sorgente} (build.js lo genera da lì)`);
    } else if (!esiste(relativo)) {
      trovati.push(`"${riferimento}": file assente (${relativo})`);
    }
  }

  if (!esiste('README.md')) trovati.push('manca README.md (il contratto del blocco: scopo, varianti, attributi, figli, markup, dipendenze)');

  if (typeof json.version !== 'string' || json.version.trim() === '') {
    trovati.push('manca "version": fuori da SCRIPT_DEBUG il CSS del blocco è versionato solo con questa chiave (alzarla a ogni release)');
  }
  return trovati;
}

function main() {
  const scritto = fileDelTema();
  if (!scritto) return 0;
  const { file, resto, design } = scritto;
  if (resto.length !== 3 || resto[0] !== 'blocks' || resto[2] !== 'block.json') return 0;

  let json;
  try {
    json = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (errore) {
    console.error(`❌ check-block-contract: ${file} non è JSON valido (${errore.message}). Correggi il file prima di proseguire.`);
    return 2;
  }
  if (json === null || typeof json !== 'object' || Array.isArray(json)) {
    console.error(`❌ check-block-contract: ${file} non è JSON valido (atteso un oggetto). Correggi il file prima di proseguire.`);
    return 2;
  }
  // Blocco ACF dello starter (wdm-starter): contratto diverso, fuori perimetro.
  if ('acf' in json) return 0;

  const trovati = problemi(json, path.dirname(file), resto[1], valore(design, '{prefix}'));
  if (trovati.length === 0) return 0;
  console.error([
    `❌ check-block-contract: ${resto[1]}/block.json viola il contratto del blocco (fse-foundations.md):`,
    ...trovati.map((p) => `  - ${p}`),
    'Sistema il blocco prima di proseguire (npm run build non compila i file mancanti).',
  ].join('\n'));
  return 2;
}

process.exitCode = main();
