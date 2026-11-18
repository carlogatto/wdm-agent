// shared/scripts/parita.js senza sito: lo scheletro di un HTML (gli elementi con una classe del
// progetto), le tolleranze, il confronto e la lettura delle tabelle di DESIGN.md. La struttura
// conta, i contenuti no (D4). Le prove con un sito vero stanno in sito/parita.test.js.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { RADICE } = require('./lib/citati');
const SCRIPT = path.join(RADICE, 'shared', 'scripts', 'parita.js');
const { scheletro, zone, confronta, tabella, ultimoLato } = require(SCRIPT);
const { albero } = require(path.join(RADICE, 'shared', 'scripts', 'lib', 'html.js'));

const P = 'abc';
// Una pagina com'è nel kit: header, due sezioni, footer.
const pagina = ({ titolo = 'Titolo', variante = 'image-left', card = 2, extra = '', classiHero = 'wp-block-abc-hero alignfull abc-block-hero abc-block-hero--image', ordine = 'ab' } = {}) => {
  const a = `<section class="${classiHero}"><div class="abc-block-hero__inner"><h1 class="abc-block-hero__title">${titolo}</h1><a class="wp-block-button__link abc-block-hero__button" href="/x">Vai</a></div></section>`;
  const b = `<section class="alignfull abc-block-image-text abc-block-image-text--${variante}"><div class="abc-block-image-text__inner"><img class="abc-block-image-text__img" src="a.jpg" alt=""><div class="swiper-wrapper">${'<article class="swiper-slide abc-block-card"><h3 class="abc-block-card__title">Card</h3></article>'.repeat(card)}</div></div></section>`;
  return `<!doctype html><html><head><style>.abc-finta{}</style><script>var x = '<div class="abc-finta">';</script></head><body>
<header class="abc-header"><div class="abc-header__inner"><button class="abc-header__toggle">Menu</button><nav class="abc-header__nav"><ul><li><a href="/">Home</a></li></ul></nav></div></header>
<main class="abc-main">${ordine === 'ab' ? a + b : b + a}${extra}</main>
<footer class="abc-footer"><div class="abc-footer__inner"><p class="abc-footer__bottom">© 2026</p></div></footer></body></html>`;
};
const diff = (kit, sito) => confronta(scheletro(kit, P), scheletro(sito, P));
const stampa = (nodi, rientro = 0) => nodi.flatMap((n) => [`${'  '.repeat(rientro)}${n.etichetta}`, ...stampa(n.figli, rientro + 1)]);

describe('html.js: albero degli elementi', () => {
  it('annida gli elementi, legge le classi, non entra in commenti, script, stili e SVG', () => {
    const a = albero('<div class="a  b"><!-- <p class="no"> --><p class=\'c\'>x<br><img class=d src="1>2.jpg"></p><svg class="no"><path class="no"/></svg><script>if (a<b) "<i class=no>"</script></div><span class="e"></span>');
    const piatto = (n) => [n.classi.join('.'), ...n.figli.flatMap(piatto)];
    assert.deepEqual(piatto(a), ['', 'a.b', 'c', '', 'd', 'e']);
    assert.deepEqual(a.figli.map((n) => n.tag), ['div', 'span']);
  });

  it('un <svg/> chiuso su se stesso non inghiotte ciò che segue; class= dentro un altro attributo non è la classe', () => {
    const a = albero('<div class="a"><svg class="no" viewBox="0 0 1 1"/><p class="b">x</p><svg><path/></svg></div><a title=\'di class="finta"\' class="c">y</a>');
    const piatto = (n) => [n.classi.join('.'), ...n.figli.flatMap(piatto)];
    assert.deepEqual(piatto(a), ['', 'a', 'no', 'b', 'c']);
  });

  it('un tag di chiusura senza apertura, o un elemento mai chiuso, non fa perdere il resto', () => {
    const a = albero('</div><ul class="a"><li class="b">uno<li class="c">due</ul><p class="d">dopo</p>');
    assert.deepEqual(a.figli.map((n) => n.classi[0]), ['a', 'd']);
  });
});

describe('parita.js: scheletro', () => {
  it('tiene gli elementi con una classe del progetto, annidati, con le classi di design', () => {
    assert.deepEqual(stampa(scheletro(pagina(), P)), [
      'abc-header', '  abc-header__inner', '    abc-header__nav',
      'abc-main',
      '  abc-block-hero abc-block-hero--image alignfull', '    abc-block-hero__inner', '      abc-block-hero__title', '      abc-block-hero__button',
      '  abc-block-image-text abc-block-image-text--image-left alignfull', '    abc-block-image-text__inner', '      abc-block-image-text__img', '      abc-block-card', '        abc-block-card__title',
      'abc-footer', '  abc-footer__inner', '    abc-footer__bottom',
    ]);
  });

  it('zone: header, footer e il resto', () => {
    const z = zone(scheletro(pagina(), P), P);
    assert.deepEqual([z.header, z.footer, z.contenuto].map((nodi) => nodi.map((n) => n.etichetta)), [['abc-header'], ['abc-footer'], ['abc-main']]);
  });
});

describe('parita.js: i contenuti non contano', () => {
  it('testi, link, immagini diversi: nessuna differenza', () => {
    assert.deepEqual(diff(pagina(), pagina({ titolo: 'Un altro <strong>titolo</strong>, scritto dal cliente' }).replace('href="/x"', 'href="https://example.com"').replace('a.jpg', 'b.webp')), []);
  });

  it('una serie ripetuta con più o meno elementi: nessuna differenza', () => {
    assert.deepEqual(diff(pagina({ card: 2 }), pagina({ card: 5 })), []);
    assert.deepEqual(diff(pagina({ card: 3 }), pagina({ card: 1 })), []);
  });

  it('le classi che WordPress e Swiper aggiungono, e l\'ordine delle classi: nessuna differenza', () => {
    const wp = pagina({ classiHero: 'abc-block-hero--image abc-block-hero wp-block-abc-hero alignfull wp-elements-3f2 is-layout-flow has-global-padding swiper-initialized' });
    assert.deepEqual(diff(pagina(), wp), []);
  });

  it('un blocco core che stampa due volte le stesse classi, e il bottone del menu che esiste solo nel kit: nessuna differenza', () => {
    const wp = pagina().replace('<button class="abc-header__toggle">Menu</button>', '').replace('<nav class="abc-header__nav"><ul>', '<nav class="abc-header__nav wp-block-navigation"><ul class="abc-header__nav wp-block-navigation__container">');
    assert.deepEqual(diff(pagina(), wp), []);
  });
});

describe('parita.js: un campo facoltativo lasciato vuoto in WordPress è contenuto', () => {
  const senzaBottone = (html) => html.replace('<a class="wp-block-button__link abc-block-hero__button" href="/x">Vai</a>', '');

  it('un elemento foglia del blocco che il sito non stampa (testo o link svuotato): nessuna differenza', () => {
    assert.deepEqual(diff(pagina(), senzaBottone(pagina())), []);
  });

  it('una card della serie senza il suo titolo: nessuna differenza', () => {
    const unaSenzaTitolo = pagina({ card: 3 }).replace('<h3 class="abc-block-card__title">Card</h3>', '');
    assert.deepEqual(diff(pagina({ card: 3 }), unaSenzaTitolo), []);
  });

  it('un elemento che il sito stampa e il kit non ha resta una differenza', () => {
    assert.deepEqual(diff(senzaBottone(pagina()), pagina()), ['solo nel sito: abc-main › abc-block-hero › abc-block-hero__inner › abc-block-hero__button']);
  });

  it('un contenitore del blocco che manca nel sito resta una differenza', () => {
    assert.equal(diff(pagina(), pagina().replace(/<div class="abc-block-hero__inner">([\s\S]*?)<\/div><\/section>/, '$1</section>')).length > 0, true);
  });
});

describe('parita.js: la struttura conta', () => {
  it('due sezioni uguali in fila nel kit e una sola nel sito: differenza (le sezioni non sono una serie)', () => {
    const cta = '<section class="abc-block-cta alignfull"><div class="abc-block-cta__inner"><p class="abc-block-cta__title">x</p></div></section>';
    assert.deepEqual(diff(pagina({ extra: cta + cta }), pagina({ extra: cta })), ['solo nel kit: abc-main › abc-block-cta alignfull']);
  });

  it('variante diversa: classi diverse, con il percorso', () => {
    assert.deepEqual(diff(pagina(), pagina({ variante: 'image-right' })), [
      'classi diverse: abc-main › abc-block-image-text — kit [abc-block-image-text abc-block-image-text--image-left alignfull] · sito [abc-block-image-text abc-block-image-text--image-right alignfull]',
    ]);
  });

  it('una sezione in più o in meno', () => {
    const extra = '<section class="abc-block-cta alignfull"><p class="abc-block-cta__title">x</p></section>';
    assert.deepEqual(diff(pagina(), pagina({ extra })), ['solo nel sito: abc-main › abc-block-cta alignfull']);
    assert.deepEqual(diff(pagina({ extra }), pagina()), ['solo nel kit: abc-main › abc-block-cta alignfull']);
  });

  it('un elemento del blocco in più, una classe del progetto diversa, un colore diverso', () => {
    assert.deepEqual(diff(pagina(), pagina().replace('<h1 class="abc-block-hero__title">', '<p class="abc-block-hero__kicker">k</p><h1 class="abc-block-hero__title">')),
      ['solo nel sito: abc-main › abc-block-hero › abc-block-hero__inner › abc-block-hero__kicker']);
    // Una classe rinominata su un elemento senza figli: il sito stampa un elemento che il kit non ha.
    assert.deepEqual(diff(pagina(), pagina().replace('abc-footer__bottom', 'abc-footer__fondo')), ['solo nel sito: abc-footer › abc-footer__inner › abc-footer__fondo']);
    assert.match(diff(pagina(), pagina({ classiHero: 'alignfull abc-block-hero abc-block-hero--image has-dark-background-color has-background' }))[0], /^classi diverse: abc-main › abc-block-hero — /);
  });

  it('stesse sezioni in un altro ordine', () => {
    const trovate = diff(pagina(), pagina({ ordine: 'ba' }));
    assert.equal(trovate.length, 1);
    assert.match(trovate[0], /^ordine diverso: abc-main › abc-block-/);
  });
});

describe('parita.js: DESIGN.md e lato modificato per ultimo', () => {
  const design = ['## Telaio', '| Item | Stato | Kit | Note |', '|---|---|---|---|', '| header | implementato | src/kit/main/header | x |', '| footer | kit | src/kit/main/footer | y |', '',
    '## Pagine', '| Pagina | URL | Stato | Kit | Blocchi (in ordine) |', '|---|---|---|---|---|', '| Home | / | implementata | src/kit/abc-home.kit | hero |', '| Chi siamo | /chi-siamo/ | kit | `src/kit/abc-chi-siamo.kit` | — |', '',
    'Testo dopo la tabella.', '| non | è | una | riga |', '', '## Blocchi'].join('\n');

  it('legge le righe di una tabella sotto il suo titolo, e si ferma dove la tabella finisce', () => {
    assert.deepEqual(tabella(design, 'Pagine').map((r) => [r.pagina, r.url, r.stato, r.kit]), [['Home', '/', 'implementata', 'src/kit/abc-home.kit'], ['Chi siamo', '/chi-siamo/', 'kit', '`src/kit/abc-chi-siamo.kit`']]);
    assert.deepEqual(tabella(design, 'Telaio').map((r) => [r.item, r.stato]), [['header', 'implementato'], ['footer', 'kit']]);
    assert.deepEqual(tabella(design, 'Navigazione'), []);
  });

  it('dice quale lato è cambiato per ultimo, o che non lo sa', () => {
    assert.match(ultimoLato('2026-11-10T10:00:00+01:00', '2026-11-02T13:59:00Z', 'la pagina in WordPress'), /^Per ultimo è cambiato il kit .*porta la differenza in WordPress\.$/);
    assert.match(ultimoLato('2026-11-01T10:00:00+01:00', '2026-11-02T13:59:00Z', 'la pagina in WordPress'), /^Per ultimo è cambiato la pagina in WordPress .*allinea il kit\.$/);
    assert.match(ultimoLato('ora', '2026-11-02T13:59:00Z', 'la pagina in WordPress'), /non ancora committate.*porta la differenza in WordPress/);
    assert.match(ultimoLato(null, '2026-11-02T13:59:00Z', 'la pagina in WordPress'), /^Non so dire/);
  });

  it('da riga di comando: senza argomenti uso ed exit 2; cartella senza DESIGN.md exit 1 con il motivo', () => {
    let r = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' });
    assert.equal(r.status, 2, r.stdout + r.stderr);
    assert.match(r.stderr, /uso: node parita\.js/);
    r = spawnSync(process.execPath, [SCRIPT, RADICE, '--html'], { encoding: 'utf8' });
    assert.equal(r.status, 2);
    // Non è una differenza di struttura: lo script non ha potuto verificare, e lo dice.
    r = spawnSync(process.execPath, [SCRIPT, path.join(RADICE, 'tests')], { encoding: 'utf8' });
    assert.equal(r.status, 3, r.stdout + r.stderr);
    assert.match(r.stdout + r.stderr, /Parità non verificata — .*non c'è DESIGN\.md/);
  });
});
