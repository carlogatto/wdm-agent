// I due hook del plugin, in Node. Giudicano solo i file di un tema dentro un progetto FSE,
// reggono un percorso con spazi, riconoscono i percorsi di Windows e non dipendono dall'ambiente.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { RADICE } = require('./lib/citati');
const { nelTema } = require(path.join(RADICE, 'shared', 'scripts', 'lib', 'tema.js'));

const FIXTURE = path.join(__dirname, 'fixtures');
const SYNC = path.join(RADICE, 'shared', 'scripts', 'sync-theme-json-tokens.js');

// Lanciato come lo lancia hooks.json: node con il percorso dello script, senza shell.
function hook(radice, script, file, opzioni = {}) {
  const env = { ...process.env };
  delete env.CLAUDE_PLUGIN_ROOT;
  const r = spawnSync(process.execPath, [path.join(radice, 'hooks', script)], {
    encoding: 'utf8', env, input: JSON.stringify({ cwd: opzioni.cwd || os.tmpdir(), tool_input: { file_path: file } }),
  });
  assert.ifError(r.error);
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

const ZITTO = { status: 0, stdout: '', stderr: '' };

describe('hooks.json', () => {
  it('registra i due hook su Write|Edit: node con il percorso negli argomenti, senza shell', () => {
    const post = JSON.parse(fs.readFileSync(path.join(RADICE, 'hooks', 'hooks.json'), 'utf8')).hooks.PostToolUse;
    assert.equal(post[0].matcher, 'Write|Edit');
    assert.deepEqual(post[0].hooks.map((h) => [h.type, h.command, h.args]), [
      ['command', 'node', ['${CLAUDE_PLUGIN_ROOT}/hooks/check-block-contract.js']],
      ['command', 'node', ['${CLAUDE_PLUGIN_ROOT}/hooks/check-design-tokens.js']],
    ]);
  });

  // La sessione dell'utente agente si chiude a fine turno e a fine sessione, comunque sia andato
  // il lavoro (le prove dell'hook stanno in sessione.test.js e in sito/sessione.test.js).
  it('registra la chiusura della sessione su Stop e SessionEnd, senza shell', () => {
    const hooks = JSON.parse(fs.readFileSync(path.join(RADICE, 'hooks', 'hooks.json'), 'utf8')).hooks;
    for (const evento of ['Stop', 'SessionEnd']) {
      assert.deepEqual(hooks[evento].flatMap((g) => g.hooks.map((h) => [h.type, h.command, h.args])), [
        ['command', 'node', ['${CLAUDE_PLUGIN_ROOT}/hooks/chiudi-sessione.js']],
      ], evento);
    }
    assert.deepEqual(Object.keys(hooks).sort(), ['PostToolUse', 'SessionEnd', 'SessionStart', 'Stop']);
  });

  // Dopo una compattazione del contesto (automatica o chiesta con /compact) Claude Code riavvia
  // la sessione con source "compact": lì il plugin rimette il promemoria dello stato.
  it('registra il promemoria dello stato su SessionStart, solo dopo una compattazione', () => {
    const avvio = JSON.parse(fs.readFileSync(path.join(RADICE, 'hooks', 'hooks.json'), 'utf8')).hooks.SessionStart;
    assert.deepEqual(avvio.map((g) => [g.matcher, g.hooks.map((h) => [h.type, h.command, h.args])]), [
      ['compact', [['command', 'node', ['${CLAUDE_PLUGIN_ROOT}/hooks/ricorda-stato.js']]]],
    ]);
    assert.ok(avvio[0].hooks[0].timeout <= 30, 'timeout in secondi, breve: l\'hook legge due file');
  });

  it('nella cartella degli hook non restano script di shell', () => {
    const altri = fs.readdirSync(path.join(RADICE, 'hooks'), { recursive: true }).filter((f) => path.extname(f) !== '' && !/\.(js|json)$/.test(f));
    assert.deepEqual(altri, []);
  });
});

describe('ricorda-stato.js: lo stato rimesso dopo la compattazione', () => {
  let tmp, sito;
  // Lanciato come lo lancia hooks.json: l'ingresso di SessionStart su stdin.
  const avvia = (cwd, ingresso = { hook_event_name: 'SessionStart', source: 'compact' }) => {
    const env = { ...process.env };
    delete env.CLAUDE_PLUGIN_ROOT;
    const r = spawnSync(process.execPath, [path.join(RADICE, 'hooks', 'ricorda-stato.js')], {
      encoding: 'utf8', env, cwd: tmp, input: typeof ingresso === 'string' ? ingresso : JSON.stringify({ session_id: 'x', cwd, ...ingresso }),
    });
    assert.ifError(r.error);
    return { status: r.status, stdout: r.stdout, stderr: r.stderr };
  };

  before(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wdm-agent ricorda-'));
    sito = path.join(tmp, 'Mario Rossi', 'sito');
    fs.mkdirSync(path.join(sito, 'wp-content', 'themes', 'abc-tema', 'blocks'), { recursive: true });
    fs.copyFileSync(path.join(FIXTURE, 'fse-site', 'DESIGN.md'), path.join(sito, 'DESIGN.md'));
  });
  after(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('in un progetto FSE: dice di rileggere DESIGN.md e la skill in corso, con i percorsi; exit 0', () => {
    const r = avvia(sito);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stderr, '');
    assert.ok(r.stdout.includes(path.join(sito, 'DESIGN.md')), r.stdout);
    assert.ok(r.stdout.includes(path.join(RADICE, 'skills')), r.stdout);
    assert.ok(r.stdout.includes(path.join(RADICE, 'shared', 'fse-foundations.md')), r.stdout);
    assert.match(r.stdout, /compatta/i);
    assert.match(r.stdout, /Domande aperte/);
    assert.match(r.stdout, /⏳/);
    assert.match(r.stdout, /SKILL\.md/);
    assert.ok(r.stdout.length < 10000, 'oltre i 10.000 caratteri Claude Code lo taglia');
  });

  it('da dentro il tema trova la site root del progetto', () => {
    const r = avvia(path.join(sito, 'wp-content', 'themes', 'abc-tema', 'blocks'));
    assert.equal(r.status, 0, r.stderr);
    assert.ok(r.stdout.includes(path.join(sito, 'DESIGN.md')), r.stdout);
  });

  it('fuori da un progetto FSE (cartella qualunque, progetto wdm-starter): tace', () => {
    for (const cwd of [tmp, path.join(FIXTURE, 'starter-site')]) assert.deepEqual(avvia(cwd), ZITTO, cwd);
  });

  it('non dopo una compattazione (avvio, ripresa): tace', () => {
    for (const source of ['startup', 'resume', 'clear']) assert.deepEqual(avvia(sito, { hook_event_name: 'SessionStart', source }), ZITTO, source);
  });

  it('ingresso non leggibile: exit 0, nessuna uscita', () => {
    assert.deepEqual(avvia(sito, 'non è json'), ZITTO);
  });
});

describe('riconoscimento dei file di un tema', () => {
  it('percorso di macOS', () => {
    assert.deepEqual(nelTema('/Users/Mario Rossi/Sites/y/wp-content/themes/t/blocks/abc-block-hero/block.json', path.posix), {
      sito: '/Users/Mario Rossi/Sites/y', tema: '/Users/Mario Rossi/Sites/y/wp-content/themes/t', resto: ['blocks', 'abc-block-hero', 'block.json'],
    });
  });

  it('percorso di Windows con spazi, barre rovesciate e lettera di unità', () => {
    assert.deepEqual(nelTema('C:\\Users\\Mario Rossi\\Sites\\x\\wp-content\\themes\\t\\blocks\\abc-block-hero\\block.json', path.win32), {
      sito: 'C:\\Users\\Mario Rossi\\Sites\\x', tema: 'C:\\Users\\Mario Rossi\\Sites\\x\\wp-content\\themes\\t', resto: ['blocks', 'abc-block-hero', 'block.json'],
    });
    assert.deepEqual(nelTema('C:/Users/Mario Rossi/Sites/x/wp-content/themes/t/theme.json', path.win32).resto, ['theme.json']);
  });

  it('fuori da wp-content/themes: null', () => {
    assert.equal(nelTema('/Users/Mario Rossi/Sites/y/wp-includes/blocks/button/block.json', path.posix), null);
    assert.equal(nelTema('C:\\progetti\\plugin\\blocks\\a\\block.json', path.win32), null);
    assert.equal(nelTema('/wp-content/themes', path.posix), null);
  });
});

describe('hook del plugin', () => {
  let tmp, sitoFse, temaFse, bloccoFse;

  // Copia il blocco di fixture in <cartella>/blocks/wdm-block-cta e restituisce il suo block.json.
  const blocco = (cartella, senza) => {
    const dir = path.join(cartella, 'blocks', 'wdm-block-cta');
    fs.cpSync(path.join(FIXTURE, 'blocco', 'wdm-block-cta'), dir, { recursive: true });
    if (senza) fs.rmSync(path.join(dir, senza));
    return path.join(dir, 'block.json');
  };
  const tema = (nome) => path.join(sitoFse, 'wp-content', 'themes', nome);
  // Riscrive il block.json del blocco di fixture copiato in un tema nuovo del progetto FSE.
  const bloccoCon = (nome, cambia) => {
    const file = blocco(tema(nome));
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    fs.writeFileSync(file, typeof cambia === 'string' ? cambia : JSON.stringify(cambia(json) || json));
    return file;
  };

  before(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wdm-agent-hook-'));
    // Un progetto FSE: DESIGN.md con theme_family fse, tema con i token allineati.
    sitoFse = path.join(tmp, 'fse');
    temaFse = tema('t');
    fs.cpSync(path.join(FIXTURE, 'tema'), temaFse, { recursive: true });
    // Un finto WP-CLI: senza la riga {wp-cli} il sync non scrive l'impronta di theme.json.
    const finto = path.join(tmp, 'finto wp cli.js');
    fs.writeFileSync(finto, 'process.stdout.write(":root{--a:1}\\n");\n');
    fs.writeFileSync(path.join(sitoFse, 'DESIGN.md'), fs.readFileSync(path.join(FIXTURE, 'fse-site', 'DESIGN.md'), 'utf8')
      + `\n### Paths\n| Variable | Value |\n|---|---|\n| \`{wp-cli}\` | "${process.execPath}" "${finto}" |\n\n## Design Tokens\n\n`);
    const sync = spawnSync(process.execPath, [SYNC, temaFse], { encoding: 'utf8' });
    assert.equal(sync.status, 0, sync.stdout + sync.stderr);
    bloccoFse = blocco(temaFse);
  });

  after(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('(a) theme.json con i token allineati: exit 0, silenzio', () => {
    assert.deepEqual(hook(RADICE, 'check-design-tokens.js', path.join(temaFse, 'theme.json')), ZITTO);
  });

  it('(a2) un token modificato: l\'hook avvisa con le differenze, chiede la conferma e non scrive', () => {
    const sito = path.join(tmp, 'stale');
    fs.cpSync(sitoFse, sito, { recursive: true });
    const file = path.join(sito, 'wp-content', 'themes', 't', 'theme.json');
    const theme = JSON.parse(fs.readFileSync(file, 'utf8'));
    theme.settings.layout.contentSize = '1px';
    fs.writeFileSync(file, JSON.stringify(theme));
    const design = fs.readFileSync(path.join(sito, 'DESIGN.md'), 'utf8');
    const r = hook(RADICE, 'check-design-tokens.js', file);
    assert.equal(r.status, 0, r.stderr);
    const uscita = JSON.parse(r.stdout).hookSpecificOutput;
    assert.equal(uscita.hookEventName, 'PostToolUse');
    assert.match(uscita.additionalContext, /non sono più allineati/);
    assert.match(uscita.additionalContext, /1px/);
    assert.match(uscita.additionalContext, /chiedi conferma/);
    assert.equal(fs.readFileSync(path.join(sito, 'DESIGN.md'), 'utf8'), design);
  });

  it('(a4) theme.json cambiato fuori dai token: si rigenera subito, senza chiedere conferma', () => {
    const sito = path.join(tmp, 'fuori-dai-token');
    fs.cpSync(sitoFse, sito, { recursive: true });
    const file = path.join(sito, 'wp-content', 'themes', 't', 'theme.json');
    const theme = JSON.parse(fs.readFileSync(file, 'utf8'));
    theme.styles = { ...(theme.styles || {}), elements: { button: { border: { radius: '99px' } } } };
    fs.writeFileSync(file, JSON.stringify(theme));
    const r = hook(RADICE, 'check-design-tokens.js', file);
    assert.equal(r.status, 0, r.stderr);
    const contesto = JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
    assert.match(contesto, /fuori dai token/);
    assert.match(contesto, /non serve una conferma/);
    assert.doesNotMatch(contesto, /chiedi conferma/);
  });

  it('(a3) theme.json rotto: il messaggio dice «non valido», non «non allineati» (U26)', () => {
    const sito = path.join(tmp, 'rotto');
    fs.cpSync(sitoFse, sito, { recursive: true });
    const file = path.join(sito, 'wp-content', 'themes', 't', 'theme.json');
    fs.writeFileSync(file, '{ "settings": ');
    const r = hook(RADICE, 'check-design-tokens.js', file);
    assert.equal(r.status, 0, r.stderr);
    const contesto = JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
    assert.match(contesto, /non valido/);
    assert.doesNotMatch(contesto, /non sono più allineati|chiedi conferma/);
  });

  it('(b) theme.json di un progetto che non è FSE: exit 0, silenzio', () => {
    assert.deepEqual(hook(RADICE, 'check-design-tokens.js', path.join(FIXTURE, 'starter-site', 'wp-content', 'themes', 'x', 'theme.json')), ZITTO);
  });

  it('(c) un file che non è theme.json, o un theme.json fuori da un tema: exit 0, silenzio', () => {
    assert.deepEqual(hook(RADICE, 'check-design-tokens.js', path.join(temaFse, 'src', 'scss', '_breakpoints.scss')), ZITTO);
    fs.writeFileSync(path.join(sitoFse, 'theme.json'), '{');
    assert.deepEqual(hook(RADICE, 'check-design-tokens.js', path.join(sitoFse, 'theme.json')), ZITTO);
  });

  it('(i) block.json fuori da un progetto FSE: exit 0 anche senza README', () => {
    assert.deepEqual(hook(RADICE, 'check-block-contract.js', blocco(path.join(tmp, 'altro', 'wp-content', 'themes', 't'), 'README.md')), ZITTO);
  });

  it('(i2) block.json del core dentro una site root FSE: non è un blocco del tema, exit 0', () => {
    const dir = path.join(sitoFse, 'wp-includes', 'blocks', 'button');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'block.json'), '{"name":"core/button"}');
    assert.deepEqual(hook(RADICE, 'check-block-contract.js', path.join(dir, 'block.json')), ZITTO);
  });

  it('(d) block.json senza README in un progetto FSE: exit 2, il messaggio cita README.md', () => {
    const r = hook(RADICE, 'check-block-contract.js', blocco(tema('u'), 'README.md'));
    assert.equal(r.status, 2, r.stderr);
    assert.match(r.stderr, /README\.md/);
  });

  it('(d2) block.json senza il sorgente di un file dichiarato: exit 2, il messaggio cita il sorgente', () => {
    const r = hook(RADICE, 'check-block-contract.js', blocco(tema('v'), path.join('src', 'style.scss')));
    assert.equal(r.status, 2, r.stderr);
    assert.match(r.stderr, /src\/style\.scss/);
  });

  it('(d3) render dichiarato ma render.php assente: exit 2', () => {
    const r = hook(RADICE, 'check-block-contract.js', blocco(tema('w'), 'render.php'));
    assert.equal(r.status, 2, r.stderr);
    assert.match(r.stderr, /render\.php/);
  });

  it('(d4) version vuota: exit 2', () => {
    const r = hook(RADICE, 'check-block-contract.js', bloccoCon('x', (j) => { j.version = ''; }));
    assert.equal(r.status, 2, r.stderr);
    assert.match(r.stderr, /"version"/);
  });

  it('(d5) block.json che non è JSON: exit 2 con un messaggio leggibile', () => {
    const r = hook(RADICE, 'check-block-contract.js', bloccoCon('y', '{ "name": '));
    assert.equal(r.status, 2, r.stderr);
    assert.match(r.stderr, /non è JSON valido/);
    assert.doesNotMatch(r.stderr, /\bat .*\.js:\d+/);
  });

  it('(d6) prefisso diverso da quello del progetto: exit 2, il messaggio cita il prefisso atteso', () => {
    const file = bloccoCon('z', (j) => { j.name = 'abc/cta'; });
    const dir = path.join(tema('z'), 'blocks', 'abc-block-cta');
    fs.renameSync(path.dirname(file), dir);
    const r = hook(RADICE, 'check-block-contract.js', path.join(dir, 'block.json'));
    assert.equal(r.status, 2, r.stderr);
    assert.match(r.stderr, /"wdm"/);
  });

  it('(d7) nome e cartella che non corrispondono: exit 2', () => {
    const r = hook(RADICE, 'check-block-contract.js', bloccoCon('k', (j) => { j.name = 'wdm/altro'; }));
    assert.equal(r.status, 2, r.stderr);
    assert.match(r.stderr, /wdm-block-altro/);
  });

  it('(e) blocco completo in un progetto FSE: exit 0, silenzio', () => {
    assert.deepEqual(hook(RADICE, 'check-block-contract.js', bloccoFse), ZITTO);
  });

  it('(e2) percorso relativo: si risolve con la cartella di lavoro ricevuta', () => {
    const senzaReadme = blocco(tema('r'), 'README.md');
    const r = hook(RADICE, 'check-block-contract.js', path.relative(sitoFse, senzaReadme), { cwd: sitoFse });
    assert.equal(r.status, 2, r.stderr);
    assert.match(r.stderr, /README\.md/);
  });

  it('(e3) con la riga {theme-folder} si giudica solo il tema del progetto', () => {
    const sito = path.join(tmp, 'un-tema-solo');
    fs.cpSync(sitoFse, sito, { recursive: true });
    const design = path.join(sito, 'DESIGN.md');
    fs.writeFileSync(design, fs.readFileSync(design, 'utf8').replace('| `{prefix}` | wdm |', () => '| `{prefix}` | wdm |\n| `{theme-folder}` | t |'));
    const altro = blocco(path.join(sito, 'wp-content', 'themes', 'twentytwentyfive'), 'README.md');
    assert.deepEqual(hook(RADICE, 'check-block-contract.js', altro), ZITTO);
    const suo = blocco(path.join(sito, 'wp-content', 'themes', 't', 'altro'), 'README.md');
    fs.renameSync(path.join(sito, 'wp-content', 'themes', 't', 'altro', 'blocks', 'wdm-block-cta'), path.join(sito, 'wp-content', 'themes', 't', 'blocks', 'wdm-block-nuovo'));
    void suo;
    const r = hook(RADICE, 'check-block-contract.js', path.join(sito, 'wp-content', 'themes', 't', 'blocks', 'wdm-block-nuovo', 'block.json'));
    assert.equal(r.status, 2, r.stderr);
  });

  it('(f) plugin in una cartella con spazi: i due hook funzionano', () => {
    const copia = path.join(tmp, 'dir con spazi', 'wdm-agent');
    for (const cartella of ['hooks', 'shared']) fs.cpSync(path.join(RADICE, cartella), path.join(copia, cartella), { recursive: true });
    assert.deepEqual(hook(copia, 'check-block-contract.js', bloccoFse), ZITTO);
    assert.deepEqual(hook(copia, 'check-design-tokens.js', path.join(temaFse, 'theme.json')), ZITTO);
    assert.equal(hook(copia, 'check-block-contract.js', blocco(tema('s'), 'README.md')).status, 2);
  });

  it('(g) senza dati in ingresso: exit 0, silenzio', () => {
    for (const script of ['check-block-contract.js', 'check-design-tokens.js']) {
      const r = spawnSync(process.execPath, [path.join(RADICE, 'hooks', script)], { encoding: 'utf8', input: '' });
      assert.deepEqual({ status: r.status, stdout: r.stdout, stderr: r.stderr }, ZITTO);
    }
  });
});
