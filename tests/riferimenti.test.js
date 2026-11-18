// Le skill citano i file del plugin con ${CLAUDE_PLUGIN_ROOT}: ogni file citato esiste, e ogni
// script citato si avvia (E2: una prova che cerca solo il testo resta verde con uno script
// rotto). Qui gli script .js; i .php stanno in sito/. Gli hook hanno la loro prova
// (hook.test.js): qui se ne controlla solo la sintassi. Di script di shell non ce ne sono più.
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
const SETUP = cita('node ', 'skills/fse-theme-setup/scripts/setup.js');
const MAMP = cita('node ', 'skills/fse-theme-setup/scripts/mamp.js');

test('ogni skill legge le fondamenta dal plugin', () => {
  for (const nome of ['fse-theme-setup', 'fse-brief', 'fse-kit', 'fse-build', 'fse-block-edit', 'fse-menu-build']) {
    assert.ok(volte(nome, FONDAMENTA) >= 1, nome);
  }
});

test('ogni skill cita gli script che usa', () => {
  const almeno = [
    ['fse-menu-build', NAV, 4], ['fse-theme-setup', NAV, 3],
    ['fse-build', SYNC, 1], ['fse-block-edit', SYNC, 1], ['fse-theme-setup', SYNC, 2], ['fse-brief', SYNC, 1],
    ['fse-build', PAGE, 2], ['fse-build', MENU, 1], ['fse-theme-setup', MENU, 1],
  ];
  for (const [nome, modello, n] of almeno) {
    assert.ok(volte(nome, modello) >= n, `${nome}: attese almeno ${n} citazioni di ${modello.source}, trovate ${volte(nome, modello)}`);
  }
  assert.equal(volte('fse-theme-setup', SETUP), 1, 'fse-theme-setup lancia setup.js in un punto solo');
  assert.equal(volte('fse-theme-setup', MAMP), 1, 'fse-theme-setup lancia mamp.js in un punto solo');
  assert.ok(!skill('fse-theme-setup').includes('Template of `new-project-setup`'));
});

// Una cartella può avere spazi nel nome («Mario Rossi»): nei comandi di skill e fondamenta ogni
// percorso sta tra virgolette, altrimenti bash lo spezza.
test('nei comandi i percorsi stanno tra virgolette', () => {
  const testi = [...['fse-theme-setup', 'fse-brief', 'fse-kit', 'fse-build', 'fse-block-edit', 'fse-menu-build'].map((nome) => path.join(RADICE, 'skills', nome, 'SKILL.md')),
    path.join(RADICE, 'shared', 'fse-foundations.md')];
  const SEGNAPOSTO = '\\{(?:theme-root|site-root|scratchpad)\\}';
  const nudi = [
    /\b(node|eval-file) \$\{CLAUDE_PLUGIN_ROOT\}/,
    new RegExp(`\\bcd ${SEGNAPOSTO}`),
    new RegExp(`^\\s*\\[ -[a-z] ${SEGNAPOSTO}`),
    // In una riga di comando: un argomento (anche part=percorso, o dopo >) che comincia con un segnaposto di percorso.
    new RegExp(`^\\s*(\\{wp-cli\\}|node |cd |\\[ ).*[\\s>]([a-z]+=)?${SEGNAPOSTO}`),
    new RegExp(`^\\s+([a-z]+=)?${SEGNAPOSTO}\\S* \\\\$`),
  ];
  const trovate = testi.flatMap((f) => fs.readFileSync(f, 'utf8').split('\n')
    .flatMap((riga, i) => (nudi.some((modello) => modello.test(riga)) ? [`${path.relative(RADICE, f)}:${i + 1}: ${riga.trim().slice(0, 120)}`] : [])));
  assert.deepEqual(trovate, []);
});

test('i testi citano file del plugin', () => {
  assert.ok(citati().length >= 8, `citati: ${citati().join(', ')}`);
  assert.ok(citati('.js').length >= 5 && citati('.php').length >= 2);
  assert.deepEqual(citati('.sh'), [], 'nessuno script di shell: il plugin gira anche senza bash');
});

test('nel plugin non restano script di shell, e nessuno script chiama comandi del sistema', () => {
  const tutti = fs.readdirSync(RADICE, { recursive: true }).filter((f) => !/^(\.git|docs|node_modules)([\\/]|$)/.test(f));
  assert.deepEqual(tutti.filter((f) => f.endsWith('.sh')), []);
  for (const f of tutti.filter((f) => /^(hooks|shared|skills)[\\/].*\.js$/.test(f))) {
    assert.doesNotMatch(fs.readFileSync(path.join(RADICE, f), 'utf8'), /execSync|shell:\s*true|\bcurl\b|\bjq\b|\bsed -/, f);
  }
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
    // Hook e modelli Playwright non sono comandi: hanno le loro prove (hook.test.js, sessione.test.js).
    if (relativo.startsWith('hooks/') || relativo.startsWith('shared/playwright/')) return;
    // Senza argomenti uno script del plugin spiega come si usa ed esce con 2: non va in errore.
    const lancio = spawnSync(process.execPath, [assoluto(relativo)], { encoding: 'utf8' });
    assert.equal(lancio.status, 2, lancio.stdout + lancio.stderr);
    assert.match(lancio.stderr, /uso:/);
  });
}
