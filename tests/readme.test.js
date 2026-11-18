// README: comandi di installazione, aggiornamento e sviluppo, prerequisiti, sezioni obbligatorie.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const readme = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');

const COMANDI = [
  'claude plugin marketplace add carlogatto/wdm-agent',
  'claude plugin install wdm-agent@wdm-agent',
  'claude plugin update wdm-agent@wdm-agent',
  'claude plugin uninstall wdm-agent@wdm-agent',
  'claude plugin marketplace add ~/Documents/Development/wdm-agent',
  '/reload-plugins',
  'node tests/run.js',
  'claude plugin list',
  'wdm-agent:fse-brief',
  'wp-page.php',
  'claude plugin uninstall wdm-agent@wdm-agent && claude plugin install wdm-agent@wdm-agent',
];

const SEZIONI = ["Cos'è", 'Cosa contiene', 'Il flusso', 'Prerequisiti', 'Installazione', 'Aggiornamento',
  "Verifica dell'installazione", 'Il primo progetto', 'Glossario', 'Problemi comuni', 'Disinstallazione', 'Sviluppo',
  'Come sono scritti i percorsi', 'Storia'];

// Il testo di una sezione, dal suo titolo al titolo successivo.
const sezione = (titolo) => {
  const inizio = readme.indexOf(`## ${titolo}\n`);
  assert.notEqual(inizio, -1, `manca la sezione: ## ${titolo}`);
  const fine = readme.indexOf('\n## ', inizio + 1);
  return readme.slice(inizio, fine === -1 ? readme.length : fine);
};
const righeDiTabella = (testo) => testo.split('\n').filter((r) => r.startsWith('| ') && !/^\|[\s:|-]+\|$/.test(r)).slice(1);

test('il README riporta ogni comando', () => {
  for (const comando of COMANDI) assert.ok(readme.includes(comando), `manca: ${comando}`);
});

test('il README ha ogni sezione', () => {
  for (const sezione of SEZIONI) assert.ok(readme.includes(`## ${sezione}`), `manca la sezione: ## ${sezione}`);
});

test('nessun comando delle prove bash, che non esistono più', () => {
  assert.ok(!readme.includes('tests/run.sh'));
});

// La cache di Claude Code (~/.claude/plugins/…) è ammessa ovunque.
test('~/.claude compare solo nella sezione Storia', () => {
  const righe = (testo) => testo.split('\n').filter((r) => r.includes('~/.claude') && !r.includes('~/.claude/plugins')).length;
  assert.equal(righe(readme), righe(readme.slice(readme.search(/^## Storia/m))));
});

// U01: chi legge solo questa sezione sa tutto ciò che deve avere prima di cominciare.
test('i prerequisiti stanno tutti in una sezione, con costo di MAMP PRO e comando di Playwright', () => {
  const testo = sezione('Prerequisiti');
  for (const voce of ['macOS', 'MAMP PRO', '99 €', 'Claude Code', 'Node.js 22', '**git**', 'Sourcetree', 'account GitHub', 'Playwright',
    '/plugin install playwright@claude-plugins-official', 'wdm-theme', 'senza password']) {
    assert.ok(testo.includes(voce), `nei prerequisiti manca: ${voce}`);
  }
});

// Un sistema entra nei prerequisiti solo dopo essere stato provato dall'inizio alla fine.
test('il README dichiara solo macOS', () => {
  assert.doesNotMatch(readme, /Windows|Linux/i);
});

test('lingue e ruoli sono dichiarati (U49)', () => {
  assert.ok(sezione("Cos'è").includes('«dev» e «designer» sono la stessa persona'));
  assert.match(sezione("Cos'è"), /in inglese[\s\S]*in italiano/);
});

test('i passi di MAMP PRO si possono eseguire: sito, cartella, SSL, avvio; prima la cartella', () => {
  const testo = sezione('Il primo progetto');
  for (const voce of ['Sites', 'Empty', 'Site Folder', 'SSL', 'Save', 'Start', ':8890', 'dopo la cartella', 'nuovo progetto da wdm-theme', 'usa il brief di esempio']) {
    assert.ok(testo.includes(voce), `nel primo progetto manca: ${voce}`);
  }
});

// U33: ogni parola della tabella dei gate, e le altre del flusso, ha una riga nel glossario.
test('il glossario spiega le parole dei gate e del flusso', () => {
  const voci = righeDiTabella(sezione('Glossario')).map((r) => r.split('|')[1]);
  for (const parola of ['brief', 'telaio', 'kit di pagina', 'gate', 'kit', '`confirm`', '`[da confermare]`', 'build', 'blocco', 'variante', 'token',
    'parità', '`DESIGN.md`', '`localhost:8848`', 'commit', 'push', 'skill', 'hook', 'WP-CLI', 'MAMP PRO']) {
    assert.ok(voci.some((v) => v.includes(`**${parola}**`)), `nel glossario manca: ${parola}`);
  }
  for (const riga of righeDiTabella(sezione('Il flusso'))) {
    const gate = /^\| \d — ([a-z ]+?)(?: \(| \|)/.exec(riga);
    if (gate) assert.ok(voci.some((v) => v.includes(`**${gate[1]}**`)), `nel glossario manca il gate: ${gate[1]}`);
  }
});

test('problemi comuni: almeno cinque, ognuno con cosa fare', () => {
  const righe = righeDiTabella(sezione('Problemi comuni'));
  assert.ok(righe.length >= 5, `problemi: ${righe.length}`);
  for (const riga of righe) assert.ok(riga.split('|')[2].trim().length > 30, `rimedio troppo corto: ${riga}`);
  for (const voce of ['avvia i server di MAMP PRO', '/reload-plugins', 'localhost:8848', 'Playwright', 'Sourcetree → Impostazioni → Generali']) {
    assert.ok(sezione('Problemi comuni').includes(voce), `nei problemi comuni manca: ${voce}`);
  }
});

test('il brief di esempio esiste ed è citato', () => {
  assert.ok(readme.includes('skills/fse-brief/esempio/brief.md'));
  const brief = fs.readFileSync(path.join(__dirname, '..', 'skills', 'fse-brief', 'esempio', 'brief.md'), 'utf8');
  for (const parte of ['## Pagine', '## Tono', '## Brand', '## Contatti']) assert.ok(brief.includes(parte), parte);
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'skills', 'fse-brief', 'SKILL.md'), 'utf8'), /esempio\/brief\.md/);
});

// Il materiale di chi sviluppa il plugin sta solo in «Sviluppo».
test('prima della sezione Sviluppo non si parla del checkout né delle prove', () => {
  const prima = readme.slice(0, readme.indexOf('## Sviluppo'));
  assert.doesNotMatch(prima, /Documents\/Development|tests\/run\.js|installed_plugins\.json/);
});

