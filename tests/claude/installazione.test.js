// Sulla macchina di chi sviluppa il plugin: la CLI di Claude Code valida il plugin e lo elenca
// tra gli installati, e in ~/.claude non restano i doppioni dell'epoca delle skill globali.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const RADICE = path.join(__dirname, '..', '..');
const CLAUDE = path.join(os.homedir(), '.claude');

function claude(...args) {
  const r = spawnSync('claude', args, { encoding: 'utf8' });
  assert.ifError(r.error && new Error(`la CLI "claude" non parte (${r.error.message}): le prove del gruppo claude la richiedono (altrimenti: node tests/run.js --senza claude).`));
  return { status: r.status, out: r.stdout + r.stderr };
}

test('claude plugin validate passa sulla radice del plugin', () => {
  const r = claude('plugin', 'validate', RADICE);
  assert.equal(r.status, 0, r.out);
});

test('claude plugin list elenca wdm-agent', () => {
  const r = claude('plugin', 'list');
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /wdm-agent/);
});

test('nessun doppione delle skill fse-* e dei file condivisi in ~/.claude', () => {
  const doppioni = [
    ...['fse-theme-setup', 'fse-brief', 'fse-kit', 'fse-build', 'fse-block-edit', 'fse-menu-build'].map((s) => path.join('skills', s)),
    path.join('skills', '_shared', 'fse-foundations.md'),
    path.join('skills', '_shared', 'scripts', 'sync-theme-json-tokens.js'),
    path.join('hooks', 'check-block-contract.sh'),
  ].filter((relativo) => fs.existsSync(path.join(CLAUDE, relativo)));
  assert.deepEqual(doppioni, []);
});

test('gli hook fse non sono registrati una seconda volta fuori dal plugin', () => {
  const leggi = (relativo) => (fs.existsSync(path.join(CLAUDE, relativo)) ? fs.readFileSync(path.join(CLAUDE, relativo), 'utf8') : '');
  assert.ok(!leggi('settings.json').includes('check-block-contract.sh'), 'settings.json registra ancora check-block-contract.sh');
  assert.ok(!/theme\.json/.test(leggi(path.join('hooks', 'check-design-tokens.sh'))), "l'hook globale check-design-tokens.sh ha ancora il ramo theme.json");
});
