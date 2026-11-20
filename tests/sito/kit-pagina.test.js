// kit-pagina.js sul sito di prova, con una copia del tema base attiva: dal kit compilato del
// Catalogo al file di blocchi, poi wp-page.php lo confronta e lo scrive. Nessun file di blocchi
// scritto a mano: è il passo 2a/2d di fse-build. I casi sono in sequenza.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const sito = require('../lib/sito');
const { assoluto } = require('../lib/citati');

const SCRIPT = assoluto('skills/fse-build/scripts/kit-pagina.js');
const PAGE = assoluto('skills/fse-build/scripts/wp-page.php');
const TEMA = path.join('wp-content', 'themes', 'wdm-theme');
const SLUG = 'catalogo-blocchi';

describe('kit-pagina.js sul sito', { skip: sito.nonDisponibile() || false }, () => {
  let cfg, tmp, file, id;

  const wp = (...args) => {
    const r = sito.wp(args);
    assert.equal(r.status, 0, `wp ${args.join(' ')}\n${r.out}`);
    return r.stdout.trim();
  };
  const kit = (...args) => {
    const r = spawnSync(process.execPath, [SCRIPT, cfg.site, ...args], { encoding: 'utf8' });
    assert.ifError(r.error);
    return { status: r.status, out: r.stdout + r.stderr };
  };
  const page = (modo) => sito.wp(['eval-file', PAGE, modo, file, `page=${SLUG}`]);
  const allegati = () => wp('post', 'list', '--post_type=attachment', '--field=post_name').split('\n').filter(Boolean).sort();

  before(() => {
    cfg = sito.prepara();
    sito.copiaBase(cfg.site, (relativo) => relativo.startsWith('wp-content/themes/wdm-theme/'));
    fs.writeFileSync(path.join(cfg.site, 'DESIGN.md'), sito.designMd(cfg));
    wp('theme', 'activate', 'wdm-theme');
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wdm-agent-kit-pagina-'));
    file = path.join(tmp, `page-${SLUG}.html`);
  });

  after(() => {
    sito.reset();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('(a) pagina non mappabile: exit 3, nessun file e nessuna immagine importata', () => {
    const html = path.join(cfg.site, TEMA, 'html');
    const catalogo = fs.readFileSync(path.join(html, 'wdm-blocks.html'), 'utf8');
    assert.ok(catalogo.includes('<div class="wdm-block-cta__content">'));
    fs.writeFileSync(path.join(html, 'wdm-rotta.html'), catalogo.replace('<div class="wdm-block-cta__content">', '<div class="wdm-block-cta__content"><p class="wdm-block-cta__ignoto">x</p>'));
    const r = kit('rotta', file);
    assert.equal(r.status, 3, r.out);
    assert.match(r.out, /wdm-block-cta__ignoto/);
    assert.equal(fs.existsSync(file), false);
    assert.deepEqual(allegati(), []);
  });

  it('(a2) sola-lettura: le immagini che mancano non si importano, exit 3 e nessun file', () => {
    const r = kit('blocks', file, 'sola-lettura');
    assert.equal(r.status, 3, r.out);
    assert.match(r.out, /in sola lettura non importo le immagini.*placeholder-2000x1150\.jpg/);
    assert.equal(fs.existsSync(file), false);
    assert.deepEqual(allegati(), []);
    assert.equal(kit('blocks', 'controlla', 'sola-lettura').status, 2, 'con controlla non ha senso: uso');
  });

  it('(b) il Catalogo del tema base: file scritto, immagini importate, form e card dichiarati', () => {
    const r = kit('blocks', file);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /wdm-blocks: 15 blocchi/);
    assert.match(r.out, /wdm_show_title 0/);
    assert.match(r.out, /wdm_show_form 1/);
    assert.match(r.out, /immagini importate.*placeholder-2000x1150\.jpg/);
    assert.match(r.out, /form «contatti».*Formidable/);
    assert.deepEqual(allegati(), ['placeholder-2000x1150', 'placeholder-700x450']);
    const testo = fs.readFileSync(file, 'utf8');
    assert.equal(testo.split('\n\n').length, 15, 'blocchi di primo livello nel file');
    assert.ok(testo.includes('<!-- wp:wdm/cards-carousel {"source":"query","title":"Dal blog"} /-->'), testo.slice(0, 3000));
    assert.match(testo, new RegExp(`"imageUrl":"${cfg.url.replace(/\/+$/, '')}/wp-content/uploads/`));
    // Le tre card «da un post» del catalogo: su un sito nuovo, l'articolo più recente.
    const ultimo = wp('post', 'list', '--post_type=post', '--post_status=publish', '--field=ID', '--posts_per_page=1');
    assert.equal((testo.match(new RegExp(`<!-- wp:wdm/card \\{"postId":${ultimo}\\} /-->`, 'g')) || []).length, 3, testo.slice(0, 3000));
  });

  it('(c) wp-page.php lo accetta: 15 nuovi, scritto, poi 0 differenze; la pagina risponde senza avvisi', () => {
    id = wp('post', 'create', '--post_type=page', '--post_status=publish', '--post_title=Catalogo blocchi', `--post_name=${SLUG}`, '--porcelain');
    const piano = page('plan');
    assert.equal(piano.status, 5, piano.out);
    assert.match(piano.out, /0 uguale · 0 modificato · 15 nuovo · 0 spostato · 0 da cancellare/);
    assert.equal(page('apply').status, 5);
    const dopo = page('plan');
    assert.equal(dopo.status, 0, dopo.out);
    assert.match(dopo.out, /15 uguale/);
    const r = spawnSync(process.execPath, ['-e', 'require("https").get(process.argv[1], { rejectUnauthorized: false }, (r) => { r.pipe(process.stdout); });', `${cfg.url.replace(/\/+$/, '')}/?page_id=${id}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    assert.equal(r.status, 0, r.stderr);
    assert.doesNotMatch(r.stdout, /Fatal error|Warning:|Notice:|Deprecated:/);
    // Le quindici sezioni del kit, nel suo ordine; l'ultima in più è il form di default del template.
    const sezioni = (r.stdout.match(/<section[^>]*\bwdm-block-[a-z-]+[ "]/g) || []).map((s) => /wdm-block-([a-z-]+)[ "]/.exec(s)[1]);
    assert.deepEqual(sezioni, ['hero', 'columns-wrapper', 'image-text', 'image-text', 'cards-carousel', 'hero', 'cards-carousel', 'cta', 'cta', 'form', 'form', 'features', 'features', 'features', 'steps', 'form']);
  });

  it('(d) rilanciato con la pagina costruita: stesso file, byte per byte, e nessuna immagine in più', () => {
    const prima = fs.readFileSync(file, 'utf8');
    const r = kit('blocks', file, `page=${SLUG}`);
    assert.equal(r.status, 0, r.out);
    assert.doesNotMatch(r.out, /immagini importate/);
    // Con le immagini già in libreria, in sola lettura esce lo stesso file.
    const copia = `${file}.sola-lettura`;
    assert.equal(kit('blocks', copia, `page=${SLUG}`, 'sola-lettura').status, 0);
    assert.equal(fs.readFileSync(copia, 'utf8'), fs.readFileSync(file, 'utf8'));
    assert.equal(fs.readFileSync(file, 'utf8'), prima);
    assert.deepEqual(allegati(), ['placeholder-2000x1150', 'placeholder-700x450']);
  });

  it('(e) una card segnaposto tiene il post che la pagina ha già in quella posizione', () => {
    const altro = wp('post', 'create', '--post_type=post', '--post_status=publish', '--post_title=Più recente', '--porcelain');
    const prima = fs.readFileSync(file, 'utf8');
    assert.equal(kit('blocks', file, `page=${SLUG}`).status, 0);
    assert.equal(fs.readFileSync(file, 'utf8'), prima, 'con page= le card restano sul post che hanno');
    assert.equal(kit('blocks', file).status, 0);
    assert.ok(fs.readFileSync(file, 'utf8').includes(`<!-- wp:wdm/card {"postId":${altro}} /-->`), 'senza page= prendono il più recente');
  });

  it('(e2) un\'immagine con lo stesso nome e un\'altra estensione non è lo stesso allegato: si importa la sua', () => {
    const tema = path.join(cfg.site, TEMA);
    // Un PNG vero di un pixel: WordPress controlla il contenuto del file.
    fs.writeFileSync(path.join(tema, 'assets', 'img', 'placeholder-700x450.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'));
    const catalogo = fs.readFileSync(path.join(tema, 'html', 'wdm-blocks.html'), 'utf8');
    const conPng = catalogo.replace('<img class="wdm-block-image-text__img" src="../assets/img/placeholder-700x450.jpg"', '<img class="wdm-block-image-text__img" src="../assets/img/placeholder-700x450.png"');
    assert.notEqual(conPng, catalogo);
    fs.writeFileSync(path.join(tema, 'html', 'wdm-png.html'), conPng);
    const altro = path.join(tmp, 'page-png.html');
    const r = kit('png', altro);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /immagini importate.*placeholder-700x450\.png/);
    const testo = fs.readFileSync(altro, 'utf8');
    assert.match(testo, /"imageUrl":"[^"]*placeholder-700x450[^"]*\.png"/);
    assert.match(testo, /"imageUrl":"[^"]*placeholder-700x450[^"]*\.jpg"/);
    // Rilanciato: la ritrova, non la importa un'altra volta.
    assert.doesNotMatch(kit('png', altro).out, /immagini importate/);
    assert.equal(fs.readFileSync(altro, 'utf8'), testo);
  });

  it('(f) WordPress che non risponde: exit 2 con cosa fare, il file resta com\'era', () => {
    const design = path.join(cfg.site, 'DESIGN.md');
    const buono = fs.readFileSync(design, 'utf8');
    const prima = fs.readFileSync(file, 'utf8');
    try {
      fs.writeFileSync(design, buono.replace(/\| `\{wp-cli\}` \| \S+/, '| `{wp-cli}` | /percorso/che/non/esiste/php'));
      const r = kit('blocks', file);
      assert.equal(r.status, 2, r.out);
      assert.match(r.out, /avvia i server di MAMP PRO/);
      assert.equal(fs.readFileSync(file, 'utf8'), prima);
    } finally {
      fs.writeFileSync(design, buono);
    }
  });
});
