// wp-navigation.php sul sito di prova: le voci con & o " arrivano intatte nel post wp_navigation
// (wp_insert_post e wp_update_post vogliono dati slashati) e un secondo apply non trova nulla da
// scrivere. `confirm` serve solo quando WordPress perderebbe qualcosa (U07); un menu aperto
// nell'editor non si scrive (U16); le parts si controllano prima di creare un menu.
// Exit: 0 ok · 1 errore · 3 perdite in attesa di conferma · 4 menu aperto nell'editor.
// `apply … prova` confronta e non scrive mai (lo usa controllo.js): 0 nessuna differenza · 5 differenze.
// I casi sono in sequenza.
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
  const scriviVoci = (...voci) => fs.writeFileSync(kit, `<nav aria-label="${TITOLO}"><ul>\n${voci.map((v) => `  <li><a href="#">${v}</a></li>`).join('\n')}\n</ul></nav>\n`);
  const contenuto = () => sito.wp(['post', 'get', id, '--field=post_content']).stdout;
  const scriviInWp = (testo) => assert.equal(sito.wp(['post', 'update', id, `--post_content=${testo}`]).status, 0);
  // Pianifica dal kit e applica: pretende codice d'uscita e, se dati, i testi nell'output.
  const atteso = (status, args, ...testi) => {
    pianifica();
    const r = applica(...args);
    assert.equal(r.status, status, r.out);
    for (const testo of testi) assert.ok(r.out.includes(testo), `manca «${testo}» in: ${r.out}`);
    return r;
  };

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
    // Prima, in prova: il menu che manca è «da creare», e non nasce né il post né il ref.
    const menu = () => sito.wp(['post', 'list', '--post_type=wp_navigation', '--post_status=any', '--format=count']).stdout.trim();
    const prima = menu();
    const prova = applica('prova');
    assert.equal(prova.status, 5, prova.out);
    assert.match(prova.out, /da creare/);
    assert.equal(menu(), prima, 'prova ha creato un menu');
    assert.ok(!fs.readFileSync(path.join(parts, 'header.html'), 'utf8').includes('"ref"'), 'prova ha scritto il ref');
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

  it('(c2) prova: menu allineato → 0 differenze, exit 0; con confirm è un errore', () => {
    let r = applica('prova');
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /0 differenze/);
    r = applica('prova', 'confirm');
    assert.equal(r.status, 1, r.out);
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

  it('(e) voce aggiunta nel kit: si scrive senza confirm', () => {
    scriviVoci('Uno', 'Due');
    atteso(0, ['confirm']);
    scriviVoci('Uno', 'Due', 'Contatti');
    // In prova l'aggiunta si vede e non si scrive (senza `prova` si scriverebbe subito).
    atteso(5, ['prova'], '+ ');
    assert.ok(!contenuto().includes('Contatti'), 'prova ha scritto');
    atteso(0, [], 'aggiornato', '+ ');
    assert.ok(contenuto().includes('Contatti'));
  });

  it('(f) riordino: si scrive senza confirm', () => {
    scriviVoci('Contatti', 'Uno', 'Due');
    atteso(0, [], 'aggiornato');
    assert.ok(contenuto().indexOf('Contatti') < contenuto().indexOf('Uno'));
  });

  it('(g) una voce orfana trova la sua pagina: si scrive senza confirm', () => {
    assert.equal(sito.wp(['post', 'create', '--post_type=page', '--post_status=publish', '--post_title=Contatti', '--porcelain']).status, 0);
    atteso(0, [], 'aggiornato');
    assert.ok(contenuto().includes('"kind":"post-type"'), contenuto());
  });

  it('(h) voce tolta dal kit: exit 3 con il nome della voce, nulla scritto; confirm la toglie', () => {
    scriviVoci('Contatti', 'Uno');
    // In prova una perdita è una differenza come le altre: exit 5, nulla scritto.
    atteso(5, ['prova'], 'WordPress perderebbe: «Due»');
    atteso(3, [], 'WordPress perderebbe: «Due»');
    assert.ok(contenuto().includes('Due'), 'apply senza confirm ha scritto');
    atteso(0, ['confirm'], 'aggiornato');
    assert.ok(!contenuto().includes('Due'));
  });

  it('(i) voce aggiunta a mano in WordPress: exit 3, non sparisce perché il kit ha solo aggiunte', () => {
    scriviInWp(`${contenuto()}\n<!-- wp:navigation-link {"label":"Blog","url":"https://example.com/blog","kind":"custom"} /-->`);
    scriviVoci('Contatti', 'Uno', 'Tre');
    atteso(3, [], '«Blog» (https://example.com/blog)');
    assert.ok(contenuto().includes('Blog') && !contenuto().includes('Tre'));
    atteso(0, ['confirm']);
    assert.ok(!contenuto().includes('Blog') && contenuto().includes('Tre'));
  });

  it('(j) indirizzo scritto a mano su una voce del kit, o un blocco che non è una voce: exit 3', () => {
    scriviInWp(contenuto().replace('"label":"Tre","url":"#"', '"label":"Tre","url":"https://example.com/tre"'));
    assert.ok(contenuto().includes('https://example.com/tre'));
    atteso(3, [], '«Tre» (https://example.com/tre)');
    atteso(0, ['confirm']);
    scriviInWp(`${contenuto()}\n<!-- wp:search {"label":"Cerca"} /-->`);
    atteso(3, [], 'blocco core/search');
    atteso(0, ['confirm']);
  });

  // Una voce che il cliente ha collegato a mano a una pagina (il rimedio naturale a una voce
  // orfana) non torna a «#» e non cambia pagina senza conferma.
  it('(j2) destinazione scelta a mano su una voce del kit: exit 3; da «#» a una pagina resta libero', () => {
    const pagina = sito.wp(['post', 'create', '--post_type=page', '--post_status=publish', '--post_title=I nostri servizi', '--porcelain']).stdout.trim();
    scriviVoci('Contatti', 'Uno', 'Tre', 'Servizi');
    atteso(0, [], 'aggiornato');
    assert.ok(contenuto().includes('"label":"Servizi","url":"#"'), contenuto());
    const url = sito.wp(['eval', `echo get_permalink(${pagina});`]).stdout.trim();
    scriviInWp(contenuto().replace('{"label":"Servizi","url":"#","kind":"custom"}', JSON.stringify({ label: 'Servizi', type: 'page', id: Number(pagina), url, kind: 'post-type' })));
    assert.ok(contenuto().includes(`"id":${pagina}`), contenuto());
    scriviVoci('Contatti', 'Uno', 'Tre', 'Servizi', 'Cinque');
    atteso(3, [], 'WordPress perderebbe: «Servizi»');
    assert.ok(contenuto().includes(`"id":${pagina}`) && !contenuto().includes('Cinque'));
    atteso(0, ['confirm']);
    scriviVoci('Contatti', 'Uno', 'Tre');
    atteso(0, ['confirm']);
  });

  it('(k) menu aperto nell\'editor da un utente: exit 4, nulla scritto; un blocco vecchio non ferma', () => {
    const blocco = (secondi) => assert.equal(sito.wp(['post', 'meta', 'update', id, '_edit_lock', `${Math.floor(Date.now() / 1000) - secondi}:1`]).status, 0);
    scriviVoci('Contatti', 'Uno', 'Tre', 'Quattro');
    blocco(5);
    atteso(4, [], 'aperto da');
    assert.ok(!contenuto().includes('Quattro'), 'apply ha scritto su un menu aperto nell\'editor');
    blocco(3600);
    atteso(0, [], 'aggiornato');
    assert.ok(contenuto().includes('Quattro'));
  });

  it('(l) part senza attributi nel blocco navigation: il ref si scrive lo stesso', () => {
    fs.writeFileSync(path.join(parts, 'header.html'), '<!-- wp:navigation /-->\n');
    atteso(0, [], 'ref → ');
    assert.equal(fs.readFileSync(path.join(parts, 'header.html'), 'utf8'), `<!-- wp:navigation {"ref":${id}} /-->\n`);
  });

  it('(m) part assente, o senza il blocco con quell\'aria-label: exit 1 e nessun menu creato', () => {
    const menu = () => sito.wp(['post', 'list', '--post_type=wp_navigation', '--post_status=any', '--format=count']).stdout.trim();
    const prima = menu();
    fs.writeFileSync(kit, '<nav aria-label="Menu nuovo"><ul><li><a href="#">Uno</a></li></ul></nav>\n');
    let r = nav('plan', `footer=${kit}`);
    fs.writeFileSync(piano, r.stdout);
    r = applica();
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /la part footer\.html non esiste/);
    fs.writeFileSync(path.join(parts, 'footer.html'), '<!-- wp:navigation {"ariaLabel":"A"} /-->\n<!-- wp:navigation {"ariaLabel":"B"} /-->\n');
    r = applica();
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /nessuno con ariaLabel/);
    assert.equal(menu(), prima, 'un menu è stato creato prima dell\'errore');
  });

  it('(n) lista dentro un contenitore (<nav><div><ul>): il piano ha le voci; <nav> senza lista: avviso', () => {
    fs.writeFileSync(kit, '<nav aria-label="Con contenitore"><div><ul><li><a href="#">Uno</a></li></ul></div></nav>\n<nav aria-label="Vuoto"><p>niente</p></nav>\n');
    const r = nav('plan', `header=${kit}`);
    assert.equal(r.status, 0, r.out);
    const menus = JSON.parse(r.stdout).menus;
    assert.deepEqual(menus.map((m) => [m.title, m.items.length]), [['Con contenitore', 1]]);
    assert.match(r.stderr, /Vuoto: il <nav> .* non contiene una lista/);
  });
});
