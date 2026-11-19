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
 *   node sync-theme-json-tokens.js {theme-root} --check  → sola lettura, vedi gli esiti
 *   (il marker vecchio, con il percorso della vecchia installazione, è accettato in lettura; --check lo segnala e la
 *   rigenerazione lo sostituisce con quello portabile)
 *
 * Il blocco porta l'impronta di theme.json (sha256 del suo contenuto): così --check si accorge
 * anche di una modifica fuori dai token (styles.elements, styles.blocks…), che lascia indietro
 * solo il CSS globale del kit. Il CSS si scrive per primo e DESIGN.md per ultimo: se WP-CLI
 * fallisce, DESIGN.md resta com'era e --check continua a segnalarlo.
 *
 * DESIGN.md è cercato in {site-root} = tre livelli sopra theme-root
 * ({site-root}/wp-content/themes/{theme}). La riga `{wp-cli}` di DESIGN.md viene eseguita così
 * com'è, senza shell: è il confine di fiducia di un repo clonato (chi clona un progetto si fida
 * del suo DESIGN.md come si fida del suo package.json).
 *
 * Exit: 0 allineato · 1 token non allineati, breakpoint divergenti o CSS non rigenerato ·
 * 2 errore d'uso o file non valido · 3 theme.json cambiato fuori dai token (solo --check).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const { valore, eFse, argomenti } = require('./lib/design-md.js');

// Marker senza percorsi: il DESIGN.md di un progetto non deve dipendere da dove è installato il plugin.
const BEGIN_MARKER = '<!-- AUTO-GENERATED:design-tokens da theme.json — non editare. Rigenera con lo script sync-theme-json-tokens.js del plugin wdm-agent -->';
// Il marker scritto fino al 2026-10-26 (skill globali, con il percorso dell'installazione nel testo) ha lo stesso
// prefisso "da theme.json": viene riconosciuto in lettura e riscritto in questo alla prima rigenerazione.
const END_MARKER = '<!-- /AUTO-GENERATED:design-tokens -->';
const IMPRONTA = '# impronta theme.json: ';
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
  if (!fs.existsSync(file)) fail(`non trovato: ${file}. Il primo argomento è la cartella del tema ({theme-root}).`);
  let theme;
  try {
    theme = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    fail(`theme.json non valido: ${e.message}. Correggi il file e rilancia.`);
  }
  if (theme === null || typeof theme !== 'object' || Array.isArray(theme)) {
    fail('theme.json non valido: atteso un oggetto JSON. Correggi il file e rilancia.');
  }
  return theme;
}

// Impronta del contenuto, non del testo: riformattare il file non la cambia.
function impronta(theme) {
  return crypto.createHash('sha256').update(JSON.stringify(theme)).digest('hex');
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

// La mappa può avere parentesi nei valori (calc(…)): si legge contando le parentesi, e le
// virgole dentro un valore non separano.
function parseScssBreakpoints(scss) {
  const m = /\$breakpoints\s*:\s*\(/.exec(scss);
  if (!m) return null;
  const map = {};
  let depth = 1;
  let part = '';
  const push = () => {
    const i = part.indexOf(':');
    if (i > 0 && part.slice(i + 1).trim()) map[part.slice(0, i).trim()] = part.slice(i + 1).trim();
    part = '';
  };
  for (let i = m.index + m[0].length; i < scss.length; i++) {
    const c = scss[i];
    if (c === '(') depth++;
    if (c === ')' && --depth === 0) { push(); return map; }
    if (c === ',' && depth === 1) push(); else part += c;
  }
  return null;
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
  L.push(IMPRONTA + impronta(theme));
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

// I marker contano solo a inizio riga: una nota in prosa che li cita non delimita nulla.
// { start, end } del blocco, o null se non c'è. Marker ripetuti o spaiati: non si indovina.
function findBlock(designMd) {
  const begins = [...designMd.matchAll(/^<!-- AUTO-GENERATED:design-tokens\b.*$/gm)];
  const ends = [...designMd.matchAll(/^<!-- \/AUTO-GENERATED:design-tokens -->[ \t]*$/gm)];
  if (begins.length === 0 && ends.length === 0) return null;
  if (begins.length !== 1 || ends.length !== 1 || ends[0].index < begins[0].index) {
    fail(`in DESIGN.md il marker del blocco Design Tokens è ripetuto o spaiato (${begins.length} di apertura, ${ends.length} di chiusura a inizio riga). Lascia un solo blocco, tra un marker di apertura e uno di chiusura, e rilancia.`);
  }
  return { start: begins[0].index, end: ends[0].index + END_MARKER.length };
}

function extractCurrentBlock(designMd) {
  const found = findBlock(designMd);
  return found ? designMd.slice(found.start, found.end) : null;
}

function insertBlock(designMd, block) {
  const section = `## Design Tokens\n\n${block}\n`;
  const found = findBlock(designMd);
  if (found) {
    return designMd.slice(0, found.start) + block + designMd.slice(found.end);
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

// L'impronta si confronta a parte: qui contano solo i token.
function withoutFingerprint(block) {
  return block.split('\n').filter((line) => !line.startsWith(IMPRONTA)).join('\n');
}

function fingerprintOf(block) {
  const line = block.split('\n').find((l) => l.startsWith(IMPRONTA));
  return line ? line.slice(IMPRONTA.length).trim() : null;
}

// Le righe tolte (-) e aggiunte (+), nell'ordine del file. Il confronto segue la sottosequenza
// comune più lunga: una riga inserita in alto non fa risultare diverse tutte quelle che la seguono.
function printDiff(oldBlock, newBlock) {
  const a = withoutFingerprint(oldBlock || '').split('\n');
  const b = withoutFingerprint(newBlock).split('\n');
  const comuni = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) comuni[i][j] = a[i] === b[j] ? comuni[i + 1][j + 1] + 1 : Math.max(comuni[i + 1][j], comuni[i][j + 1]);
  }
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { i++; j++; }
    else if (i < a.length && (j === b.length || comuni[i + 1][j] >= comuni[i][j + 1])) console.log(`  - ${a[i++]}`);
    else console.log(`  + ${b[j++]}`);
  }
}

// ---------- assets/css/wp-global-styles.css (kit statico) ----------

// Rigenera il CSS globale di WP per il kit conservando il commento di testa. Ritorna
// 'written' | 'unchanged' | 'skipped' | 'error'.
function syncGlobalStyles(themeRoot, designMd) {
  const target = path.join(themeRoot, 'assets', 'css', 'wp-global-styles.css');
  const wpCli = valore(designMd, '{wp-cli}');
  if (!wpCli) {
    console.log(`Avviso: nessuna riga \`{wp-cli}\` in DESIGN.md → Project Config → Paths: ${path.relative(themeRoot, target)} non rigenerato. A mano: {wp-cli} eval 'echo wp_get_global_stylesheet();' (poi ripristina il commento di testa).`);
    return 'skipped';
  }
  const rimedio = 'Controlla che i server di MAMP PRO siano avviati e che la riga `{wp-cli}` di DESIGN.md → Project Config → Paths sia quella scritta dal setup, poi rilancia.';
  let argv;
  try {
    argv = argomenti(wpCli);
  } catch (e) {
    console.error(`sync-theme-json-tokens: la riga {wp-cli} di DESIGN.md non si legge (${e.message}). ${rimedio}`);
    return 'error';
  }
  // Senza shell: ogni argomento arriva intero, su macOS come su Windows.
  const r = spawnSync(argv[0], [...argv.slice(1), 'eval', 'echo wp_get_global_stylesheet();'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error || r.status !== 0) {
    const motivo = r.error ? r.error.message : (r.stderr || r.stdout || `exit ${r.status}`).trim().split('\n')[0];
    console.error(`sync-theme-json-tokens: {wp-cli} non ha risposto (${motivo}). ${rimedio}`);
    return 'error';
  }
  let css = r.stdout;
  // PHP può stampare avvisi sullo stdout prima del CSS (es. WP-CLI su un PHP più nuovo: "Deprecated: …"):
  // una riga non CSS in testa invalida il primo blocco (:root con tutte le variabili --wp--preset--*).
  const lines = css.split('\n');
  let skipped = 0;
  while (lines.length && (lines[0].trim() === '' || /^(PHP )?(Deprecated|Warning|Notice|Strict Standards|Fatal error)\b/.test(lines[0]))) { lines.shift(); skipped++; }
  css = lines.join('\n');
  if (!/^[:.#@*\[a-zA-Z]/.test(css.trim()) || !css.includes('{')) {
    console.error(`sync-theme-json-tokens: l'output di wp eval non è CSS (prima riga: ${JSON.stringify((css.trim().split('\n')[0] || '').slice(0, 120))}); ${path.relative(themeRoot, target)} non toccato. Controlla {wp-cli} (PHP del server MAMP, -d display_errors=stderr).`);
    return 'error';
  }
  if (skipped) console.error(`sync-theme-json-tokens: ${skipped} riga/e non CSS scartate dallo stdout di wp eval (avvisi PHP): aggiungi -d display_errors=stderr a {wp-cli} o usa il PHP del server MAMP.`);
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
  if (!fs.existsSync(designMdPath)) fail(`DESIGN.md non trovato in ${siteRoot}: il progetto va prima inizializzato con la skill fse-theme-setup.`);

  // Breakpoint prima di tutto: se divergono non si scrive nulla.
  const bpProblems = breakpointDiff(themeRoot, theme);
  if (bpProblems.length) {
    console.log('ERRORE: breakpoint divergenti tra theme.json (settings.custom.breakpoints) e src/scss/_breakpoints.scss:');
    for (const p of bpProblems) console.log(`  - ${p}`);
    console.log('Allinea i due file (la mappa SCSS deve coincidere con theme.json) e rilancia.');
    process.exit(1);
  }

  const newBlock = buildBlock(generateYaml(theme));
  // Su Windows git può aver convertito i fine riga in CRLF: si confronta e si lavora in LF, e
  // alla scrittura il file torna com'era.
  const raw = fs.readFileSync(designMdPath, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const designMd = raw.replace(/\r\n/g, '\n');
  if (!eFse(designMd)) {
    fail('DESIGN.md → Project Config non ha la riga `theme_family` con valore fse: progetto wdm-starter? I suoi Design Tokens vengono da _variables.scss (sync-design-tokens.js). In un progetto wdm-theme rimetti la riga | `theme_family` | fse | nella tabella Identity e rilancia.');
  }
  const currentBlock = extractCurrentBlock(designMd);
  if (currentBlock !== null && !currentBlock.startsWith('<!-- AUTO-GENERATED:design-tokens da theme.json')) {
    fail('il blocco Design Tokens in DESIGN.md è stato generato da un\'altra fonte (marker diverso da "da theme.json"): non lo sovrascrivo. Se il progetto è wdm-theme, togli quel blocco a mano e rilancia.');
  }

  if (check) {
    if (currentBlock === null || withoutFingerprint(normalizeMarker(currentBlock)) !== withoutFingerprint(newBlock)) {
      console.log('STALE: i Design Tokens in DESIGN.md non riflettono theme.json. Differenze:');
      printDiff(currentBlock, newBlock);
      console.log('Per allinearli rilancia lo script senza --check (rigenera anche assets/css/wp-global-styles.css).');
      process.exit(1);
    }
    const saved = fingerprintOf(currentBlock);
    if (saved !== null && saved !== impronta(theme)) {
      console.log('STALE: theme.json è cambiato fuori dai token (nessun token è cambiato): assets/css/wp-global-styles.css non lo riflette più.');
      console.log('Rilancia lo script senza --check: rigenera il CSS globale del kit e aggiorna l\'impronta in DESIGN.md.');
      process.exit(3);
    }
    console.log('OK: Design Tokens in DESIGN.md allineati a theme.json; breakpoint ≡ _breakpoints.scss');
    if (!currentBlock.startsWith(BEGIN_MARKER)) {
      console.log('(marker da aggiornare: rigenera senza --check per scrivere il marker portabile del plugin)');
    }
    if (saved === null) {
      console.log('(impronta di theme.json assente: rigenera senza --check per scriverla; da lì in poi --check vede anche le modifiche fuori dai token)');
    }
    process.exit(0);
  }

  // Prima il CSS, poi DESIGN.md: se WP-CLI fallisce DESIGN.md resta com'era e --check lo segnala.
  const gs = syncGlobalStyles(themeRoot, designMd);
  if (gs === 'error') process.exit(1);
  // Senza la riga {wp-cli} il CSS non è stato rigenerato: l'impronta non si scrive, perché
  // direbbe che lo è. I token si aggiornano lo stesso.
  const toWrite = gs === 'skipped' ? withoutFingerprint(newBlock) : newBlock;
  let tokensChanged = false;
  if (currentBlock !== toWrite) {
    // Scrittura in due tempi: un'interruzione a metà non lascia un DESIGN.md troncato.
    const tmp = `${designMdPath}.tmp`;
    fs.writeFileSync(tmp, insertBlock(designMd, toWrite).replace(/\n/g, eol));
    fs.renameSync(tmp, designMdPath);
    console.log(`Design Tokens rigenerati in ${designMdPath}`);
    tokensChanged = true;
  }
  if (!tokensChanged && gs !== 'written') {
    console.log('Nessuna modifica: Design Tokens e wp-global-styles.css già allineati.');
  }
}

main();
