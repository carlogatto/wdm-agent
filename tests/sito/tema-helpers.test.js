// Gli helper PHP del tema base (library/blocks-helpers.php): bottone, immagine, h1 della pagina.
// Girano sul sito di prova con il tema base attivo; allegato e pagine li crea la prova (prima
// erano ID del sito di lavoro, in uno script del tema: U45).
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const sito = require('../lib/sito');

describe('helper PHP del tema base', { skip: sito.nonDisponibile() || false }, () => {
  let immagine, senzaTitolo, conTitolo;

  const php = (codice) => {
    const r = sito.wp(['eval', codice]);
    assert.equal(r.status, 0, r.out);
    return r.stdout;
  };
  const crea = (...args) => {
    const r = sito.wp([...args, '--porcelain']);
    assert.equal(r.status, 0, r.out);
    return r.stdout.trim();
  };

  before(() => {
    const cfg = sito.prepara();
    const tema = sito.copiaBase(cfg.site, (relativo) => relativo.startsWith('wp-content/themes/wdm-theme/'));
    assert.equal(sito.wp(['theme', 'activate', 'wdm-theme']).status, 0);
    immagine = crea('media', 'import', path.join(tema, 'assets', 'img', 'placeholder-2000x1150.jpg'));
    senzaTitolo = crea('post', 'create', '--post_type=page', '--post_status=publish', '--post_title=Senza titolo');
    conTitolo = crea('post', 'create', '--post_type=page', '--post_status=publish', '--post_title=Con titolo');
    assert.equal(sito.wp(['post', 'meta', 'update', senzaTitolo, 'wdm_show_title', '0']).status, 0);
    assert.equal(sito.wp(['post', 'meta', 'update', conTitolo, 'wdm_show_title', '1']).status, 0);
  });

  after(() => sito.reset());

  it('(a) bottone: classe e href, nessun target', () => {
    const a = php('echo wdm_render_button( "Vai", "/x/" );');
    assert.match(a, /class="wp-element-button"/);
    assert.match(a, /href="\/x\/"/);
    assert.doesNotMatch(a, /target/);
  });

  it('(b) bottone in una nuova scheda: target, rel e nota per lo screen reader', () => {
    const b = php('echo wdm_render_button( "Vai", "https://example.com", array( "new_tab" => true ) );');
    assert.match(b, /target="_blank"/);
    assert.match(b, /rel="noopener"/);
    assert.match(b, /nuova scheda/);
  });

  it('(c) bottone invertito', () => {
    assert.match(php('echo wdm_render_button( "Vai", "/x/", array( "inverted" => true ) );'), /is-style-inverted/);
  });

  it('(d) bottone senza testo: stringa vuota', () => {
    assert.equal(php('var_export( wdm_render_button( "", "/x/" ) );'), "''");
  });

  it('(e) immagine: lazy, async e dimensioni del formato', () => {
    const e = php(`echo wdm_render_image( ${immagine}, "thumb-700x450" );`);
    assert.match(e, /loading="lazy"/);
    assert.match(e, /decoding="async"/);
    assert.match(e, /width="700"/);
  });

  it('(f) immagine di ripiego: src e alt vuoto', () => {
    const f = php('echo wdm_render_image( 0, "thumb-700x450", array( "fallback_url" => "/a.jpg" ) );');
    assert.match(f, /src="\/a\.jpg"/);
    assert.match(f, /alt=""/);
  });

  it('(g) senza id né ripiego: stringa vuota', () => {
    assert.equal(php('var_export( wdm_render_image( 0, "x" ) );'), "''");
  });

  it('(h) decorativa: alt vuoto anche con un alt in libreria', () => {
    const h = php(`update_post_meta( ${immagine}, "_wp_attachment_image_alt", "Prova" ); echo wdm_render_image( ${immagine}, "thumb-700x450", array( "decorative" => true ) );`);
    assert.match(h, /alt=""/);
    assert.match(h, /role="presentation"/);
  });

  it('(i) decorativa sul ripiego: role', () => {
    assert.match(php('echo wdm_render_image( 0, "x", array( "fallback_url" => "/a.jpg", "decorative" => true ) );'), /role="presentation"/);
  });

  it('(j) titolo di pagina spento: il primo chiamante reclama l\'h1, il secondo no', () => {
    assert.equal(php(`query_posts( "page_id=${senzaTitolo}" ); var_export( wdm_claim_page_h1() ); echo " "; var_export( wdm_claim_page_h1() );`), 'true false');
  });

  it('(k) titolo di pagina acceso: l\'h1 è del template, nessun blocco lo reclama', () => {
    assert.equal(php(`query_posts( "page_id=${conTitolo}" ); var_export( wdm_claim_page_h1() );`), 'false');
  });
});
