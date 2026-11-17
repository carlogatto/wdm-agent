// Le skill citano i file del plugin con ${CLAUDE_PLUGIN_ROOT}: ogni file citato esiste, e ogni
// script citato si avvia (E2: una prova che cerca solo il testo resta verde con uno script
// rotto). Qui gli script .js; gli .sh stanno in bash/, i .php in sito/.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { RADICE, citati, assoluto } = require('./lib/citati');

const skill = (nome) => fs.readFileSync(path.join(RADICE, 'skills', nome, 'SKILL.md'), 'utf8');
// Le virgolette attorno al percorso sono ammesse e non richieste.
const cita = (comando, relativo) => new RegExp(`${comando}"?\\$\\{CLAUDE_PLUGIN_ROOT\\}/${relativo.replaceAll('.', '\\.')}`, 'g');
const volte = (nome, modello) => (skill(nome).match(modello) || []).length;

const FONDAMENTA = cita('', 'shared/fse-foundations.md');
const NAV = cita('eval-file ', 'skills/fse-menu-build/scripts/wp-navigation.php');
const SYNC = cita('node ', 'shared/scripts/sync-theme-json-tokens.js');
const PAGE = cita('eval-file ', 'skills/fse-build/scripts/wp-page.php');
const MENU = cita('', 'skills/fse-menu-build/SKILL.md');
const SETUP = cita('bash ', 'skills/fse-theme-setup/scripts/setup.sh');

test('ogni skill legge le fondamenta dal plugin', () => {
  for (const nome of ['fse-theme-setup', 'fse-brief', 'fse-kit', 'fse-build', 'fse-block-edit', 'fse-menu-build']) {
    assert.ok(volte(nome, FONDAMENTA) >= 1, nome);
  }
});

test('ogni skill cita gli script che usa', () => {
  const almeno = [
    ['fse-menu-build', NAV, 4], ['fse-theme-setup', NAV, 2],
    ['fse-build', SYNC, 1], ['fse-block-edit', SYNC, 1], ['fse-theme-setup', SYNC, 2], ['fse-brief', SYNC, 1],
    ['fse-build', PAGE, 2], ['fse-build', MENU, 1], ['fse-theme-setup', MENU, 1],
  ];
  for (const [nome, modello, n] of almeno) {
    assert.ok(volte(nome, modello) >= n, `${nome}: attese almeno ${n} citazioni di ${modello.source}, trovate ${volte(nome, modello)}`);
  }
  assert.equal(volte('fse-theme-setup', SETUP), 1, 'fse-theme-setup lancia setup.sh una volta sola');
  assert.ok(!skill('fse-theme-setup').includes('Template of `new-project-setup`'));
});

test('i testi citano file del plugin', () => {
  assert.ok(citati().length >= 8, `citati: ${citati().join(', ')}`);
  assert.ok(citati('.js').length >= 1 && citati('.sh').length >= 3 && citati('.php').length >= 2);
});

for (const relativo of citati()) {
  test(`${relativo} esiste`, () => {
    assert.ok(fs.existsSync(assoluto(relativo)));
  });
}

for (const relativo of citati('.js')) {
  test(`${relativo} si avvia`, () => {
    const sintassi = spawnSync(process.execPath, ['--check', assoluto(relativo)], { encoding: 'utf8' });
    assert.equal(sintassi.status, 0, sintassi.stderr);
    // Senza argomenti uno script del plugin spiega come si usa ed esce con 2: non va in errore.
    const lancio = spawnSync(process.execPath, [assoluto(relativo)], { encoding: 'utf8' });
    assert.equal(lancio.status, 2, lancio.stdout + lancio.stderr);
    assert.match(lancio.stderr, /uso:/);
  });
}
