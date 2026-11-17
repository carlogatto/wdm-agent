// wp-navigation.php sul sito di prova: le voci con & o " arrivano intatte nel post wp_navigation
// (wp_insert_post e wp_update_post vogliono dati slashati) e un secondo apply non trova nulla da
// scrivere. I casi sono in sequenza.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const sito = require('../lib/sito');
const { assoluto } = require('../lib/citati');

const SCRIPT = assoluto('skills/fse-menu-build/scripts/wp-navigation.php');
const TITOLO = 'wdm-agent test nav';

describe('wp-navigation.php', { skip: sito.nonDisponibile() || false }, () => {
  let tmp, kit, piano, parts, id;

  const nav = (...args) => sito.wp(['eval-file', SCRIPT, ...args]);
  const scriviKit = (voce) => fs.writeFileSync(kit, `<nav aria-label="${TITOLO}"><ul>\n  <li><a href="#">${voce}</a></li>\n  <li><a href="#">Chi "siamo"</a></li>\n</ul></nav>\n`);
  const pianifica = () => {
    const r = nav('plan', `header=${kit}`);
    assert.equal(r.status, 0, r.out);
    fs.writeFileSync(piano, r.stdout);
  };
  const applica = (...args) => nav('apply', piano, `parts=${parts}`, ...args);

  before(() => {
    sito.prepara();
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wdm-agent-nav-'));
    kit = path.join(tmp, 'header.kit');
    piano = path.join(tmp, 'plan.json');
    parts = path.join(tmp, 'parts');
    fs.mkdirSync(parts);
    fs.writeFileSync(path.join(parts, 'header.html'), '<!-- wp:navigation {"overlayMenu":"never"} /-->\n');
  });

  after(() => {
    sito.reset();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('(a) primo apply: crea il menu e scrive il ref nella part', () => {
    scriviKit('Privacy &amp; Cookie');
    pianifica();
    const r = applica();
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /creato/);
    const ref = /"ref":([0-9]+)/.exec(fs.readFileSync(path.join(parts, 'header.html'), 'utf8'));
    assert.ok(ref, 'ref non scritto nella part');
    id = ref[1];
  });

  it('(b) il contenuto salvato conserva le sequenze di escape di & e "', () => {
    const contenuto = sito.wp(['post', 'get', id, '--field=post_content']).stdout;
    assert.ok(contenuto.includes('Privacy \\u0026 Cookie'), contenuto);
    assert.ok(contenuto.includes('Chi \\u0022siamo\\u0022'), contenuto);
  });

  it('(c) secondo apply: 0 differenze', () => {
    const r = applica();
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /0 differenze/);
  });

  it('(d) aggiornamento di un menu esistente: stessa garanzia', () => {
    scriviKit('Privacy, Cookie &amp; Termini');
    pianifica();
    let r = applica('confirm');
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /aggiornato/);
    r = applica();
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /0 differenze/);
  });
});
