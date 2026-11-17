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
