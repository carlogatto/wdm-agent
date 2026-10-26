#!/usr/bin/env node
/**
 * sync-theme-json-tokens.js — genera il blocco "## Design Tokens" in DESIGN.md a partire
 * da theme.json (block theme FSE, famiglia wdm-theme). Gemello di sync-design-tokens.js
 * (wdm-starter, che legge src/scss/bs5/_variables.scss).
 *
 * theme.json è l'unica fonte di verità; il blocco YAML in DESIGN.md è un derivato
 * rigenerabile, delimitato da marker AUTO-GENERATED. Nessuna skill e nessun umano lo
 * edita a mano. Lo script verifica anche che `settings.custom.breakpoints` coincida con la
 * mappa `$breakpoints` di src/scss/_breakpoints.scss (unico token duplicato: le media query
 * non accettano custom property) ed esce 1 se divergono, in entrambe le modalità.
 *
 * Uso:
 *   node sync-theme-json-tokens.js {theme-root}          → rigenera il blocco in DESIGN.md e
 *                                                          assets/css/wp-global-styles.css
 *                                                          (se DESIGN.md ha la riga `{wp-cli}`)
 *   node sync-theme-json-tokens.js {theme-root} --check  → sola lettura: exit 1 se stale o
 *                                                          breakpoint divergenti
 *   (il marker vecchio, con il percorso della vecchia installazione, è accettato in lettura; --check lo segnala e la
 *   rigenerazione lo sostituisce con quello portabile)
 *
 * DESIGN.md è cercato in {site-root} = tre livelli sopra theme-root
 * ({site-root}/wp-content/themes/{theme}). Exit: 0 ok · 1 stale/divergenti · 2 errore d'uso.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Marker senza percorsi: il DESIGN.md di un progetto non deve dipendere da dove è installato il plugin.
const BEGIN_MARKER = '<!-- AUTO-GENERATED:design-tokens da theme.json — non editare. Rigenera con lo script sync-theme-json-tokens.js del plugin wdm-agent -->';
// Il marker scritto fino al 2026-10-26 (skill globali, con il percorso dell'installazione nel testo) ha lo stesso
// prefisso "da theme.json": viene riconosciuto in lettura e riscritto in questo alla prima rigenerazione.
const END_MARKER = '<!-- /AUTO-GENERATED:design-tokens -->';
const GLOBAL_STYLES_HEADER = `/* GENERATO — non modificare a mano. Stesso CSS che WP stampa inline da theme.json (variabili, preset, elementi).
   Serve solo al kit statico (html/); in WP lo stampa il core. Rigenera dopo ogni modifica a theme.json con:
   lo script sync-theme-json-tokens.js del plugin wdm-agent (legge {wp-cli} da DESIGN.md) */`;

function fail(msg) {
  console.error(`sync-theme-json-tokens: ${msg}`);
  process.exit(2);
}

// ---------- theme.json ----------

function readThemeJson(themeRoot) {
  const file = path.join(themeRoot, 'theme.json');
  if (!fs.existsSync(file)) fail(`non trovato: ${file}`);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    fail(`theme.json non valido: ${e.message}`);
  }
}

// Valore in px tra parentesi per i preset rem (root 16px), solo come commento di lettura.
function remNote(size) {
  const m = /^(-?[\d.]+)rem$/.exec(String(size).trim());
  return m ? ` (${Math.round(parseFloat(m[1]) * 160) / 10}px)` : '';
}

// Scalare YAML: lascia nudi i valori "innocui", quota tutto il resto (colori #…, font con virgole/virgolette, clamp()).
function y(value) {
  const s = String(value);
  return /^[A-Za-z0-9._\-\/ ]+$/.test(s) && !/^[\-.]/.test(s) ? s : JSON.stringify(s);
}

function emitTree(lines, obj, indent) {
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      lines.push(`${indent}${key}:`);
      emitTree(lines, v, indent + '  ');
    } else {
      lines.push(`${indent}${key}: ${y(v)}`);
    }
  }
}

// ---------- Breakpoint: theme.json ≡ _breakpoints.scss ----------

function parseScssBreakpoints(scss) {
  const m = /\$breakpoints\s*:\s*\(([^)]*)\)\s*;/.exec(scss);
  if (!m) return null;
  const map = {};
  for (const part of m[1].split(',')) {
    const [k, v] = part.split(':').map((s) => s && s.trim());
    if (k && v) map[k] = v;
  }
  return map;
}

function breakpointDiff(themeRoot, theme) {
  const fromJson = theme.settings && theme.settings.custom && theme.settings.custom.breakpoints;
  const scssPath = path.join(themeRoot, 'src', 'scss', '_breakpoints.scss');
  const problems = [];
  if (!fromJson || typeof fromJson !== 'object') problems.push('theme.json: manca settings.custom.breakpoints');
  if (!fs.existsSync(scssPath)) problems.push(`non trovato: ${scssPath}`);
  if (problems.length) return problems;
  const fromScss = parseScssBreakpoints(fs.readFileSync(scssPath, 'utf8'));
  if (!fromScss) return [`_breakpoints.scss: mappa $breakpoints non trovata`];
  const keys = new Set([...Object.keys(fromJson), ...Object.keys(fromScss)]);
  for (const k of keys) {
    const a = fromJson[k];
    const b = fromScss[k];
    if (a === undefined) problems.push(`${k}: solo in _breakpoints.scss (${b})`);
    else if (b === undefined) problems.push(`${k}: solo in theme.json (${a})`);
    else if (String(a).trim() !== String(b).trim()) problems.push(`${k}: theme.json ${a} ≠ _breakpoints.scss ${b}`);
  }
  return problems;
}

// ---------- Generazione YAML ----------

function generateYaml(theme) {
  const s = theme.settings || {};
  const L = [];
  L.push('# Variabili CSS: --wp--preset--color--{slug}, --wp--preset--font-family--{slug}, --wp--preset--font-size--{slug},');
  L.push('#                --wp--preset--spacing--{slug}, --wp--custom--{a}--{b} (camelCase → kebab-case), --wp--style--global--content-size|wide-size');

  L.push('colors:');
  for (const c of (s.color && s.color.palette) || []) {
    L.push(`  ${c.slug}: ${y(c.color)}  # ${c.name}`);
  }

  const layout = s.layout || {};
  L.push(`layout: { contentSize: ${y(layout.contentSize || '')}, wideSize: ${y(layout.wideSize || '')} }`);

  const typo = s.typography || {};
  L.push('fontFamilies:');
  for (const f of typo.fontFamilies || []) {
    L.push(`  ${f.slug}: ${y(f.fontFamily)}`);
  }
  L.push(`fontSizes:  # fluid: ${typo.fluid === true ? 'true' : 'false'}`);
  for (const f of typo.fontSizes || []) {
    const fluid = f.fluid && typeof f.fluid === 'object' ? `, min: ${y(f.fluid.min)}, max: ${y(f.fluid.max)}` : '';
    L.push(`  ${f.slug}: { size: ${y(f.size)}${fluid} }  # ${f.name}`);
  }

  const spacing = s.spacing || {};
  L.push('spacing:');
  for (const sp of spacing.spacingSizes || []) {
    L.push(`  ${sp.slug}: ${y(sp.size)}  # ${sp.name}${/px/.test(sp.name) ? '' : remNote(sp.size)}`);
  }

  if (s.custom && typeof s.custom === 'object') {
    L.push('custom:');
    emitTree(L, s.custom, '  ');
  }

  const bp = (s.custom && s.custom.breakpoints) || {};
  const bpParts = Object.keys(bp).map((k) => `${k}: ${y(bp[k])}`);
  L.push(`breakpoints: { ${bpParts.join(', ')} }  # ≡ src/scss/_breakpoints.scss (mixin bp-up/bp-down)`);

  const styles = theme.styles || {};
  const blocks = styles.blocks || {};
  const padded = Object.keys(blocks).filter((k) => {
    const p = blocks[k].spacing && blocks[k].spacing.padding;
    return p && (p.top || p.bottom);
  });
  if (padded.length) {
    L.push('sectionPadding:  # styles.blocks → padding di default dei blocchi sezione (preset)');
    for (const k of padded) {
      const p = blocks[k].spacing.padding;
      L.push(`  ${y(k)}: { top: ${y(p.top || '')}, bottom: ${y(p.bottom || '')} }`);
    }
  }

  return L.join('\n');
}

function buildBlock(yaml) {
  return `${BEGIN_MARKER}\n\`\`\`yaml\n${yaml}\n\`\`\`\n${END_MARKER}`;
}

// Sostituisce la prima riga (il marker) con quella corrente: così un blocco con il marker vecchio
// si confronta con il nuovo solo sui token.
function normalizeMarker(block) {
  const nl = block.indexOf('\n');
  return nl === -1 ? BEGIN_MARKER : BEGIN_MARKER + block.slice(nl);
}

// ---------- Lettura/scrittura DESIGN.md (stessa logica di sync-design-tokens.js) ----------

function extractCurrentBlock(designMd) {
  const begin = designMd.indexOf('<!-- AUTO-GENERATED:design-tokens');
  const end = designMd.indexOf(END_MARKER);
  if (begin === -1 || end === -1 || end < begin) return null;
  return designMd.slice(begin, end + END_MARKER.length);
}

function insertBlock(designMd, block) {
  const section = `## Design Tokens\n\n${block}\n`;
  const existing = extractCurrentBlock(designMd);
  if (existing !== null) {
    return designMd.replace(existing, block);
  }
  // Heading presente ma senza marker → sostituisce il corpo della sezione
  const headingRe = /^## Design Tokens[^\n]*\n/m;
  const hm = headingRe.exec(designMd);
  if (hm) {
    const bodyStart = hm.index + hm[0].length;
    const nextSection = designMd.slice(bodyStart).search(/^## /m);
    const bodyEnd = nextSection === -1 ? designMd.length : bodyStart + nextSection;
    return designMd.slice(0, hm.index) + section + '\n' + designMd.slice(bodyEnd);
  }
  // Sezione assente → inserita dopo la prima sezione àncora disponibile
  for (const anchor of ['## Local Development', '## Project Config', '## Overview']) {
    const am = designMd.indexOf(`\n${anchor}`);
    if (am === -1) continue;
    const afterAnchor = am + 1 + anchor.length;
    const rest = designMd.slice(afterAnchor);
    const next = rest.search(/^## /m);
    const insertAt = next === -1 ? designMd.length : afterAnchor + next;
    return designMd.slice(0, insertAt) + section + '\n' + designMd.slice(insertAt);
  }
  return designMd.trimEnd() + '\n\n' + section;
}

function printDiff(oldBlock, newBlock) {
  const oldLines = (oldBlock || '').split('\n');
  const newLines = newBlock.split('\n');
  const max = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < max; i++) {
    if (oldLines[i] !== newLines[i]) {
      if (oldLines[i] !== undefined) console.log(`  - ${oldLines[i]}`);
      if (newLines[i] !== undefined) console.log(`  + ${newLines[i]}`);
    }
  }
}

// ---------- assets/css/wp-global-styles.css (kit statico) ----------

function readWpCli(designMd) {
  const m = /^\|\s*`\{wp-cli\}`\s*\|\s*(.+?)\s*\|\s*$/m.exec(designMd);
  return m ? m[1].trim() : null;
}

// Rigenera il CSS globale di WP per il kit conservando il commento di testa. Ritorna
// 'written' | 'unchanged' | 'skipped' | 'error'.
function syncGlobalStyles(themeRoot, designMd) {
  const target = path.join(themeRoot, 'assets', 'css', 'wp-global-styles.css');
  const wpCli = readWpCli(designMd);
  if (!wpCli) {
    console.log(`Avviso: nessuna riga \`{wp-cli}\` in DESIGN.md → Project Config → Paths: ${path.relative(themeRoot, target)} non rigenerato. A mano: {wp-cli} eval 'echo wp_get_global_stylesheet();' (poi ripristina il commento di testa).`);
    return 'skipped';
  }
  let css;
  try {
    css = execSync(`${wpCli} eval 'echo wp_get_global_stylesheet();'`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    console.error(`sync-theme-json-tokens: wp eval fallito (${(e.stderr || e.message || '').toString().trim().split('\n')[0]})`);
    return 'error';
  }
  let header = GLOBAL_STYLES_HEADER;
  const existing = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
  const hm = /^\/\*[\s\S]*?\*\//.exec(existing);
  if (hm) header = hm[0];
  const next = `${header}\n${css.trim()}\n`;
  if (existing === next) return 'unchanged';
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, next);
  console.log(`wp-global-styles.css rigenerato in ${target}`);
  return 'written';
}

// ---------- Main ----------

function main() {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const themeRoot = args.find((a) => a !== '--check');
  if (!themeRoot) fail('uso: sync-theme-json-tokens.js {theme-root} [--check]');

  const theme = readThemeJson(themeRoot);

  const siteRoot = path.resolve(themeRoot, '..', '..', '..');
  const designMdPath = path.join(siteRoot, 'DESIGN.md');
  if (!fs.existsSync(designMdPath)) fail(`DESIGN.md non trovato in ${siteRoot} — il progetto è stato inizializzato con fse-theme-setup?`);

  // Breakpoint prima di tutto: se divergono non si scrive nulla.
  const bpProblems = breakpointDiff(themeRoot, theme);
  if (bpProblems.length) {
    console.log('ERRORE: breakpoint divergenti tra theme.json (settings.custom.breakpoints) e src/scss/_breakpoints.scss:');
    for (const p of bpProblems) console.log(`  - ${p}`);
    console.log('Allinea i due file (la mappa SCSS deve coincidere con theme.json) e rilancia.');
    process.exit(1);
  }

  const newBlock = buildBlock(generateYaml(theme));
  const designMd = fs.readFileSync(designMdPath, 'utf8');
  if (!/^\|\s*`theme_family`\s*\|\s*fse\s*\|/m.test(designMd)) {
    fail(`DESIGN.md → Project Config non ha \`theme_family: fse\`: progetto wdm-starter? I suoi Design Tokens vengono da _variables.scss (sync-design-tokens.js).`);
  }
  const currentBlock = extractCurrentBlock(designMd);
  if (currentBlock !== null && !currentBlock.startsWith('<!-- AUTO-GENERATED:design-tokens da theme.json')) {
    fail('il blocco Design Tokens in DESIGN.md è stato generato da un\'altra fonte (marker diverso da "da theme.json"): non lo sovrascrivo.');
  }

  if (check) {
    if (currentBlock !== null && normalizeMarker(currentBlock) === newBlock) {
      console.log('OK: Design Tokens in DESIGN.md allineati a theme.json; breakpoint ≡ _breakpoints.scss');
      if (!currentBlock.startsWith(BEGIN_MARKER)) {
        console.log('(marker da aggiornare: rigenera senza --check per scrivere il marker portabile del plugin)');
      }
      process.exit(0);
    }
    console.log('STALE: i Design Tokens in DESIGN.md non riflettono theme.json. Differenze:');
    printDiff(currentBlock, newBlock);
    process.exit(1);
  }

  let tokensChanged = false;
  if (currentBlock !== newBlock) {
    fs.writeFileSync(designMdPath, insertBlock(designMd, newBlock));
    console.log(`Design Tokens rigenerati in ${designMdPath}`);
    tokensChanged = true;
  }
  const gs = syncGlobalStyles(themeRoot, designMd);
  if (gs === 'error') process.exit(1);
  if (!tokensChanged && gs !== 'written') {
    console.log('Nessuna modifica: Design Tokens e wp-global-styles.css già allineati.');
  }
}

main();
