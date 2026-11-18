// wp-page.php sul sito di prova: confronto kit → WordPress di una pagina (plan) e scrittura
// della sola differenza (apply, con confirm per le cancellazioni).
// Exit dello script: 0 nessuna differenza · 2 errore · 3 cancellazioni in attesa di conferma ·
// 4 pagina aperta nell'editor · 5 differenze / scritto · 6 nulla da scrivere su una pagina
// modificata a mano. L'1 è di WP-CLI: non vale mai «scritto» (U17).
// I casi sono in sequenza: ognuno parte dallo stato del precedente.
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
  const campo = (nome) => {
    const r = sito.wp(['post', 'get', id, `--field=${nome}`]);
    assert.equal(r.status, 0, r.out);
    return r.stdout.trim();
  };
  const contenuto = () => campo('post_content');
  // Scrive in WordPress come una build di prima del meta: senza impronta e con una revisione
  // senza autore la pagina non risulta «modificata a mano», e il kit vince.
  const scriviInWp = (testo) => {
    assert.equal(sito.wp(['post', 'update', id, `--post_content=${testo}`]).status, 0);
    sito.wp(['post', 'meta', 'delete', id, '_fse_build']);
  };
  // Scrive in WordPress come farebbe il cliente dall'editor: il meta della build resta.
  const aMano = (testo, ...args) => assert.equal(sito.wp(['post', 'update', id, `--post_content=${testo}`, ...args]).status, 0);
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
    atteso(page('plan', SLUG), 5, '0 uguale · 0 modificato · 2 nuovo · 0 spostato · 0 da cancellare', '+ wdm/cta (split)');
    assert.equal(contenuto(), '', 'plan ha scritto');
    atteso(page('apply', SLUG), 5, 'scritto');
    atteso(page('plan', SLUG), 0, '2 uguale');
    const modificato = campo('post_modified');
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1100);
    atteso(page('apply', SLUG), 0, '0 differenze, nessuna scrittura');
    assert.equal(campo('post_modified'), modificato, 'post_modified cambiato senza differenze');
  });

  it('(b) attributo modificato nel kit: apply scrive il valore del kit', () => {
    scriviKit(CTA_BIS, PAR);
    atteso(page('plan', SLUG), 5, '1 uguale · 1 modificato · 0 nuovo', '~ wdm/cta (split)', 'title "Uno" → "Uno bis"');
    atteso(page('apply', SLUG), 5);
    assert.ok(contenuto().includes('Uno bis'));
  });

  it('(c) blocco in più in WordPress, pagina non toccata a mano: da cancellare, exit 3 senza scrittura; confirm lo toglie', () => {
    scriviInWp(`${contenuto()}\n\n<!-- wp:heading --><h2>Extra</h2><!-- /wp:heading -->`);
    atteso(page('plan', SLUG), 3, '1 da cancellare', '- core/heading');
    atteso(page('apply', SLUG), 3);
    assert.ok(contenuto().includes('Extra'), 'apply senza confirm ha scritto');
    atteso(page('apply', SLUG, 'confirm'), 5);
    assert.ok(!contenuto().includes('Extra'), 'confirm non ha tolto il blocco');
  });

  it('(d) ordine invertito nel kit: spostato, apply riordina', () => {
    scriviKit(PAR, CTA_BIS);
    atteso(page('plan', SLUG), 5, '1 uguale · 0 modificato · 0 nuovo · 1 spostato · 0 da cancellare');
    atteso(page('apply', SLUG), 5);
    assert.ok(contenuto().startsWith('<!-- wp:paragraph'), 'il paragrafo non è primo');
  });

  it('(e) pagina assente o post di altro tipo: exit 2', () => {
    atteso(page('plan', 'slug-che-non-esiste'), 2, 'pagina assente');
    atteso(page('plan', crea('--post_type=post', '--post_title=Articolo')), 2, 'non è una pagina');
  });

  it('(f) differenza solo nel figlio: il padre è modificato', () => {
    scriviKit(HERO_A);
    atteso(page('apply', SLUG, 'confirm'), 5);
    scriviKit(HERO_B);
    atteso(page('plan', SLUG), 5, '0 uguale · 1 modificato · 0 nuovo', '~ wdm/hero (image)');
  });

  it('(g) contenuto libero in WordPress: da cancellare, mai scartato in silenzio', () => {
    scriviInWp('<p>libero</p>');
    atteso(page('plan', SLUG), 3, '- (contenuto libero)');
  });

  it('(h) kit vuoto con pagina piena: tutto da cancellare, solo confirm svuota', () => {
    atteso(page('apply', SLUG, 'confirm'), 5);
    scriviKit();
    atteso(page('plan', SLUG), 3, '0 uguale · 0 modificato · 0 nuovo · 0 spostato · 1 da cancellare');
    atteso(page('apply', SLUG), 3);
    assert.ok(contenuto().includes('wp:wdm/hero'), 'apply senza confirm ha svuotato la pagina');
    atteso(page('apply', SLUG, 'confirm'), 5);
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
    atteso(page('apply', SLUG, 'confirm'), 5);
    atteso(page('plan', SLUG), 0);
    assert.ok(contenuto().includes(`Kit ${u('26')} build ${u('3c')}br${u('3e')} ${u('22')}ok${u('22')} ${u('2d')}${u('2d')} fine`), `sequenze di escape perse: ${contenuto()}`);
    assert.equal(sito.wp(['eval', `echo parse_blocks( get_post( ${id} )->post_content )[0]['attrs']['title'];`]).stdout, 'Kit & build <br> "ok" -- fine');
  });

  it('(k) pagina figlia: trovata per slug e per percorso', () => {
    const figlia = crea('--post_type=page', `--post_parent=${id}`, '--post_title=wdm-agent child', '--post_name=wdm-agent-child');
    atteso(page('plan', 'wdm-agent-child'), 5, `wdm-agent-child (id ${figlia})`);
    atteso(page('plan', `${SLUG}/wdm-agent-child`), 5);
  });

  it('(l) attributi che non sono JSON, o commento di blocco rotto: exit 2 con il blocco, nulla scritto (U17)', () => {
    scriviKit(CTA);
    atteso(page('apply', SLUG, 'confirm'), 5);
    const prima = contenuto();
    scriviKit('<!-- wp:wdm/cta {"variant":"split","title":"Rotto" "virgola mancante"} /-->');
    atteso(page('plan', SLUG), 2, 'blocco wdm/cta', 'non sono un oggetto JSON valido');
    atteso(page('apply', SLUG, 'confirm'), 2, 'blocco wdm/cta');
    scriviKit('<!-- wp:wdm/cta {"variant":"split","title":"Senza chiusura" /-->');
    atteso(page('apply', SLUG, 'confirm'), 2, 'commento di blocco non riconosciuto (<!-- wp:wdm/cta');
    assert.doesNotMatch(page('plan', SLUG).out, /Warning|Undefined variable/);
    assert.equal(contenuto(), prima, 'un file generato rotto è stato scritto');
  });

  it('(m) pagina aperta nell\'editor da un utente: exit 4, nulla scritto; un blocco vecchio non ferma (U16)', () => {
    const blocco = (secondi) => assert.equal(sito.wp(['post', 'meta', 'update', id, '_edit_lock', `${Math.floor(Date.now() / 1000) - secondi}:1`]).status, 0);
    scriviKit(CTA_BIS);
    blocco(5);
    atteso(page('plan', SLUG), 5);
    atteso(page('apply', SLUG), 4, 'aperta nell\'editor da');
    assert.ok(!contenuto().includes('Uno bis'), 'apply ha scritto su una pagina aperta nell\'editor');
    blocco(3600);
    atteso(page('apply', SLUG), 5);
    assert.ok(contenuto().includes('Uno bis'));
  });

  // U53. I contenuti del kit riempiono la pagina; da quando il cliente la modifica a mano in
  // WordPress, WordPress è il padrone. I due sensi, sulla stessa pagina.
  describe('contenuti del cliente (U53)', () => {
    const cta = (titolo, variante = 'split') => `<!-- wp:wdm/cta {"variant":"${variante}","title":"${titolo}"} /-->`;
    const HEADING = '<!-- wp:heading --><h2>Extra</h2><!-- /wp:heading -->';
    const posizione = (testo) => contenuto().indexOf(testo);
    const meta = () => sito.wp(['post', 'meta', 'get', id, '_fse_build', '--format=json']);

    it('(n) non toccata a mano: una revisione dei testi nel kit arriva, anche se l\'editor ha riscritto spazi e righe vuote', () => {
      scriviKit(cta('Uno'), HERO_A, PAR);
      atteso(page('apply', SLUG, 'confirm'), 5);
      assert.match(meta().stdout, /"wp":"[0-9a-f]{32}"/);
      aMano(contenuto().replaceAll('\n\n', '\n\n\n\n').replace('--><!-- wp:wdm/hero-slide', '-->\n\n  <!-- wp:wdm/hero-slide'));
      atteso(page('plan', SLUG), 0, '3 uguale · 0 modificato');
      scriviKit(cta('Uno bis'), HERO_A, PAR);
      atteso(page('plan', SLUG), 5, '2 uguale · 1 modificato');
      atteso(page('apply', SLUG), 5);
      assert.ok(contenuto().includes('Uno bis'));
    });

    it('(o) testo cambiato a mano, kit invariato: nulla da scrivere, exit 6, il testo del cliente resta', () => {
      aMano(contenuto().replace('Uno bis', 'Testo del cliente'));
      const modificato = campo('post_modified');
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1100);
      atteso(page('plan', SLUG), 6, 'modificata a mano in WordPress', '2 uguale · 1 protetto · 0 nuovo', '! wdm/cta (split) — protetto: title "Testo del cliente" → "Uno bis"');
      atteso(page('apply', SLUG), 6, 'nessuna scrittura');
      assert.ok(contenuto().includes('Testo del cliente'));
      assert.equal(campo('post_modified'), modificato, 'la pagina del cliente è stata riscritta');
    });

    it('(p) il kit cambia lo stesso testo e aggiunge un blocco: entra solo il blocco nuovo, al suo posto', () => {
      scriviKit(cta('Uno ter'), cta('Nuovo', 'centered'), HERO_A, PAR);
      atteso(page('plan', SLUG), 5, '2 uguale · 1 protetto · 1 nuovo', '+ wdm/cta (centered) — nuovo');
      atteso(page('apply', SLUG), 5, 'scritto');
      assert.ok(contenuto().includes('Testo del cliente') && !contenuto().includes('Uno ter'), contenuto());
      assert.ok(posizione('Testo del cliente') < posizione('Nuovo') && posizione('Nuovo') < posizione('wp:wdm/hero'), contenuto());
      atteso(page('plan', SLUG), 6, '3 uguale · 1 protetto · 0 nuovo');
    });

    it('(q) blocco tolto a mano: non torna; blocco aggiunto a mano: resta, senza confirm', () => {
      const senzaHero = contenuto().replace(/<!-- wp:wdm\/hero [\s\S]*<!-- \/wp:wdm\/hero -->/, HEADING);
      assert.ok(!senzaHero.includes('wp:wdm/hero'));
      aMano(senzaHero);
      atteso(page('plan', SLUG), 6, '1 tolto a mano · 1 aggiunto a mano · 0 da cancellare', 'x wdm/hero (image) — tolto a mano', '* core/heading — aggiunto a mano');
      atteso(page('apply', SLUG), 6);
      assert.equal(contenuto(), senzaHero);
    });

    it('(r) blocco tolto dal kit: exit 3; con confirm sparisce solo quello', () => {
      scriviKit(cta('Uno ter'), cta('Nuovo', 'centered'), HERO_A);
      atteso(page('plan', SLUG), 3, '1 da cancellare', '- core/paragraph — da cancellare');
      atteso(page('apply', SLUG), 3);
      assert.ok(contenuto().includes('<p>Due</p>'));
      atteso(page('apply', SLUG, 'confirm'), 5);
      assert.ok(!contenuto().includes('<p>Due</p>') && contenuto().includes('Testo del cliente') && contenuto().includes('Extra'), contenuto());
    });

    it('(s) forza: il kit torna a vincere e la pagina torna normale', () => {
      atteso(page('apply', SLUG, 'forza'), 3, '1 modificato', '1 da cancellare');
      atteso(page('apply', SLUG, 'forza', 'confirm'), 5);
      assert.ok(contenuto().includes('Uno ter') && contenuto().includes('wp:wdm/hero') && !contenuto().includes('Extra'), contenuto());
      atteso(page('plan', SLUG), 0, '3 uguale · 0 modificato');
      scriviKit(cta('Uno quater'), cta('Nuovo', 'centered'), HERO_A);
      atteso(page('apply', SLUG), 5);
      assert.ok(contenuto().includes('Uno quater'));
    });

    it('(t) pagina costruita prima del meta: del cliente se l\'ultima revisione ha un autore, altrimenti no', () => {
      sito.wp(['post', 'meta', 'delete', id, '_fse_build']);
      aMano(contenuto().replace('Uno quater', 'Cliente di prima'), '--user=testadmin');
      atteso(page('plan', SLUG), 6, 'l\'ultima revisione è stata salvata da un utente', '1 protetto');
      aMano(contenuto().replace('Cliente di prima', 'Build di prima'));
      atteso(page('plan', SLUG), 5, '2 uguale · 1 modificato');
    });

    it('(u) pagina di prima identica al kit: al primo apply riceve l\'impronta, senza essere riscritta', () => {
      atteso(page('apply', SLUG), 5);
      sito.wp(['post', 'meta', 'delete', id, '_fse_build']);
      assert.notEqual(meta().status, 0);
      const modificato = campo('post_modified');
      atteso(page('apply', SLUG), 0, '0 differenze');
      assert.match(meta().stdout, /"wp":"[0-9a-f]{32}"/);
      assert.equal(campo('post_modified'), modificato);
      aMano(contenuto().replace('Uno quater', 'Dopo l\'impronta'));
      atteso(page('plan', SLUG), 6, '1 protetto');
    });

    it('(v) pagina del cliente riallineata al kit: torna una pagina normale', () => {
      scriviKit(cta('Dopo l\'impronta'), cta('Nuovo', 'centered'), HERO_A);
      atteso(page('apply', SLUG), 0, '0 differenze');
      scriviKit(cta('Di nuovo il kit'), cta('Nuovo', 'centered'), HERO_A);
      atteso(page('plan', SLUG), 5, '2 uguale · 1 modificato');
    });

    // Il cliente toglie un blocco, il kit viene riallineato a WordPress, poi nel kit nasce un
    // blocco nuovo con la stessa chiave: deve entrare, non essere preso per quello tolto a mano.
    it('(w) dopo il riallineamento del kit, un blocco nuovo con la stessa chiave di uno tolto a mano entra', () => {
      scriviKit(cta('Primo'), HERO_A, cta('Secondo'));
      atteso(page('apply', SLUG, 'forza', 'confirm'), 5);
      aMano(contenuto().replace('Primo', 'Primo del cliente').replace(/\s*<!-- wp:wdm\/cta \{[^}]*"Secondo"[^}]*\} \/-->/, ''));
      assert.ok(!contenuto().includes('Secondo'));
      atteso(page('apply', SLUG), 6, '1 protetto', '1 tolto a mano');
      scriviKit(cta('Primo'), HERO_A);
      atteso(page('apply', SLUG), 6, '1 protetto · 0 nuovo · 0 tolto a mano');
      scriviKit(cta('Primo'), HERO_A, cta('Nato dopo'));
      atteso(page('plan', SLUG), 5, '1 protetto · 1 nuovo · 0 tolto a mano');
      atteso(page('apply', SLUG), 5);
      assert.ok(contenuto().includes('Primo del cliente') && contenuto().includes('Nato dopo'), contenuto());
    });
  });
});
