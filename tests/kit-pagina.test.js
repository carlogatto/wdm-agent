// kit-pagina.js: dal kit compilato di una pagina al file di blocchi che wp-page.php confronta.
// Qui senza WordPress: lettura del README, mappatura, serializzazione, riga di comando
// `controlla`. Le fixture hanno il prefisso `abc`: lo script non ha un prefisso scritto dentro.
// Con WordPress: tests/sito/kit-pagina.test.js.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { RADICE } = require('./lib/citati');
const SCRIPT = path.join(RADICE, 'skills', 'fse-build', 'scripts', 'kit-pagina.js');
const { documento } = require(path.join(RADICE, 'shared', 'scripts', 'lib', 'html.js'));
const { contratto, mappa, serializza } = require(SCRIPT);

const SITO = path.join(__dirname, 'fixtures', 'kit-pagina');
const TEMA = path.join(SITO, 'wp-content', 'themes', 'abc-tema');
const HTML = fs.readFileSync(path.join(TEMA, 'html', 'abc-prova.html'), 'utf8');
const readme = (slug) => {
  const file = path.join(TEMA, 'blocks', `abc-block-${slug}`, 'README.md');
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
};
const ambiente = (html = HTML) => ({
  html,
  prefisso: 'abc',
  leggiReadme: readme,
  icone: { matita: fs.readFileSync(path.join(TEMA, 'assets', 'img', 'icons', 'matita.svg'), 'utf8') },
  pattern: (nome) => {
    const file = path.join(TEMA, 'patterns', `abc-${nome}.php`);
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  },
});
const URL_FOTO = 'https://x.test/wp-content/uploads/foto-1.jpg';
const RISPOSTE = {
  immagini: { 'foto.jpg': { id: 7, url: URL_FOTO } },
  post: { 'Ciao mondo!': { id: 1, tipo: 'post' } },
  form: { contatti: 2 },
  pagina: [],
  ultimo: { id: 9, tipo: 'post' },
};
// La sequenza \uXXXX di un carattere, composta in codice (scritta in un file non sopravvive).
const U = (c) => `\\${'u'}${c.charCodeAt(0).toString(16).padStart(4, '0')}`;
// I commenti di blocco di un file, in ordine: [nome, attributi | null].
const commenti = (testo) => [...testo.matchAll(/<!-- wp:([a-z0-9/-]+)(?: (\{.*?\}))? \/?-->/g)].map((m) => [m[1], m[2] ? JSON.parse(m[2]) : null]);
// La stessa pagina con un pezzo cambiato: il pezzo da sostituire deve esserci.
const con = (prima, dopo) => {
  assert.ok(HTML.includes(prima), `la fixture non contiene: ${prima}`);
  return HTML.replace(prima, dopo);
};

describe('documento (lib/html.js)', () => {
  it('tiene attributi, testi, commenti e l\'HTML interno; albero() resta com\'era', () => {
    const doc = documento('<main id="m" class="a b"><!-- nota --><p data-x="1">Uno <b>due</b></p><img src="x.jpg" alt=""><svg viewBox="0 0 1 1"><path d="M0"/></svg></main>');
    const main = doc.figli[0];
    assert.equal(main.tag, 'main');
    assert.deepEqual(main.attr, { id: 'm', class: 'a b' });
    assert.deepEqual(main.classi, ['a', 'b']);
    assert.equal(main.figli[0].commento, 'nota');
    const p = main.figli[1];
    assert.equal(p.attr['data-x'], '1');
    assert.equal(doc.sorgente.slice(p.dentroDa, p.dentroA), 'Uno <b>due</b>');
    assert.equal(p.figli[0].testo, 'Uno ');
    assert.equal(main.figli[2].tag, 'img');
    assert.equal(main.figli[2].attr.alt, '');
    assert.equal(main.figli[3].tag, 'svg');
    assert.equal(main.figli[3].grezzo, '<svg viewBox="0 0 1 1"><path d="M0"/></svg>');
  });

  it('un elemento non chiuso finisce dove si chiude chi lo contiene', () => {
    const doc = documento('<div><p>Uno<span>due</div><p>tre</p>');
    const div = doc.figli[0];
    assert.equal(doc.sorgente.slice(div.dentroDa, div.dentroA), '<p>Uno<span>due');
    assert.equal(doc.figli[1].tag, 'p');
  });
});

describe('contratto: ciò che lo script legge da un README', () => {
  const c = contratto(readme('sezione'), 'abc', 'sezione');

  it('la tabella degli attributi: nome, tipo, default, nell\'ordine', () => {
    assert.deepEqual(c.attributi.slice(0, 4).map((a) => [a.nome, a.tipo, a.default]), [
      ['variant', 'string', 'piena'], ['headingLevel', 'integer', 2], ['title', 'string', ''], ['text', 'string', ''],
    ]);
    assert.equal(c.attributo.buttonNewTab.default, false);
    assert.equal(c.attributo.centered.default, true);
  });

  it('le note che dicono da dove si legge un valore', () => {
    assert.equal(c.attributo.occhiello.kit, 'sopra');
    assert.equal(c.attributo.columns.stile, '--abc-columns');
    assert.equal(c.attributo.perView.data, 'data-per-view');
    assert.deepEqual(c.attributo.centered.modificatore, { valore: 'false', classe: '__inner--start' });
  });

  it('varianti, figli, supports, elemento di un plugin', () => {
    assert.deepEqual(c.varianti.map((v) => [v.nome, v.attributo]), [['piena', 'variant'], ['divisa', 'variant']]);
    assert.deepEqual(contratto(readme('giostra'), 'abc', 'giostra').varianti.map((v) => [v.nome, v.attributo]), [['manual', 'source'], ['query', 'source']]);
    assert.deepEqual(c.figli, { nomi: ['voce'], liberi: false, soloIn: null });
    assert.deepEqual(contratto(readme('giostra'), 'abc', 'giostra').figli, { nomi: ['scheda'], liberi: false, soloIn: 'manual' });
    assert.equal(contratto(readme('libero'), 'abc', 'libero').figli.liberi, true);
    assert.deepEqual([c.supports.anchor, c.supports.colore], [true, true]);
    assert.deepEqual([contratto(readme('voce'), 'abc', 'voce').supports.anchor, contratto(readme('libero'), 'abc', 'libero').supports.colore], [false, false]);
    assert.equal(contratto(readme('modulo'), 'abc', 'modulo').plugin, 'form');
  });

  it('i dodici README del tema base si leggono: ogni blocco ha attributi o figli', (t) => {
    let base;
    try {
      base = require('./lib/sito').leggiConfig().base;
    } catch {
      return t.skip('tema base non configurato (tests/sito.local.json)');
    }
    const blocchi = path.join(base, 'wp-content', 'themes', 'wdm-theme', 'blocks');
    const cartelle = fs.readdirSync(blocchi).filter((n) => n.startsWith('wdm-block-'));
    assert.ok(cartelle.length >= 12, `blocchi trovati: ${cartelle.length}`);
    for (const cartella of cartelle) {
      const slug = cartella.slice('wdm-block-'.length);
      const letto = contratto(fs.readFileSync(path.join(blocchi, cartella, 'README.md'), 'utf8'), 'wdm', slug);
      assert.ok(letto.attributi.length > 0, `${slug}: nessun attributo letto`);
      for (const a of letto.attributi) assert.match(a.nome, /^[a-zA-Z]+$/, `${slug}: nome di attributo non valido «${a.nome}»`);
    }
    const leggi = (slug) => contratto(fs.readFileSync(path.join(blocchi, `wdm-block-${slug}`, 'README.md'), 'utf8'), 'wdm', slug);
    assert.equal(leggi('columns-wrapper').attributo.columns.stile, '--wdm-columns');
    assert.deepEqual(leggi('columns-wrapper').attributo.centered.modificatore, { valore: 'false', classe: '__inner--start' });
    assert.equal(leggi('columns-wrapper').figli.liberi, true);
    assert.equal(leggi('cards-carousel').attributo.perView.data, 'data-per-view');
    assert.equal(leggi('cards-carousel').figli.soloIn, 'manual');
    assert.deepEqual(leggi('cards-carousel').varianti.map((v) => v.attributo), ['source', 'source']);
    assert.deepEqual(leggi('hero').varianti.map((v) => [v.nome, v.attributo]), [['image', 'variant'], ['carousel', 'variant']]);
    assert.equal(leggi('form').plugin, 'form');
  });
});

describe('mappa + serializza: la pagina di prova', () => {
  const m = mappa(ambiente());
  const { testo, note } = serializza(m.blocchi, RISPOSTE);
  const blocchi = commenti(testo);

  it('nessun errore; la sequenza dei blocchi di primo livello', () => {
    assert.deepEqual(m.errori, []);
    assert.deepEqual(m.blocchi.map((b) => b.etichetta), ['sezione (divisa)', 'sezione (piena)', 'libero', 'giostra (manual)', 'giostra (query)', 'modulo', 'pattern recapiti']);
  });

  it('una sezione con tutto il vocabolario: valori, ordine della tabella, default omessi', () => {
    const [nome, attrs] = blocchi[0];
    assert.equal(nome, 'abc/sezione');
    assert.deepEqual(attrs, {
      variant: 'divisa', title: 'Titolo con <strong>forza</strong> &amp; due -- trattini', text: 'Testo su due righe.', occhiello: 'Sopra il titolo',
      imageId: 7, imageUrl: URL_FOTO, imageAlt: 'Una "foto"', buttonText: 'Scrivici', buttonUrl: '/contatti/', buttonNewTab: true,
      secondaryButtonText: 'Dopo', columns: 4, perView: 2, centered: false, anchor: 'apertura', backgroundColor: 'dark', textColor: 'base',
    });
    assert.deepEqual(Object.keys(attrs).slice(0, 4), ['variant', 'title', 'text', 'occhiello']);
  });

  it('gli attributi sono scritti con le sequenze di WordPress', () => {
    const riga = testo.split('\n')[0];
    assert.ok(riga.includes(`${U('<')}strong${U('>')}forza${U('<')}/strong${U('>')} ${U('&')}amp; due ${U('-')}${U('-')} trattini`), riga);
    assert.ok(riga.includes(`Una ${U('"')}foto${U('"')}`), riga);
    assert.ok(!/<strong>|--| & /.test(riga.slice('<!-- '.length, -' -->'.length)), riga);
  });

  it('i figli: icona del set, link di testo con # tenuto, campi vuoti omessi', () => {
    assert.deepEqual(blocchi[1], ['abc/voce', { icon: 'matita', kicker: '01', title: 'Prima voce', text: 'Testo della voce.', linkText: 'Leggi', linkUrl: '#' }]);
    assert.deepEqual(blocchi[2], ['abc/voce', { title: 'Seconda voce' }]);
  });

  it('variante al default omessa, livello del titolo dal tag', () => {
    assert.ok(testo.includes('<!-- wp:abc/sezione {"headingLevel":3,"title":"Seconda"} /-->'), testo);
  });

  it('InnerBlocks liberi: paragrafo, titoli e codice core', () => {
    const atteso = ['<!-- wp:abc/libero -->', '<!-- wp:heading -->', '<h2 class="wp-block-heading">Titolo core</h2>', '<!-- /wp:heading -->',
      '<!-- wp:paragraph -->', '<p>Paragrafo <a href="/x/">con link</a>.</p>', '<!-- /wp:paragraph -->',
      '<!-- wp:heading {"level":3} -->', '<h3 class="wp-block-heading">Sotto</h3>', '<!-- /wp:heading -->',
      '<!-- wp:code -->', '<pre class="wp-block-code"><code>riga uno\nriga due</code></pre>', '<!-- /wp:code -->', '<!-- /wp:abc/libero -->'].join('\n');
    assert.ok(testo.includes(atteso), testo);
  });

  it('schede: da un post per titolo, segnaposto → ultimo post, a mano con i suoi valori', () => {
    const giostra = blocchi.findIndex(([nome, a]) => nome === 'abc/giostra' && a.title === 'Notizie');
    assert.deepEqual(blocchi.slice(giostra, giostra + 4), [
      ['abc/giostra', { title: 'Notizie' }],
      ['abc/scheda', { postId: 1 }],
      ['abc/scheda', { postId: 9 }],
      ['abc/scheda', { title: 'Scheda a mano', text: 'Testo della scheda.', imageId: 7, imageUrl: URL_FOTO, linkUrl: '#' }],
    ]);
  });

  it('il segnaposto tiene il post che la pagina ha già in quella posizione', () => {
    const pagina = [{ chiave: 'abc/giostra', figli: [{ postId: 1, postType: 'post' }, { postId: 44, postType: 'page' }] }];
    const r = commenti(serializza(m.blocchi, { ...RISPOSTE, pagina }).testo);
    assert.ok(r.some(([nome, a]) => nome === 'abc/scheda' && a.postId === 44 && a.postType === 'page'), JSON.stringify(r));
  });

  it('variante query: i figli del kit non entrano (## Figli: Solo in `manual`)', () => {
    assert.ok(testo.includes('<!-- wp:abc/giostra {"source":"query","title":"Dal blog"} /-->'), testo);
  });

  it('form: l\'id dal form_key; non si legge dentro l\'uscita del plugin', () => {
    assert.ok(testo.includes('<!-- wp:abc/modulo {"title":"Scrivici","formId":2} /-->'), testo);
    const senza = serializza(m.blocchi, { ...RISPOSTE, form: {} });
    assert.ok(senza.testo.includes('<!-- wp:abc/modulo {"title":"Scrivici"} /-->'), senza.testo);
    assert.ok(senza.note.some((n) => n.includes('contatti') && n.includes('Formidable')), senza.note.join('\n'));
  });

  it('pattern: il suo markup con i testi del kit', () => {
    assert.ok(testo.includes('<!-- wp:group {"className":"abc-recapiti"} -->'), testo);
    assert.ok(testo.includes('<h2 class="wp-block-heading has-text-align-center">Dove siamo</h2>'), testo);
    assert.ok(testo.includes('<p>Via Roma 1<br>Tivoli</p>'), testo);
    assert.ok(!testo.includes('<?php') && !testo.includes('Via Esempio'), testo);
  });

  it('opzioni di pagina: il kit ha il suo h1 e stampa il form di default', () => {
    assert.deepEqual(m.opzioni, { titolo: 0, form: 1 });
    assert.deepEqual(mappa(ambiente(con('<h1 class="abc-block-sezione__title">', '<h2 class="abc-block-sezione__title">').replace('due -- trattini</h1>', 'due -- trattini</h2>').replace(/<div class="wp-block-template-part[\s\S]*?<\/section><\/div>/, ''))).opzioni, { titolo: 1, form: 0 });
  });

  it('note: bottone con # (URL vuoto), link # tenuto, [da confermare], scheda senza post', () => {
    const tutte = [...m.note, ...note].join('\n');
    assert.match(tutte, /«Dopo».*#/);
    assert.match(tutte, /«Leggi».*#/);
    assert.match(tutte, /\[da confermare\].*pagina da creare/);
    const senzaPost = serializza(m.blocchi, { ...RISPOSTE, post: {}, ultimo: null });
    assert.ok(senzaPost.note.some((n) => n.includes('Ciao mondo!')), senzaPost.note.join('\n'));
    assert.ok(senzaPost.testo.includes('<!-- wp:abc/scheda /-->'), senzaPost.testo);
  });

  it('stesso kit, stesse risposte: stesso file', () => {
    assert.equal(serializza(mappa(ambiente()).blocchi, RISPOSTE).testo, testo);
  });

  it('ciò che serve da WordPress: immagini, titoli dei post, chiavi dei form', () => {
    assert.deepEqual(m.richieste, { immagini: ['foto.jpg'], post: ['Ciao mondo!'], form: ['contatti'] });
  });
});

describe('mappa: ciò che non sa leggere lo dichiara, non lo perde', () => {
  const errori = (html) => mappa(ambiente(html)).errori.join('\n');
  const casi = [
    ['un elemento del blocco che il README non nomina', con('<p class="abc-block-sezione__sopra">', '<p class="abc-block-sezione__ignoto">x</p><p class="abc-block-sezione__sopra">'), /abc-block-sezione__ignoto/],
    ['un modificatore che non è una variante', con('abc-block-sezione abc-block-sezione--divisa', 'abc-block-sezione abc-block-sezione--strana'), /strana/],
    ['un modificatore di elemento che nessuna nota dice', con('abc-block-sezione__inner abc-block-sezione__inner--start', 'abc-block-sezione__inner abc-block-sezione__inner--largo'), /__inner--largo/],
    ['un data-* che il README non nomina', con('data-per-view="2"', 'data-per-view="2" data-velocita="3"'), /data-velocita/],
    ['uno stile in linea sulla sezione', con('id="apertura"', 'id="apertura" style="padding-top:10px"'), /padding-top/],
    ['una proprietà --abc-* che nessuna nota dice', con('style="--abc-columns:4"', 'style="--abc-columns:4;--abc-gap:2"'), /--abc-gap/],
    ['un testo fuori da un elemento mappato', con('<p class="abc-block-sezione__sopra">', 'Testo sciolto <p class="abc-block-sezione__sopra">'), /Testo sciolto/],
    ['un terzo bottone', con('>Dopo</a>', '>Dopo</a><a class="wp-element-button abc-block-sezione__button" href="/x/">Terzo</a>'), /abc-block-sezione__button/],
    ['due titoli', con('<p class="abc-block-sezione__text">', '<h2 class="abc-block-sezione__title">Bis</h2><p class="abc-block-sezione__text">'), /abc-block-sezione__title/],
    ['un elemento di primo livello che non è un blocco', con('<div class="wp-block-group abc-recapiti">', '<div class="altro">x</div><div class="wp-block-group abc-recapiti">'), /primo livello.*altro/],
    ['un blocco core con una classe in più', con('<p class="wp-block-paragraph">Paragrafo', '<p class="wp-block-paragraph has-text-align-center">Paragrafo'), /has-text-align-center/],
    ['un blocco core che non conosce', con('<h3 class="wp-block-heading">Sotto</h3>', '<ul class="wp-block-list"><li>a</li></ul>'), /<ul/],
    ['un\'icona che non è del set', con('<path d="M1 2l3 4"/></svg></span>', '<path d="M9 9"/></svg></span>'), /icona/],
    ['un figlio che ## Figli non nomina', con('<div class="abc-block-sezione__buttons">', '<article class="wp-block-abc-scheda abc-block-scheda"><div class="abc-block-scheda__body"><h3 class="abc-block-scheda__title">X</h3></div></article><div class="abc-block-sezione__buttons">'), /abc\/scheda/],
    ['un\'immagine che non è in assets/img/', con('src="../assets/img/foto.jpg" alt="Una', 'src="https://example.com/x.jpg" alt="Una'), /example\.com/],
    ['un blocco senza README', con('<section class="wp-block-abc-modulo alignfull abc-block-modulo">', '<section class="abc-block-fantasma"></section><section class="wp-block-abc-modulo alignfull abc-block-modulo">'), /fantasma.*README/],
    ['un colore su un blocco che non lo dichiara nei supports', con('<section class="wp-block-abc-libero alignfull abc-block-libero">', '<section class="wp-block-abc-libero alignfull has-background has-dark-background-color abc-block-libero">'), /Supports/],
    ['un id su un blocco senza anchor', con('<div class="wp-block-abc-voce abc-block-voce">\n          <h3', '<div class="wp-block-abc-voce abc-block-voce" id="x">\n          <h3'), /anchor/],
    ['un pattern con un paragrafo in più', con('<p class="wp-block-paragraph">Via Roma 1<br>Tivoli</p>', '<p class="wp-block-paragraph">Via Roma 1<br>Tivoli</p><p class="wp-block-paragraph">In più</p>'), /pattern recapiti/],
    ['un form senza form_key', con('<input type="hidden" name="form_key" value="contatti" />', ''), /form_key/],
    ['una classe sulla radice che il README non nomina', con('<section class="wp-block-abc-libero alignfull abc-block-libero">', '<section class="wp-block-abc-libero alignfull is-style-strano abc-block-libero">'), /is-style-strano/],
    ['una classe su un elemento che il README non nomina', con('<p class="abc-block-sezione__sopra">', '<p class="abc-block-sezione__sopra is-grande">'), /is-grande/],
    ['un bottone che non è un link', con('<a class="wp-element-button is-style-outline abc-block-sezione__button" href="#">Dopo</a>', '<button class="wp-element-button is-style-outline abc-block-sezione__button">Dopo</button>'), /abc-block-sezione__button/],
  ];
  for (const [nome, html, atteso] of casi) {
    it(nome, () => assert.match(errori(html), atteso));
  }

  it('senza <main>', () => assert.match(errori('<body><p>x</p></body>'), /<main>/));

  it('ogni errore nomina il blocco in cui sta', () => {
    assert.match(errori(casi[0][1]), /sezione \(divisa\)/);
  });
});

describe('kit-pagina.js da riga di comando', () => {
  let tmp;
  const lancia = (...args) => {
    const r = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
    assert.ifError(r.error);
    return { status: r.status, out: r.stdout + r.stderr };
  };
  // Una copia del progetto di prova, con la pagina cambiata.
  const copia = (html) => {
    const sito = fs.mkdtempSync(path.join(tmp, 'sito-'));
    fs.cpSync(SITO, sito, { recursive: true });
    fs.writeFileSync(path.join(sito, 'wp-content', 'themes', 'abc-tema', 'html', 'abc-prova.html'), html);
    return sito;
  };

  before(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wdm-agent-kit-pagina-')); });
  after(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('controlla: exit 0, la sequenza, le opzioni e le note; non serve WordPress', () => {
    const r = lancia(SITO, 'prova', 'controlla');
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /sezione \(divisa\) · sezione \(piena\) · libero · giostra \(manual\) · giostra \(query\) · modulo · pattern recapiti/);
    assert.match(r.out, /abc_show_title 0/);
    assert.match(r.out, /abc_show_form 1/);
    assert.match(r.out, /\[da confermare\]/);
  });

  it('pagina non mappabile: exit 3, una riga per motivo, nessun file scritto', () => {
    const sito = copia(con('<p class="abc-block-sezione__sopra">', '<p class="abc-block-sezione__ignoto">x</p><p class="abc-block-sezione__sopra">').replace('data-per-view="2"', 'data-per-view="2" data-velocita="3"'));
    const uscita = path.join(tmp, 'non-deve-esistere.html');
    const r = lancia(sito, 'prova', uscita);
    assert.equal(r.status, 3, r.out);
    assert.match(r.out, /abc-block-sezione__ignoto/);
    assert.match(r.out, /data-velocita/);
    assert.match(r.out, /nulla è stato scritto/);
    assert.equal(fs.existsSync(uscita), false);
    assert.equal(lancia(sito, 'prova', 'controlla').status, 3);
  });

  it('un\'immagine del kit che manca in assets/img/: exit 3', () => {
    const sito = copia(HTML);
    fs.rmSync(path.join(sito, 'wp-content', 'themes', 'abc-tema', 'assets', 'img', 'foto.jpg'));
    const r = lancia(sito, 'prova', 'controlla');
    assert.equal(r.status, 3, r.out);
    assert.match(r.out, /foto\.jpg/);
  });

  it('uso sbagliato, progetto che non c\'è, kit non compilato: exit 2 con cosa fare', () => {
    assert.equal(lancia().status, 2);
    assert.equal(lancia(SITO, 'prova').status, 2);
    assert.equal(lancia(SITO, 'prova', 'controlla', 'altro=1').status, 2);
    const vuota = fs.mkdtempSync(path.join(tmp, 'vuota-'));
    const senza = lancia(vuota, 'prova', 'controlla');
    assert.equal(senza.status, 2, senza.out);
    assert.match(senza.out, /DESIGN\.md/);
    const manca = lancia(SITO, 'assente', 'controlla');
    assert.equal(manca.status, 2, manca.out);
    assert.match(manca.out, /npm run build/);
  });

  it('senza {wp-cli} in DESIGN.md il file non si scrive: exit 2', () => {
    const uscita = path.join(tmp, 'senza-wp.html');
    const r = lancia(SITO, 'prova', uscita);
    assert.equal(r.status, 2, r.out);
    assert.match(r.out, /\{wp-cli\}/);
    assert.equal(fs.existsSync(uscita), false);
  });
});
