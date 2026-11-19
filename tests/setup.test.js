// skills/fse-theme-setup/scripts/setup.js, le parti che non toccano il disco: i valori si
// controllano tutti prima di cominciare (U04), e la sostituzione scrive il titolo nel modo giusto
// per ogni tipo di file e lascia stare i nomi che non sono prefissi (U03, U04).
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { RADICE } = require('./lib/citati');
const SCRIPT = path.join(RADICE, 'skills', 'fse-theme-setup', 'scripts', 'setup.js');
const { valida, sostituisci, senzaImpronta, designDelProgetto } = require(SCRIPT);

const BUONI = { prefix: 'atl', slug: 'atelier', textdomain: 'atelier-td', title: "L'Atelier & Co", 'local-url': 'https://atelier.local:8890/' };
// Le sequenze di escape si compongono qui: scritte per esteso in un file non arrivano intatte.
const U = `${String.fromCharCode(92)}u`;

describe('setup.js: controllo dei valori', () => {
  const errori = (cambia) => valida({ ...BUONI, ...cambia });

  it('valori buoni: nessun errore', () => {
    assert.deepEqual(valida(BUONI), []);
    assert.deepEqual(errori({ title: 'Pinco Pallino', textdomain: 'atelier' }), []);
  });

  it('prefisso: minuscolo, alfanumerico, inizia con una lettera, senza «wdm»', () => {
    for (const prefix of ['Atl', 'a-b', '1ab', 'wdmx', '', 'a b']) {
      assert.match(errori({ prefix }).join('\n'), /--prefix/, JSON.stringify(prefix));
    }
  });

  it('slug e text domain: kebab-case, senza «wdm»', () => {
    for (const valore of ['Atelier', '-atelier', 'il mio sito', 'wdm-cliente', 'a_b', '']) {
      assert.match(errori({ slug: valore }).join('\n'), /--slug/, JSON.stringify(valore));
      assert.match(errori({ textdomain: valore }).join('\n'), /--textdomain/, JSON.stringify(valore));
    }
  });

  it('indirizzo locale: http o https, con la barra finale', () => {
    for (const url of ['atelier.local', 'https://atelier.local:8890', 'ftp://x/', "https://a'b/", '']) {
      assert.match(errori({ 'local-url': url }).join('\n'), /--local-url/, JSON.stringify(url));
    }
    assert.deepEqual(errori({ 'local-url': 'http://localhost:8888/' }), []);
  });

  it('titolo: apostrofo, & e accenti ammessi; virgolette, barra rovesciata, $, <, |, a capo e «wdm» no', () => {
    for (const title of ["L'Atelier", 'Caffè & Cornetto', 'Studio 2.0 - Roma!']) assert.deepEqual(errori({ title }), [], title);
    for (const title of ['Dice "ciao"', 'a\\b', 'costa $5', 'a`b', '<b>', 'a|b', 'riga\nnuova', '', '   ', 'WDM Studio', 'il wdm']) {
      assert.match(errori({ title }).join('\n'), /--title/, JSON.stringify(title));
    }
  });

  it('tutti gli errori insieme, non solo il primo', () => {
    assert.equal(errori({ prefix: 'X', slug: 'Y', title: '' }).length, 3);
  });
});

describe('setup.js: sostituzione nei file di testo', () => {
  const s = (testo, file, dove) => sostituisci(testo, file, BUONI, dove);

  it('prefisso in ogni forma: classi, funzioni, nomi di blocco, categorie, maiuscolo', () => {
    assert.equal(s('.wdm-header { --wdm-columns: 2 }', 'a.scss'), '.atl-header { --atl-columns: 2 }');
    assert.equal(s("function wdm_render() { register( 'wdm', 'wdm/hero' ); }", 'a.php'), "function atl_render() { register( 'atl', 'atl/hero' ); }");
    assert.equal(s('{ "category": "wdm", "name": "wdm/cta" }', 'block.json'), '{ "category": "atl", "name": "atl/cta" }');
    assert.equal(s(' * Categories: wdm\n# WDM — blocchi', 'a.php'), ' * Categories: atl\n# ATL — blocchi');
  });

  it('un file di qualunque tipo, anche .sh o senza estensione', () => {
    assert.equal(s('URL="${WDM_URL:-x}" # wdm-swiper', 'tools/check.sh'), 'URL="${ATL_URL:-x}" # atl-swiper');
    assert.equal(s('wdm-block-hero', 'Makefile'), 'atl-block-hero');
  });

  it('text domain nel tema, slug nei percorsi e nell\'indirizzo', () => {
    assert.equal(s("__( 'Ciao', 'wdm-theme' )", 'a.php'), "__( 'Ciao', 'atelier-td' )");
    assert.equal(s('Text Domain: wdm-theme', 'style.css'), 'Text Domain: atelier-td');
    assert.equal(s('da `wp-content/themes/wdm-theme/` su https://wdm-theme.local:8890/', 'README.md'), 'da `wp-content/themes/atelier/` su https://atelier.local:8890/');
  });

  it('nei file della site root «wdm-theme» è sempre la cartella del progetto', () => {
    assert.equal(s('!wp-content/themes/wdm-theme/\nwdm-theme-db', '.gitignore', 'sito'), '!wp-content/themes/atelier/\natelier-db');
  });

  it('i nomi che non sono prefissi restano: plugin, starter, repo del tema base', () => {
    const testo = 'plugin `wdm-agent` (repo `carlogatto/wdm-agent`), wdm-agent:fse-kit, come wdm-starter; clone di https://github.com/carlogatto/wdm-theme.git';
    for (const [file, dove] of [['README.md', 'tema'], ['README.md', 'sito'], ['a.kit', 'tema']]) assert.equal(s(testo, file, dove), testo);
  });

  it('titolo in una stringa PHP o JS tra apici: apostrofo protetto', () => {
    assert.equal(s("        'title' => 'WDM Theme',", 'blocks.php'), "        'title' => 'L\\'Atelier & Co',");
    assert.equal(s("  register_block_pattern_category( 'wdm', array( 'label' => 'WDM Theme' ) );", 'custom.php'), "  register_block_pattern_category( 'atl', array( 'label' => 'L\\'Atelier & Co' ) );");
    assert.equal(s("const t = 'WDM Theme'", 'a.js'), "const t = 'L\\'Atelier & Co'");
    assert.equal(s('const t = "WDM Theme"', 'a.js'), 'const t = "L\'Atelier & Co"');
  });

  it('titolo nel testo di .html, .kit e nell\'HTML di un file PHP: & diventa &amp;', () => {
    assert.equal(s('<p><strong>WDM Theme</strong></p>', 'parts/footer.html'), "<p><strong>L'Atelier &amp; Co</strong></p>");
    assert.equal(s('<a href="#">WDM Theme</a>', 'a.kit'), '<a href="#">L\'Atelier &amp; Co</a>');
    assert.equal(s('<h2>WDM Theme</h2>', 'patterns/a.php'), "<h2>L'Atelier &amp; Co</h2>");
  });

  it('titolo dentro gli attributi di un commento di blocco: sequenze di escape, come le scrive WordPress', () => {
    assert.equal(
      s('<!-- wp:wdm/cta {"title":"WDM Theme"} /--><p>WDM Theme</p>', 'parts/x.html'),
      `<!-- wp:atl/cta {"title":"L'Atelier ${U}0026 Co"} /--><p>L'Atelier &amp; Co</p>`
    );
  });

  it('titolo in JSON, CSS e Markdown: così com\'è', () => {
    assert.equal(s('{ "title": "WDM Theme" }', 'a.json'), '{ "title": "L\'Atelier & Co" }');
    assert.doesNotThrow(() => JSON.parse(s('{ "title": "WDM Theme" }', 'a.json')));
    assert.equal(s('Theme Name: WDM Theme', 'style.css'), "Theme Name: L'Atelier & Co");
    assert.equal(s('# WDM Theme', 'README.md'), "# L'Atelier & Co");
  });

  it('package-lock.json: cambia solo il nome del pacchetto, mai un\'impronta che contiene «wdm» per caso', () => {
    const lock = ['{', '  "name": "wdm-theme",', '  "packages": {', '    "": {', '      "name": "wdm-theme",', '      "version": "1.0.0"', '    },',
      '    "node_modules/sass": {', '      "resolved": "https://registry.npmjs.org/sass/-/sass-1.77.0.tgz",',
      '      "integrity": "sha512-Abcwdm0WDMxyz/wDm+abc=="', '    }', '  }', '}'].join('\n');
    const dopo = s(lock, 'package-lock.json');
    assert.equal(dopo.split('"name": "atelier-td"').length - 1, 2);
    assert.ok(dopo.includes('"integrity": "sha512-Abcwdm0WDMxyz/wDm+abc=="'), 'impronta toccata');
    assert.doesNotThrow(() => JSON.parse(dopo));
    assert.equal(s(dopo, 'package-lock.json'), dopo);
  });

  // La rinomina cambia theme.json (i nomi dei blocchi in styles.blocks): l'impronta scritta nel
  // DESIGN.md del tema base non vale più. Si toglie, e la riscrive il sync dei token (Step 4d).
  it('DESIGN.md: l\'impronta di theme.json del tema base si toglie, i token restano', () => {
    const design = ['## Design Tokens', '```yaml', '# impronta theme.json: d879457498d480ea5692e0f0714e0897b7c7e22360cae829e708bb7af8fda12a', '# Variabili CSS', 'colors:', '```', ''].join('\n');
    assert.equal(senzaImpronta(design), ['## Design Tokens', '```yaml', '# Variabili CSS', 'colors:', '```', ''].join('\n'));
    assert.equal(senzaImpronta(senzaImpronta(design)), senzaImpronta(design));
  });

  it('rifare la sostituzione non cambia più nulla (il rilancio dopo un\'interruzione)', () => {
    const testo = "'title' => 'WDM Theme', // wdm-agent, wdm-theme, .wdm-x, WDM\n<p>WDM Theme</p>";
    for (const file of ['a.php', 'a.html', 'a.md']) {
      const una = s(testo, file);
      assert.equal(s(una, file), una, file);
    }
  });
});

// Lotto 7.1: il DESIGN.md che arriva con il tema base racconta il tema base (cinque pagine
// costruite, id del suo database, note con la sua storia, domande aperte e decisioni sue). Le
// sezioni di stato di un progetto nuovo le scrive lo script, uguali ogni volta.
describe('setup.js: DESIGN.md di un progetto nuovo', () => {
  const BASE = [
    '# Design: atelier', '', 'Block theme FSE. Spec approvata in `docs/superpowers/specs/`. Formato: §11.', '',
    '## Project Config', '', '### Identity', '| Variable | Value |', '|---|---|', '| `theme_family` | fse |', '| `{prefix}` | atl |', '',
    '### Paths', '| Variable | Value |', '|---|---|', '| `{site-root}` | /siti/corso-wdm/atelier |', '',
    '## Local Development', '- **Local URL**: `{local-url}` (MAMP PRO; web su PHP 8.5.2 dal 2026-11-18; DB `atelier-db`)', '- **Test Playwright**: `pw-catalog.js`, entrano ancora con la password', '',
    '## Design Tokens', '', '<!-- AUTO-GENERATED:design-tokens da theme.json — non editare. -->', '```yaml', 'colors:', '  base: "#f5f7fa"', '```', '<!-- /AUTO-GENERATED:design-tokens -->', '',
    '## Telaio', '| Item | Stato | Kit | Note |', '|---|---|---|---|', '| header | implementato | src/kit/main/header | `navigation` ref 4, build Panel del 2026-10-26 |', '',
    '## Pagine', '| Pagina | URL | Stato | Kit | Blocchi (in ordine) | Note |', '|---|---|---|---|---|---|',
    '| Home | / | implementata | src/kit/atl-home.kit | hero (image), steps | id 37, build del 2026-11-02 |',
    '| Catalogo blocchi | /catalogo-blocchi/ | implementata | src/kit/atl-blocks.kit | hero (image), columns-wrapper, steps | id 25 |',
    '| Contatti | /contatti/ | implementata | src/kit/atl-contatti.kit | hero (image) | id 64 |',
    'Fuori dal flusso kit → build:', '- Pagina di esempio (id 2)', '',
    '## Blocchi', '| Blocco | Stato | Pagina d\'origine |', '|---|---|---|', '| atl/hero | implementato | starter |', '',
    '## Navigazione', '| menu (id) | parts | voci (primo livello + figli) | orfane | data |', '|---|---|---|---|---|', '| Menu principale (4) | header | Home · Contatti (64) | 0 | 2026-11-02 |', '',
    '## Domande aperte', '- ⏳ piano di correzioni dopo il doppio audit: `docs/superpowers/plans/2026-11-17-piano-lotti.md`', '',
    '## Log decisioni', '| Data | Decisione |', '|---|---|', '| 2026-10-30 | Plugin 1.3.0 |', '',
  ].join('\n');
  const nuovo = designDelProgetto(BASE, { ...BUONI, slug: 'atelier' }, ['hero', 'hero-slide', 'cta']);
  const sezione = (titolo) => nuovo.split(new RegExp(`^## ${titolo}$`, 'm'))[1].split(/^## /m)[0];
  const righe = (titolo) => sezione(titolo).split('\n').filter((r) => r.startsWith('| ') && !/^\|[\s:|-]+\|$/.test(r)).slice(1);

  it('Project Config e Design Tokens restano com\'erano, parola per parola', () => {
    assert.ok(nuovo.includes('| `{site-root}` | /siti/corso-wdm/atelier |'));
    assert.ok(nuovo.includes('<!-- AUTO-GENERATED:design-tokens da theme.json — non editare. -->\n```yaml\ncolors:\n  base: "#f5f7fa"\n```\n<!-- /AUTO-GENERATED:design-tokens -->'));
    assert.deepEqual(nuovo.match(/^## .*$/gm), ['## Project Config', '## Local Development', '## Design Tokens', '## Telaio', '## Pagine', '## Blocchi', '## Navigazione', '## Domande aperte', '## Log decisioni']);
  });

  it('nessuna traccia della storia del tema base: documenti di lavoro, date, id, password', () => {
    assert.doesNotMatch(nuovo, /docs\/superpowers|2026-1[01]-\d\d|\bid \d+|ref \d+|con la password|PHP 8\.5/);
    assert.match(nuovo.split('## Project Config')[0], /^# Design: atelier\n\n.*fse-foundations\.md §11/s);
  });

  it('Local Development: il login senza password e nessun valore della macchina del tema base', () => {
    assert.match(sezione('Local Development'), /sessione temporanea/);
    assert.match(sezione('Local Development'), /`\{local-url\}`[\s\S]*`npm run dev`[\s\S]*`\{wp-cli\}`[\s\S]*\.playwright-mcp/);
  });

  it('Telaio: le quattro righe del tema base più i campioni del kit, senza note storiche', () => {
    assert.deepEqual(righe('Telaio').map((r) => r.split('|').slice(1, 3).map((c) => c.trim()).join(' = ')),
      ['header = implementato', 'footer = implementato', 'template page / single / archive / search / index / 404 = implementato', 'form di default = implementato', 'campioni del telaio (solo kit) = kit']);
    assert.ok(sezione('Telaio').includes('src/kit/atl-telaio.kit'));
  });

  it('Pagine: la Home da progettare e il Catalogo a kit con i suoi blocchi; le pagine dimostrative non ci sono', () => {
    assert.deepEqual(righe('Pagine').map((r) => r.split('|').slice(1, 5).map((c) => c.trim()).join(' · ')),
      ['Home · / · da progettare · —', 'Catalogo blocchi · /catalogo-blocchi/ · kit · src/kit/atl-blocks.kit']);
    assert.ok(righe('Pagine')[1].includes('hero (image), columns-wrapper, steps'), 'l\'ordine dei blocchi del Catalogo viene dalla riga del tema base');
    assert.doesNotMatch(sezione('Pagine'), /Contatti|Fuori dal flusso|Pagina di esempio/);
  });

  it('Blocchi: una riga per cartella su disco; Navigazione e Log vuoti; una sola domanda aperta, il form', () => {
    assert.deepEqual(righe('Blocchi'), ['| atl/hero | implementato | starter |', '| atl/hero-slide | implementato | starter |', '| atl/cta | implementato | starter |']);
    assert.deepEqual(righe('Navigazione'), []);
    assert.deepEqual(righe('Log decisioni'), []);
    assert.deepEqual(sezione('Domande aperte').trim().split('\n').length, 1);
    assert.match(sezione('Domande aperte'), /^- form di default: .*`formId`/m);
  });

  it('rifarla sul suo risultato non cambia nulla; senza la riga del Catalogo la scrive lo stesso', () => {
    assert.equal(designDelProgetto(nuovo, { ...BUONI, slug: 'atelier' }, ['hero', 'hero-slide', 'cta']), nuovo);
    const senza = designDelProgetto('# Design: x\n\n## Project Config\n\n### Identity\n', { ...BUONI, slug: 'atelier' }, ['hero']);
    assert.match(senza, /^\| Catalogo blocchi \| \/catalogo-blocchi\/ \| kit \| src\/kit\/atl-blocks\.kit \| — \|/m);
    assert.doesNotMatch(senza, /## Design Tokens/);
  });
});

describe('setup.js da riga di comando', () => {
  const lancia = (...args) => {
    const r = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
    return { status: r.status, stdout: r.stdout, stderr: r.stderr };
  };
  const tutti = (cambia = {}) => Object.entries({ ...BUONI, target: os.tmpdir(), ...cambia }).flatMap(([k, v]) => [`--${k}`, v]);

  it('senza argomenti: uso ed exit 2', () => {
    const r = lancia();
    assert.equal(r.status, 2);
    assert.match(r.stderr, /uso:/);
  });

  it('un flag senza valore: exit 2 con il nome del flag, niente «unbound variable» né stack', () => {
    const r = lancia('--prefix', 'atl', '--slug');
    assert.equal(r.status, 2);
    assert.match(r.stderr, /--slug/);
    assert.doesNotMatch(r.stderr, /\bat .*\.js:\d+/);
  });

  it('valori non validi: exit 2, ogni errore in italiano, nulla sul disco', () => {
    const r = lancia(...tutti({ prefix: 'WDM', title: 'a"b' }));
    assert.equal(r.status, 2, r.stdout + r.stderr);
    assert.match(r.stderr, /--prefix/);
    assert.match(r.stderr, /--title/);
  });

  it('cartella senza il tema base: exit 3 e dice cosa fare', () => {
    const r = lancia(...tutti());
    assert.equal(r.status, 3, r.stdout + r.stderr);
    assert.match(r.stderr, /wdm-theme/);
    assert.doesNotMatch(r.stderr, /\bat .*\.js:\d+/);
  });

  // Il progetto nuovo parte senza i documenti di lavoro del tema base e con la cartella del brief.
  it('toglie docs/superpowers, crea docs/brief e lascia stare un brief già depositato; anche al rilancio', () => {
    const sito = fs.mkdtempSync(path.join(os.tmpdir(), 'wdm-agent-setup-docs-'));
    const scrivi = (relativo, testo) => {
      fs.mkdirSync(path.dirname(path.join(sito, relativo)), { recursive: true });
      fs.writeFileSync(path.join(sito, relativo), testo);
    };
    try {
      scrivi('wp-content/themes/wdm-theme/style.css', '/* Theme Name: WDM Theme */\n');
      scrivi('docs/superpowers/plans/piano.md', 'documenti di lavoro di wdm-theme\n');
      scrivi('docs/brief/logo.txt', 'il brief del cliente, depositato prima del setup\n');
      let r = lancia(...tutti({ target: sito }));
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.ok(!fs.existsSync(path.join(sito, 'docs', 'superpowers')), 'docs/superpowers è rimasta');
      assert.equal(fs.readFileSync(path.join(sito, 'docs', 'brief', 'logo.txt'), 'utf8'), 'il brief del cliente, depositato prima del setup\n');
      // Un progetto senza cartella docs: il rilancio crea docs/brief.
      fs.rmSync(path.join(sito, 'docs'), { recursive: true });
      r = lancia(...tutti({ target: sito }));
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.deepEqual(fs.readdirSync(path.join(sito, 'docs')), ['brief']);
    } finally {
      fs.rmSync(sito, { recursive: true, force: true });
    }
  });

  // I blocchi della tabella si leggono dal disco dopo la rinomina delle cartelle, nell'ordine di CLAUDE.md.
  it('DESIGN.md del tema base: esce con lo stato di un progetto nuovo e i blocchi che stanno su disco', () => {
    const sito = fs.mkdtempSync(path.join(os.tmpdir(), 'wdm-agent-setup-design-'));
    const scrivi = (relativo, testo) => {
      fs.mkdirSync(path.dirname(path.join(sito, relativo)), { recursive: true });
      fs.writeFileSync(path.join(sito, relativo), testo);
    };
    try {
      for (const slug of ['cta', 'hero', 'hero-slide']) scrivi(`wp-content/themes/wdm-theme/blocks/wdm-block-${slug}/block.json`, `{ "name": "wdm/${slug}" }\n`);
      scrivi('CLAUDE.md', '### Existing Blocks\n- `{prefix}-block-hero` — `{prefix}/hero`\n- `{prefix}-block-hero-slide` — `{prefix}/hero-slide`\n');
      scrivi('DESIGN.md', '# Design: wdm-theme\n\nSpec in `docs/superpowers/specs/`.\n\n## Project Config\n\n### Identity\n| `{prefix}` | atl |\n\n## Pagine\n| Contatti | /contatti/ | implementata | src/kit/wdm-contatti.kit | hero | id 64 |\n\n## Log decisioni\n| 2026-10-30 | storia di wdm-theme |\n');
      const r = lancia(...tutti({ target: sito }));
      assert.equal(r.status, 0, r.stdout + r.stderr);
      const design = fs.readFileSync(path.join(sito, 'DESIGN.md'), 'utf8');
      assert.deepEqual(design.match(/^\| atl\/.*$/gm), ['| atl/hero | implementato | starter |', '| atl/hero-slide | implementato | starter |', '| atl/cta | implementato | starter |']);
      assert.ok(design.includes('| `{prefix}` | atl |'));
      assert.doesNotMatch(design, /Contatti \||docs\/superpowers|storia di/);
    } finally {
      fs.rmSync(sito, { recursive: true, force: true });
    }
  });
});
