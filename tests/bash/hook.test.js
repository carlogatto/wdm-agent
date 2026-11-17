// I due hook del plugin (ancora in bash: richiedono bash e jq) e gli altri script .sh citati.
// Gli hook giudicano solo i progetti FSE, leggono CLAUDE_PLUGIN_ROOT dall'ambiente, reggono un
// percorso con spazi e non bloccano mai una scrittura per un ambiente incompleto.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { RADICE, citati, assoluto } = require('../lib/citati');

const FIXTURE = path.join(__dirname, '..', 'fixtures');
const SYNC = path.join(RADICE, 'shared', 'scripts', 'sync-theme-json-tokens.js');

function hook(radice, script, file, senzaRadice) {
  const env = { ...process.env, CLAUDE_PLUGIN_ROOT: radice };
  if (senzaRadice) delete env.CLAUDE_PLUGIN_ROOT;
  const r = spawnSync('bash', [path.join(radice, 'hooks', script)], { encoding: 'utf8', env, input: JSON.stringify({ tool_input: { file_path: file } }) });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

describe('hook del plugin', () => {
  let tmp, temaFse, bloccoFse;

  // Copia il blocco di fixture in <cartella>/blocks/wdm-block-cta e restituisce il suo block.json.
  const blocco = (cartella, senza) => {
    const dir = path.join(cartella, 'blocks', 'wdm-block-cta');
    fs.cpSync(path.join(FIXTURE, 'blocco', 'wdm-block-cta'), dir, { recursive: true });
    if (senza) fs.rmSync(path.join(dir, senza));
    return path.join(dir, 'block.json');
  };

  before(() => {
    for (const comando of ['bash', 'jq']) {
      if (spawnSync(comando, ['--version']).status !== 0) throw new Error(`${comando} non trovato: le prove del gruppo bash lo richiedono (altrimenti: node tests/run.js --senza bash).`);
    }
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wdm-agent-hook-'));
    // Un progetto FSE: DESIGN.md con theme_family fse, tema con i token allineati.
    const sito = path.join(tmp, 'fse');
    temaFse = path.join(sito, 'wp-content', 'themes', 't');
    fs.cpSync(path.join(FIXTURE, 'tema'), temaFse, { recursive: true });
    fs.writeFileSync(path.join(sito, 'DESIGN.md'), fs.readFileSync(path.join(FIXTURE, 'fse-site', 'DESIGN.md'), 'utf8') + '\n## Design Tokens\n\n');
    const sync = spawnSync(process.execPath, [SYNC, temaFse], { encoding: 'utf8' });
    assert.equal(sync.status, 0, sync.stdout + sync.stderr);
    bloccoFse = blocco(temaFse);
  });

  after(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('(h) hooks.json registra i due hook su Write|Edit, via CLAUDE_PLUGIN_ROOT', () => {
    const post = JSON.parse(fs.readFileSync(path.join(RADICE, 'hooks', 'hooks.json'), 'utf8')).hooks.PostToolUse;
    assert.equal(post[0].matcher, 'Write|Edit');
    assert.equal(post[0].hooks.length, 2);
    const comandi = post[0].hooks.map((h) => h.command).join(' ');
    assert.ok(comandi.includes('${CLAUDE_PLUGIN_ROOT}/hooks/check-block-contract.sh'));
    assert.ok(comandi.includes('${CLAUDE_PLUGIN_ROOT}/hooks/check-design-tokens.sh'));
  });

  it('(a) theme.json con i token allineati: exit 0, silenzio', () => {
    const r = hook(RADICE, 'check-design-tokens.sh', path.join(temaFse, 'theme.json'));
    assert.deepEqual(r, { status: 0, stdout: '', stderr: '' });
  });

  it('(a2) theme.json modificato: l\'hook avvisa con le differenze e non scrive', () => {
    const sito = path.join(tmp, 'stale');
    fs.cpSync(path.join(tmp, 'fse'), sito, { recursive: true });
    const file = path.join(sito, 'wp-content', 'themes', 't', 'theme.json');
    const theme = JSON.parse(fs.readFileSync(file, 'utf8'));
    theme.settings.layout.contentSize = '1px';
    fs.writeFileSync(file, JSON.stringify(theme));
    const design = fs.readFileSync(path.join(sito, 'DESIGN.md'), 'utf8');
    const r = hook(RADICE, 'check-design-tokens.sh', file);
    assert.equal(r.status, 0, r.stderr);
    const contesto = JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
    assert.match(contesto, /STALE/);
    assert.match(contesto, /1px/);
    assert.equal(fs.readFileSync(path.join(sito, 'DESIGN.md'), 'utf8'), design);
  });

  it('(b) theme.json di un progetto che non è FSE: exit 0, silenzio', () => {
    const r = hook(RADICE, 'check-design-tokens.sh', path.join(FIXTURE, 'starter-site', 'wp-content', 'themes', 'x', 'theme.json'));
    assert.deepEqual(r, { status: 0, stdout: '', stderr: '' });
  });

  it('(c) un file che non è theme.json: exit 0, silenzio', () => {
    const r = hook(RADICE, 'check-design-tokens.sh', '/x/wp-content/themes/t/src/scss/bs5/_variables.scss');
    assert.deepEqual(r, { status: 0, stdout: '', stderr: '' });
  });

  it('(i) block.json fuori da un progetto FSE: exit 0 anche senza README', () => {
    const r = hook(RADICE, 'check-block-contract.sh', blocco(path.join(tmp, 'altro'), 'README.md'));
    assert.deepEqual(r, { status: 0, stdout: '', stderr: '' });
  });

  it('(d) block.json senza README in un progetto FSE: exit 2, il messaggio cita README.md', () => {
    const r = hook(RADICE, 'check-block-contract.sh', blocco(path.join(tmp, 'fse', 'wp-content', 'themes', 'u'), 'README.md'));
    assert.equal(r.status, 2, r.stderr);
    assert.match(r.stderr, /README\.md/);
  });

  it('(d2) block.json senza il sorgente di un file dichiarato: exit 2, il messaggio cita il sorgente', () => {
    const r = hook(RADICE, 'check-block-contract.sh', blocco(path.join(tmp, 'fse', 'wp-content', 'themes', 'v'), path.join('src', 'style.scss')));
    assert.equal(r.status, 2, r.stderr);
    assert.match(r.stderr, /src\/style\.scss/);
  });

  it('(e) blocco completo in un progetto FSE: exit 0, silenzio', () => {
    assert.deepEqual(hook(RADICE, 'check-block-contract.sh', bloccoFse), { status: 0, stdout: '', stderr: '' });
  });

  it('(f) plugin in una cartella con spazi: i due hook funzionano', () => {
    const copia = path.join(tmp, 'dir con spazi', 'wdm-agent');
    for (const cartella of ['hooks', 'shared']) fs.cpSync(path.join(RADICE, cartella), path.join(copia, cartella), { recursive: true });
    assert.deepEqual(hook(copia, 'check-block-contract.sh', bloccoFse), { status: 0, stdout: '', stderr: '' });
    assert.deepEqual(hook(copia, 'check-design-tokens.sh', path.join(temaFse, 'theme.json')), { status: 0, stdout: '', stderr: '' });
  });

  it('(g) CLAUDE_PLUGIN_ROOT assente: exit 0 con un avviso, mai un blocco', () => {
    const r = hook(RADICE, 'check-design-tokens.sh', path.join(temaFse, 'theme.json'), true);
    assert.equal(r.status, 0);
    assert.match(r.stderr, /wdm-agent hook/);
  });
});

describe('script .sh citati da skill e hooks.json', () => {
  for (const relativo of citati('.sh')) {
    it(`${relativo}: sintassi valida`, () => {
      const r = spawnSync('bash', ['-n', assoluto(relativo)], { encoding: 'utf8' });
      assert.equal(r.status, 0, r.stderr);
    });
  }

  // Il comportamento del setup si prova quando lo script sarà riscritto in Node: qui solo l'avvio.
  it('setup.sh senza argomenti: dice cosa manca ed esce con 2', () => {
    const r = spawnSync('bash', [assoluto('skills/fse-theme-setup/scripts/setup.sh')], { encoding: 'utf8' });
    assert.equal(r.status, 2, r.stdout + r.stderr);
    assert.match(r.stderr, /missing arguments/);
  });
});
