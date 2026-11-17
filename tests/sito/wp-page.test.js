// wp-page.php sul sito di prova: confronto kit → WordPress di una pagina (plan) e scrittura
// della sola differenza (apply, con confirm per le cancellazioni).
// Exit dello script: 0 nessuna differenza · 1 differenze / scritto · 2 errore · 3 cancellazioni
// in attesa di conferma. I casi sono in sequenza: ognuno parte dallo stato del precedente.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const sito = require('../lib/sito');
const { assoluto } = require('../lib/citati');

const SCRIPT = assoluto('skills/fse-build/scripts/wp-page.php');
const SLUG = 'wdm-agent-test';
const PAR = '<!-- wp:paragraph --><p>Due</p><!-- /wp:paragraph -->';
const CTA = '<!-- wp:wdm/cta {"variant":"split","title":"Uno"} /-->';
const CTA_BIS = '<!-- wp:wdm/cta {"variant":"split","title":"Uno bis"} /-->';
const HERO_A = '<!-- wp:wdm/hero {"variant":"image"} --><!-- wp:wdm/hero-slide {"title":"A"} /--><!-- /wp:wdm/hero -->';
const HERO_B = '<!-- wp:wdm/hero {"variant":"image"} --><!-- wp:wdm/hero-slide {"title":"B"} /--><!-- /wp:wdm/hero -->';

describe('wp-page.php', { skip: sito.nonDisponibile() || false }, () => {
  let tmp, kit, id;

  const crea = (...args) => {
    const r = sito.wp(['post', 'create', '--post_status=draft', '--porcelain', ...args]);
    assert.equal(r.status, 0, r.out);
    return r.stdout.trim();
  };
  const scriviKit = (...blocchi) => fs.writeFileSync(kit, blocchi.length ? blocchi.join('\n\n') + '\n' : '');
  const page = (modo, pagina, ...args) => sito.wp(['eval-file', SCRIPT, modo, kit, `page=${pagina}`, ...args]);
  const campo = (nome) => sito.wp(['post', 'get', id, `--field=${nome}`]).stdout.trim();
  const contenuto = () => campo('post_content');
  const scriviInWp = (testo) => assert.equal(sito.wp(['post', 'update', id, `--post_content=${testo}`]).status, 0);
  // Esegue lo script e pretende codice d'uscita e, se dati, i testi nell'output.
  const atteso = (r, status, ...testi) => {
    assert.equal(r.status, status, r.out);
    for (const testo of testi) assert.ok(r.out.includes(testo), `manca «${testo}» in: ${r.out}`);
  };

  before(() => {
    const cfg = sito.prepara();
    const mu = path.join(cfg.site, 'wp-content', 'mu-plugins');
    fs.mkdirSync(mu, { recursive: true });
    fs.copyFileSync(path.join(__dirname, '..', 'fixtures', 'sito', 'blocchi-di-prova.php'), path.join(mu, 'blocchi-di-prova.php'));
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wdm-agent-page-'));
    kit = path.join(tmp, 'pagina.html');
    id = crea('--post_type=page', '--post_title=wdm-agent test', `--post_name=${SLUG}`);
  });

  after(() => {
    sito.reset();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('(a) pagina vuota: 2 nuovi, apply scrive, poi nessuna differenza e nessuna scrittura', () => {
    scriviKit(CTA, PAR);
    atteso(page('plan', SLUG), 1, '0 uguale · 0 modificato · 2 nuovo · 0 spostato · 0 da cancellare', '+ wdm/cta (split)');
    assert.equal(contenuto(), '', 'plan ha scritto');
    atteso(page('apply', SLUG), 1, 'scritto');
    atteso(page('plan', SLUG), 0, '2 uguale');
    const modificato = campo('post_modified');
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1100);
    atteso(page('apply', SLUG), 0, '0 differenze, nessuna scrittura');
    assert.equal(campo('post_modified'), modificato, 'post_modified cambiato senza differenze');
  });

  it('(b) attributo modificato nel kit: apply scrive il valore del kit', () => {
    scriviKit(CTA_BIS, PAR);
    atteso(page('plan', SLUG), 1, '1 uguale · 1 modificato · 0 nuovo', '~ wdm/cta (split)', 'title "Uno" → "Uno bis"');
    atteso(page('apply', SLUG), 1);
    assert.ok(contenuto().includes('Uno bis'));
  });

  it('(c) blocco in più in WordPress: da cancellare, exit 3 senza scrittura; confirm lo toglie', () => {
    scriviInWp(`${contenuto()}\n\n<!-- wp:heading --><h2>Extra</h2><!-- /wp:heading -->`);
    atteso(page('plan', SLUG), 3, '1 da cancellare', '- core/heading');
    atteso(page('apply', SLUG), 3);
    assert.ok(contenuto().includes('Extra'), 'apply senza confirm ha scritto');
    atteso(page('apply', SLUG, 'confirm'), 1);
    assert.ok(!contenuto().includes('Extra'), 'confirm non ha tolto il blocco');
  });

  it('(d) ordine invertito nel kit: spostato, apply riordina', () => {
    scriviKit(PAR, CTA_BIS);
    atteso(page('plan', SLUG), 1, '1 uguale · 0 modificato · 0 nuovo · 1 spostato · 0 da cancellare');
    atteso(page('apply', SLUG), 1);
    assert.ok(contenuto().startsWith('<!-- wp:paragraph'), 'il paragrafo non è primo');
  });

  it('(e) pagina assente o post di altro tipo: exit 2', () => {
    atteso(page('plan', 'slug-che-non-esiste'), 2, 'pagina assente');
    atteso(page('plan', crea('--post_type=post', '--post_title=Articolo')), 2, 'non è una pagina');
  });

  it('(f) differenza solo nel figlio: il padre è modificato', () => {
    scriviKit(HERO_A);
    atteso(page('apply', SLUG, 'confirm'), 1);
    scriviKit(HERO_B);
    atteso(page('plan', SLUG), 1, '0 uguale · 1 modificato · 0 nuovo', '~ wdm/hero (image)');
  });

  it('(g) contenuto libero in WordPress: da cancellare, mai scartato in silenzio', () => {
    scriviInWp('<p>libero</p>');
    atteso(page('plan', SLUG), 3, '- (contenuto libero)');
  });

  it('(h) kit vuoto con pagina piena: tutto da cancellare, solo confirm svuota', () => {
    atteso(page('apply', SLUG, 'confirm'), 1);
    scriviKit();
    atteso(page('plan', SLUG), 3, '0 uguale · 0 modificato · 0 nuovo · 0 spostato · 1 da cancellare');
    atteso(page('apply', SLUG), 3);
    assert.ok(contenuto().includes('wp:wdm/hero'), 'apply senza confirm ha svuotato la pagina');
    atteso(page('apply', SLUG, 'confirm'), 1);
    assert.equal(contenuto(), '', 'confirm non ha svuotato la pagina');
  });

  it('(i) variante al default omessa in WordPress ed esplicita nel kit: stesso blocco', () => {
    scriviInWp('<!-- wp:wdm/hero --><!-- wp:wdm/hero-slide {"title":"A"} /--><!-- /wp:wdm/hero -->');
    scriviKit(HERO_A);
    atteso(page('plan', SLUG), 0, '1 uguale · 0 modificato · 0 nuovo · 0 spostato · 0 da cancellare');
  });

  it('(j) caratteri speciali negli attributi (& < " --): andata e ritorno senza corruzione', () => {
    // Il kit li porta come sequenze di escape JSON, composte qui per non dipendere da come
    // questo file viene salvato: barra rovesciata, u, quattro cifre.
    const u = (codice) => `\\u00${codice}`;
    scriviKit(`<!-- wp:wdm/cta {"variant":"split","title":"Kit ${u('26')} build ${u('3c')}br${u('3e')} ${u('22')}ok${u('22')} ${u('2d')}${u('2d')} fine"} /-->`);
    atteso(page('apply', SLUG, 'confirm'), 1);
    atteso(page('plan', SLUG), 0);
    assert.ok(contenuto().includes(`Kit ${u('26')} build ${u('3c')}br${u('3e')} ${u('22')}ok${u('22')} ${u('2d')}${u('2d')} fine`), `sequenze di escape perse: ${contenuto()}`);
    assert.equal(sito.wp(['eval', `echo parse_blocks( get_post( ${id} )->post_content )[0]['attrs']['title'];`]).stdout, 'Kit & build <br> "ok" -- fine');
  });

  it('(k) pagina figlia: trovata per slug e per percorso', () => {
    const figlia = crea('--post_type=page', `--post_parent=${id}`, '--post_title=wdm-agent child', '--post_name=wdm-agent-child');
    atteso(page('plan', 'wdm-agent-child'), 1, `wdm-agent-child (id ${figlia})`);
    atteso(page('plan', `${SLUG}/wdm-agent-child`), 1);
  });
});
