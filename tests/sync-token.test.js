// sync-theme-json-tokens.js: marker portabile, marker vecchio riconosciuto, marker estraneo
// rifiutato, token non allineati segnalati, CSS globale ripulito dagli avvisi di PHP.
// Lavora su una copia temporanea della fixture; WP-CLI è un finto script Node.
// I casi sono in sequenza: ognuno parte dallo stato lasciato dal precedente.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT = path.join(__dirname, '..', 'shared', 'scripts', 'sync-theme-json-tokens.js');
const FIXTURE = path.join(__dirname, 'fixtures');

const NUOVO = '<!-- AUTO-GENERATED:design-tokens da theme.json — non editare. Rigenera con lo script sync-theme-json-tokens.js del plugin wdm-agent -->';
const VECCHIO = '<!-- AUTO-GENERATED:design-tokens da theme.json — non editare. Rigenera con: node ~/.claude/skills/_shared/scripts/sync-theme-json-tokens.js {theme-root} -->';
const ESTRANEO = '<!-- AUTO-GENERATED:design-tokens da _variables.scss -->';

describe('sync-theme-json-tokens.js', () => {
  let sito, tema, design, css, finto;

  const sync = (...args) => {
    const r = spawnSync(process.execPath, [SCRIPT, tema, ...args], { encoding: 'utf8' });
    return { status: r.status, out: r.stdout + r.stderr };
  };
  const leggi = () => fs.readFileSync(design, 'utf8');
  const marker = (testo) => fs.writeFileSync(design, leggi().replace(/^<!-- AUTO-GENERATED:design-tokens.*$/m, () => testo));
  const fintoWpCli = (righe) => fs.writeFileSync(finto, `process.stdout.write(${JSON.stringify(righe.join('\n') + '\n')});\n`);

  before(() => {
    sito = fs.mkdtempSync(path.join(os.tmpdir(), 'wdm-agent-sync-'));
    tema = path.join(sito, 'wp-content', 'themes', 'wdm-theme');
    design = path.join(sito, 'DESIGN.md');
    css = path.join(tema, 'assets', 'css', 'wp-global-styles.css');
    finto = path.join(sito, 'finto-wp-cli.js');
    fs.cpSync(path.join(FIXTURE, 'tema'), tema, { recursive: true });
    fs.writeFileSync(design, fs.readFileSync(path.join(FIXTURE, 'fse-site', 'DESIGN.md'), 'utf8') + '\n## Design Tokens\n\n');
  });

  after(() => fs.rmSync(sito, { recursive: true, force: true }));

  it('(e) lo script non contiene percorsi di ~/.claude', () => {
    assert.ok(!fs.readFileSync(SCRIPT, 'utf8').includes('~/.claude'));
  });

  it('(b) prima generazione: marker nuovo, nessun CSS senza la riga {wp-cli}', () => {
    const r = sync();
    assert.equal(r.status, 0, r.out);
    assert.ok(leggi().includes(NUOVO), 'DESIGN.md senza il marker nuovo');
    assert.ok(!leggi().split('\n').some((riga) => riga.startsWith('<!-- AUTO-GENERATED') && riga.includes('~/.claude')));
    assert.ok(!fs.existsSync(css), 'senza {wp-cli} lo script non deve scrivere il CSS');
  });

  it('(c) --check dopo la generazione: allineato, nessun avviso', () => {
    const r = sync('--check');
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /OK: Design Tokens/);
    assert.doesNotMatch(r.out, /marker da aggiornare/);
  });

  it('(a) marker vecchio e token allineati: exit 0 con avviso', () => {
    marker(VECCHIO);
    const r = sync('--check');
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /marker da aggiornare/);
  });

  it('(a2) la rigenerazione sostituisce il marker vecchio', () => {
    const r = sync();
    assert.equal(r.status, 0, r.out);
    assert.ok(leggi().includes(NUOVO));
    assert.ok(!leggi().includes(VECCHIO));
  });

  it('(f) token non allineati: exit 1 con le differenze', () => {
    const prima = leggi();
    fs.writeFileSync(design, prima.replace(/^(\s*xs: ).*$/m, '$1"0px"  # stale'));
    assert.notEqual(leggi(), prima, 'la fixture non ha un token «xs» da alterare');
    const r = sync('--check');
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /STALE/);
  });

  it('(d) marker di un\'altra fonte: exit 2, nessuna scrittura', () => {
    marker(ESTRANEO);
    const prima = leggi();
    for (const args of [['--check'], []]) {
      const r = sync(...args);
      assert.equal(r.status, 2, r.out);
      assert.match(r.out, /altra fonte/);
    }
    assert.equal(leggi(), prima);
  });

  it('(g) avviso di PHP prima del CSS: il CSS scritto parte dal primo selettore', () => {
    marker(NUOVO);
    fintoWpCli(['Deprecated: Case statements in match', ':root{--wp--preset--color--base:#fff}', 'body{margin:0}']);
    fs.writeFileSync(design, leggi().replace('\n## Design Tokens\n', () => `\n| \`{wp-cli}\` | "${process.execPath}" "${finto}" |\n\n## Design Tokens\n`));
    const r = sync();
    assert.equal(r.status, 0, r.out);
    const scritto = fs.readFileSync(css, 'utf8');
    assert.ok(!scritto.includes('Deprecated'), 'la riga Deprecated è finita nel CSS');
    assert.equal(scritto.slice(scritto.indexOf('*/') + 2).trim().split('\n')[0], ':root{--wp--preset--color--base:#fff}');
    assert.match(r.out, /non CSS scartate/);
  });

  it('(h) solo avvisi di PHP: errore, CSS non scritto', () => {
    fintoWpCli(['Deprecated: only noise']);
    fs.rmSync(css);
    const r = sync();
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /non è CSS/);
    assert.ok(!fs.existsSync(css), 'il CSS è stato scritto con un output che non è CSS');
  });
});

// Ogni caso parte da un progetto appena generato: non dipendono l'uno dall'altro.
describe('sync-theme-json-tokens.js: impronta, marker, scritture', () => {
  const IMPRONTA = /^# impronta theme\.json: [0-9a-f]{64}$/m;
  const CSS = [':root{--a:1}'];
  let radice, n = 0;

  // Un progetto FSE nuovo. `wpCli`: le righe che il finto WP-CLI stampa (senza: nessuna riga {wp-cli}).
  const progetto = (wpCli) => {
    const sito = path.join(radice, `progetto ${++n}`);
    const tema = path.join(sito, 'wp-content', 'themes', 't');
    const design = path.join(sito, 'DESIGN.md');
    const finto = path.join(sito, 'finto wp cli.js');
    fs.cpSync(path.join(FIXTURE, 'tema'), tema, { recursive: true });
    let testo = fs.readFileSync(path.join(FIXTURE, 'fse-site', 'DESIGN.md'), 'utf8');
    if (wpCli !== undefined) {
      fs.writeFileSync(finto, `require('node:fs').writeFileSync(__filename + '.argv', JSON.stringify(process.argv.slice(2)));\nprocess.stdout.write(${JSON.stringify(wpCli.join('\n') + '\n')});\n`);
      testo += `\n### Paths\n| Variable | Value |\n|---|---|\n| \`{wp-cli}\` | "${process.execPath}" "${finto}" --path=/x |\n`;
    }
    fs.writeFileSync(design, testo + '\n## Design Tokens\n\n');
    const p = {
      sito, tema, design, finto,
      sync: (...args) => {
        const r = spawnSync(process.execPath, [SCRIPT, tema, ...args], { encoding: 'utf8' });
        return { status: r.status, out: r.stdout + r.stderr };
      },
      leggi: () => fs.readFileSync(design, 'utf8'),
      theme: (cambia) => {
        const file = path.join(tema, 'theme.json');
        const json = JSON.parse(fs.readFileSync(file, 'utf8'));
        cambia(json);
        fs.writeFileSync(file, JSON.stringify(json, null, 2));
      },
    };
    return p;
  };
  const generato = (wpCli) => {
    const p = progetto(wpCli);
    const r = p.sync();
    assert.equal(r.status, 0, r.out);
    return p;
  };

  before(() => { radice = fs.mkdtempSync(path.join(os.tmpdir(), 'wdm-agent-sync2-')); });
  after(() => fs.rmSync(radice, { recursive: true, force: true }));

  it('il blocco generato porta l\'impronta di theme.json; --check è allineato', () => {
    const p = generato(CSS);
    assert.match(p.leggi(), IMPRONTA);
    assert.equal(p.sync('--check').status, 0);
  });

  it('theme.json riformattato senza cambiare i valori: resta allineato', () => {
    const p = generato();
    p.theme(() => {});
    assert.equal(p.sync('--check').status, 0);
  });

  it('theme.json cambiato fuori dai token (styles.elements.button): exit 3, nessun token cambiato (U27)', () => {
    const p = generato(CSS);
    p.theme((t) => { t.styles = { ...(t.styles || {}), elements: { button: { border: { radius: '99px' } } } }; });
    const r = p.sync('--check');
    assert.equal(r.status, 3, r.out);
    assert.match(r.out, /nessun token è cambiato/);
    assert.match(r.out, /wp-global-styles\.css/);
  });

  it('un token cambiato: exit 1 con la differenza, senza la riga dell\'impronta', () => {
    const p = generato();
    p.theme((t) => { t.settings.layout.contentSize = '1px'; });
    const r = p.sync('--check');
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /1px/);
    assert.doesNotMatch(r.out, /impronta theme\.json/);
  });

  it('blocco senza impronta (progetto di prima) e token uguali: allineato, con l\'invito a rigenerare', () => {
    const p = generato(CSS);
    fs.writeFileSync(p.design, p.leggi().replace(/^# impronta theme\.json: .*\n/m, ''));
    const r = p.sync('--check');
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /impronta/);
    const dopo = p.sync();
    assert.equal(dopo.status, 0, dopo.out);
    assert.match(p.leggi(), IMPRONTA);
  });

  it('senza la riga {wp-cli} il CSS non si rigenera: i token si scrivono, l\'impronta no', () => {
    const p = generato();
    assert.doesNotMatch(p.leggi(), /impronta theme\.json/);
    const r = p.sync('--check');
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /impronta di theme\.json assente/);
    p.theme((t) => { t.settings.layout.contentSize = '3px'; });
    assert.equal(p.sync().status, 0);
    assert.match(p.leggi(), /contentSize: 3px/);
    assert.doesNotMatch(p.leggi(), /impronta theme\.json/);
  });

  it('DESIGN.md con i fine riga di Windows (CRLF): allineato, e resta in CRLF dopo la rigenerazione', () => {
    const p = generato(CSS);
    fs.writeFileSync(p.design, p.leggi().replace(/\n/g, '\r\n'));
    const r = p.sync('--check');
    assert.equal(r.status, 0, r.out);
    p.theme((t) => { t.settings.layout.contentSize = '4px'; });
    assert.equal(p.sync('--check').status, 1);
    assert.equal(p.sync().status, 0);
    assert.match(p.leggi(), /contentSize: 4px/);
    assert.match(p.leggi(), /\r\n/);
    assert.doesNotMatch(p.leggi(), /[^\r]\n/);
    assert.equal(p.sync('--check').status, 0);
  });

  it('WP-CLI fallisce: DESIGN.md non viene riscritto, così --check resta non allineato', () => {
    const p = generato([':root{--a:1}']);
    fs.writeFileSync(p.finto, 'process.exit(1);\n');
    const prima = p.leggi();
    p.theme((t) => { t.settings.layout.contentSize = '1px'; });
    const r = p.sync();
    assert.equal(r.status, 1, r.out);
    assert.equal(p.leggi(), prima);
    assert.equal(p.sync('--check').status, 1);
  });

  it('{wp-cli} con percorsi tra virgolette e spazi: eseguito senza shell, argomenti interi', () => {
    const p = generato([':root{--a:1}']);
    assert.deepEqual(JSON.parse(fs.readFileSync(p.finto + '.argv', 'utf8')), ['--path=/x', 'eval', 'echo wp_get_global_stylesheet();']);
    assert.match(fs.readFileSync(path.join(p.tema, 'assets', 'css', 'wp-global-styles.css'), 'utf8'), /:root\{--a:1\}/);
    assert.doesNotMatch(fs.readFileSync(SCRIPT, 'utf8'), /execSync|shell:\s*true/);
  });

  it('{wp-cli} che non parte: errore leggibile, niente stack', () => {
    const p = progetto();
    fs.writeFileSync(p.design, p.leggi().replace('\n## Design Tokens', () => '\n### Paths\n| Variable | Value |\n|---|---|\n| `{wp-cli}` | /php/che/non/esiste --path=/x |\n\n## Design Tokens'));
    const r = p.sync();
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /\{wp-cli\}/);
    assert.doesNotMatch(r.out, /\bat .*\.js:\d+/);
  });

  it('il marker citato in una riga di prosa non conta: si riscrive solo il blocco vero', () => {
    const p = generato();
    const nota = 'Nota: il blocco tra <!-- AUTO-GENERATED:design-tokens e <!-- /AUTO-GENERATED:design-tokens --> non si modifica a mano.';
    fs.writeFileSync(p.design, p.leggi().replace('## Project Config', () => `${nota}\n\nTesto da conservare.\n\n## Project Config`));
    p.theme((t) => { t.settings.layout.contentSize = '2px'; });
    const r = p.sync();
    assert.equal(r.status, 0, r.out);
    assert.ok(p.leggi().includes(`${nota}\n\nTesto da conservare.\n\n## Project Config`), 'la prosa che cita il marker è stata toccata');
    assert.match(p.leggi(), /contentSize: 2px/);
    assert.equal(p.leggi().match(/^<!-- AUTO-GENERATED:design-tokens/gm).length, 1);
  });

  it('due blocchi con il marker a inizio riga: exit 2, nessuna scrittura', () => {
    const p = generato();
    const blocco = /^<!-- AUTO-GENERATED:design-tokens[\s\S]*?^<!-- \/AUTO-GENERATED:design-tokens -->$/m.exec(p.leggi())[0];
    fs.writeFileSync(p.design, `${p.leggi()}\n${blocco}\n`);
    const prima = p.leggi();
    for (const args of [['--check'], []]) {
      const r = p.sync(...args);
      assert.equal(r.status, 2, r.out);
      assert.match(r.out, /ripetuto/);
    }
    assert.equal(p.leggi(), prima);
  });

  it('un token con $& nel valore arriva alla lettera in DESIGN.md', () => {
    const p = generato();
    p.theme((t) => { t.settings.color.palette[0].name = 'Base $& $1 $$'; });
    const r = p.sync();
    assert.equal(r.status, 0, r.out);
    assert.ok(p.leggi().includes('# Base $& $1 $$'), 'il nome con $& non è arrivato alla lettera');
    assert.equal(p.sync('--check').status, 0);
  });

  it('un breakpoint con parentesi nel valore si legge intero', () => {
    const p = progetto();
    const scss = path.join(p.tema, 'src', 'scss', '_breakpoints.scss');
    fs.writeFileSync(scss, fs.readFileSync(scss, 'utf8').replace('lg: 992px', 'lg: calc(900px + 92px)'));
    p.theme((t) => { t.settings.custom.breakpoints.lg = 'calc(900px + 92px)'; });
    const r = p.sync();
    assert.equal(r.status, 0, r.out);
    assert.equal(p.sync('--check').status, 0);
  });

  it('theme.json che non è un oggetto: exit 2 «non valido», niente stack', () => {
    for (const contenuto of ['null', '[]', '"testo"']) {
      const p = progetto();
      fs.writeFileSync(path.join(p.tema, 'theme.json'), contenuto);
      const r = p.sync('--check');
      assert.equal(r.status, 2, `${contenuto}: ${r.out}`);
      assert.match(r.out, /non valido/);
      assert.doesNotMatch(r.out, /TypeError|\bat .*\.js:\d+/);
    }
  });

  it('i messaggi di errore dicono cosa fare', () => {
    const senzaDesign = progetto();
    fs.rmSync(senzaDesign.design);
    assert.match(senzaDesign.sync('--check').out, /fse-theme-setup/);
    const starter = progetto();
    fs.writeFileSync(starter.design, starter.leggi().replace('| fse |', '| starter |'));
    const r = starter.sync('--check');
    assert.equal(r.status, 2, r.out);
    assert.match(r.out, /theme_family/);
  });
});
