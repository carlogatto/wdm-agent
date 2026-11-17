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
  "Verifica dell'installazione", 'Disinstallazione', 'Sviluppo', 'Come sono scritti i percorsi', 'Storia'];

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
