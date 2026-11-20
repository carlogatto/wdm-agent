// controllo.js senza sito: l'uso, la guardia sul progetto e le due funzioni che decidono (che
// cosa aspettarsi, letto da DESIGN.md; il verdetto, dalle righe dei criteri). I criteri che
// chiedono WordPress stanno in sito/controllo.test.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { assoluto } = require('./lib/citati');

const SCRIPT = assoluto('shared/scripts/controllo.js');
const lancia = (...args) => {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
  return { status: r.status, out: r.stdout + r.stderr, stderr: r.stderr };
};

const DESIGN = `# Design: prova

## Project Config

### Identity
| Variable | Value |
|---|---|
| \`theme_family\` | fse |
| \`{prefix}\` | abc |

## Pagine
| Pagina | URL | Stato | Kit | Blocchi (in ordine) | Note |
|---|---|---|---|---|---|
| Home | / | implementata | src/kit/abc-home.kit | hero (image), steps | id 8 |
| Catalogo blocchi | /catalogo-blocchi/ | implementata | \`src/kit/abc-blocks.kit\` | hero | — |
| Servizi | /servizi/ | da progettare | src/kit/abc-servizi.kit | hero | — |
| Fisioterapia | /servizi/fisioterapia/ | kit | src/kit/abc-fisioterapia.kit | hero | — |
| Chi siamo | /chi-siamo/ | da progettare | — | — | — |
| Vecchia | /vecchia/ | da eliminare | src/kit/abc-vecchia.kit | — | — |

## Domande aperte
- Orfana «Policy» › Cookie Policy: nessuna pagina.
- ⏳ kit Servizi in revisione (dal 2026-11-20)
- ⏳ build sito: pagina Home 1/2 (dal 2026-11-20)
- ⏳ confirm: pagina Vecchia (id 9) da cancellare, con il suo kit (dal 2026-11-20)
- ⏳ build sito: pagina Privacy Policy (id 3) aspetta \`confirm\`: la bozza ha 24 blocchi (dal 2026-11-20)

## Log decisioni
| Data | Decisione |
|---|---|
| 2026-11-20 | la riga «⏳ kit Home in revisione» è stata tolta all'ok |
`;

test('senza argomenti: uso ed exit 2', () => {
  const r = lancia();
  assert.equal(r.status, 2, r.out);
  assert.match(r.stderr, /uso:/);
});

test('una cartella che non è un progetto FSE: exit 2, e dice perché', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wdm-agent-controllo-'));
  try {
    let r = lancia(tmp);
    assert.equal(r.status, 2, r.out);
    assert.match(r.out, /DESIGN\.md/);
    fs.writeFileSync(path.join(tmp, 'DESIGN.md'), '| `theme_family` | starter |\n');
    r = lancia(tmp);
    assert.equal(r.status, 2, r.out);
    assert.match(r.out, /theme_family/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('attese: pagine con stato, percorso e nome del kit; kit in revisione; build rimasta a metà', () => {
  const { attese } = require(SCRIPT);
  const a = attese(DESIGN, 'abc');
  assert.deepEqual(a.pagine.map((p) => [p.titolo, p.percorso, p.stato, p.kit]), [
    ['Home', '/', 'implementata', 'home'],
    ['Catalogo blocchi', '/catalogo-blocchi/', 'implementata', 'blocks'],
    ['Servizi', '/servizi/', 'da progettare', 'servizi'],
    ['Fisioterapia', '/servizi/fisioterapia/', 'kit', 'fisioterapia'],
    ['Chi siamo', '/chi-siamo/', 'da progettare', null],
    ['Vecchia', '/vecchia/', 'da eliminare', 'vecchia'],
  ]);
  // Solo le righe di ## Domande aperte: il log che cita una riga ⏳ non è un'attesa.
  assert.deepEqual(a.revisione, ['Servizi']);
  // Una build rimasta a metà è la riga di avanzamento; una riga che aspetta un confirm no,
  // comunque sia scritta.
  assert.equal(a.build.length, 1);
  assert.match(a.build[0], /pagina Home 1\/2/);
  assert.equal(a.conferme.length, 2);
  assert.match(a.conferme[0], /pagina Vecchia/);
  assert.match(a.conferme[1], /Privacy Policy/);
});

test('attese: senza la sezione ## Pagine non c\'è nulla da aspettarsi', () => {
  const { attese } = require(SCRIPT);
  const a = attese('| `theme_family` | fse |\n', 'abc');
  assert.deepEqual(a, { pagine: [], revisione: [], build: [], conferme: [] });
});

test('riga: una riga sola per criterio, corta, con l\'esito davanti', () => {
  const { riga } = require(SCRIPT);
  const r = riga('FAIL', 'Pagine', `Home: 2 modificato\n  ~ abc/hero\n${'x'.repeat(900)}`);
  assert.ok(!r.includes('\n'));
  assert.ok(r.startsWith('FAIL  Pagine: Home: 2 modificato'), r);
  assert.ok(r.length <= 320, String(r.length));
});

test('verdetto: buona senza FAIL (le NOTA non contano), non buona con un FAIL', () => {
  const { riga, verdetto } = require(SCRIPT);
  const buone = [riga('PASS', 'Tema', 'build e check a 0'), riga('NOTA', 'Pagine', 'Chi siamo modificata a mano')];
  assert.deepEqual(verdetto(buone), { exit: 0, testo: 'UNITÀ BUONA: 1 controllo passa, 1 nota.' });
  const guaste = [...buone, riga('FAIL', 'Menu', 'Menu principale diverso dal kit'), riga('FAIL', 'Git', '3 file non committati')];
  const v = verdetto(guaste);
  assert.equal(v.exit, 1);
  assert.match(v.testo, /^UNITÀ NON BUONA: 2 controlli non passano \(Menu, Git\)/);
});
