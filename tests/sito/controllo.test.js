// controllo.js sul sito di prova, con una copia del tema base attiva e il Catalogo costruito
// dal suo kit: uno stato buono passa; i difetti messi apposta hanno ognuno la sua riga FAIL; ciò
// che non è un difetto (una pagina modificata a mano, un kit che aspetta l'ok) è una NOTA; e il
// controllo non scrive in WordPress né dice «buona» quando non ha potuto verificare.
// I casi sono in sequenza.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const sito = require('../lib/sito');
const { assoluto } = require('../lib/citati');

const SCRIPT = assoluto('shared/scripts/controllo.js');
const KIT = assoluto('skills/fse-build/scripts/kit-pagina.js');
const PAGE = assoluto('skills/fse-build/scripts/wp-page.php');
const NAV = assoluto('skills/fse-menu-build/scripts/wp-navigation.php');
const SYNC = assoluto('shared/scripts/sync-theme-json-tokens.js');
const SESSIONE = assoluto('shared/scripts/sessione.js');
const MODELLO = assoluto('shared/playwright/pw-pagina.js');
const TEMA = path.join('wp-content', 'themes', 'wdm-theme');
const SLUG = 'catalogo-blocchi';
const IGNORA = ['/*', '!/.gitignore', '!/DESIGN.md', '!/wp-content/', '/wp-content/*', '!/wp-content/themes/', '/wp-content/themes/*', '!/wp-content/themes/wdm-theme/', 'node_modules', '*.map', ''].join('\n');

describe('controllo.js sul sito', { skip: sito.nonDisponibile() || false }, () => {
  let cfg, tmp, tema, id, menu;
  // Il repository del progetto di prova sta fuori dalla cartella del sito: lì un `.git` direbbe
  // alle prove che è un progetto vero, da non toccare (tests/lib/sito.js).
  let repo = {};

  const wp = (...args) => {
    const r = sito.wp(args);
    assert.equal(r.status, 0, `wp ${args.join(' ')}\n${r.out}`);
    return r.stdout.trim();
  };
  const nodo = (script, ...args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, ...repo } });
  const git = (...args) => {
    const r = spawnSync('git', ['-C', cfg.site, '-c', 'user.name=prova', '-c', 'user.email=prova@example.com', ...args], { encoding: 'utf8', env: { ...process.env, ...repo } });
    assert.equal(r.status, 0, `git ${args.join(' ')}\n${r.stdout}${r.stderr}`);
    return r.stdout;
  };
  const controllo = () => {
    const r = nodo(SCRIPT, cfg.site);
    assert.ifError(r.error);
    return { status: r.status, out: r.stdout + r.stderr, righe: r.stdout.trim().split('\n') };
  };
  const rigaDi = (r, nome) => r.righe.find((x) => x.slice(6).startsWith(`${nome}:`)) || `(nessuna riga «${nome}» in: ${r.out})`;
  const designMd = () => path.join(cfg.site, 'DESIGN.md');
  const file = (...relativo) => path.join(tema, ...relativo);
  const cambia = (percorso, da, a) => {
    const testo = fs.readFileSync(percorso, 'utf8');
    assert.ok(testo.includes(da), `${percorso} non contiene «${da}»`);
    fs.writeFileSync(percorso, testo.replace(da, a));
  };
  const contenutoMenu = () => wp('post', 'get', menu, '--field=post_content');

  before(() => {
    cfg = sito.prepara();
    tema = sito.copiaBase(cfg.site, (relativo) => relativo.startsWith('wp-content/themes/wdm-theme/'));
    sito.collegaModuli(tema);
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wdm-agent-controllo-sito-'));
    repo = { GIT_DIR: path.join(tmp, 'repo.git'), GIT_WORK_TREE: cfg.site };
    fs.writeFileSync(designMd(), [sito.designMd(cfg),
      '## Design Tokens', '',
      '## Telaio', '| Item | Stato | Kit | Note |', '|---|---|---|---|', '| header | implementato | src/kit/main/header | — |', '| footer | implementato | src/kit/main/footer | — |', '',
      '## Pagine', '| Pagina | URL | Stato | Kit | Blocchi (in ordine) |', '|---|---|---|---|---|',
      `| Catalogo blocchi | /${SLUG}/ | implementata | src/kit/wdm-blocks.kit | tutti |`,
      '| Servizi | /servizi/ | da progettare | — | — |', '',
      '## Domande aperte', '- Nessuna.', ''].join('\n'));
    wp('theme', 'activate', 'wdm-theme');
    // Indirizzi «belli», come dopo il setup: il controllo scarica le pagine dal loro percorso.
    wp('option', 'update', 'permalink_structure', '/%postname%/');
    assert.match(wp('eval', 'add_filter( "got_rewrite", "__return_true" ); require_once ABSPATH . "wp-admin/includes/file.php"; require_once ABSPATH . "wp-admin/includes/misc.php"; flush_rewrite_rules( true ); echo file_exists( ABSPATH . ".htaccess" ) ? "htaccess: ok" : "htaccess: manca";'), /htaccess: ok/);
    // Il Catalogo, dal suo kit: kit-pagina.js e wp-page.php, come nella build.
    id = wp('post', 'create', '--post_type=page', '--post_status=publish', '--post_title=Catalogo blocchi', `--post_name=${SLUG}`, '--porcelain');
    const blocchi = path.join(tmp, 'page.html');
    const g = nodo(KIT, cfg.site, 'blocks', blocchi, `page=${SLUG}`);
    assert.equal(g.status, 0, g.stdout + g.stderr);
    assert.equal(sito.wp(['eval-file', PAGE, 'apply', blocchi, `page=${SLUG}`]).status, 5);
    wp('post', 'meta', 'update', id, 'wdm_show_title', '0');
    // I menu del tema base, dai kit, come nel setup (dopo la pagina: la voce del Catalogo trova la sua).
    const kit = (parte) => path.join(tema, 'src', 'kit', 'main', parte, `${parte}-parts`, `_${parte}-content.kit`);
    const piano = sito.wp(['eval-file', NAV, 'plan', `header=${kit('header')}`, `footer=${kit('footer')}`]);
    assert.equal(piano.status, 0, piano.out);
    fs.writeFileSync(path.join(tmp, 'nav.json'), piano.stdout);
    wp('eval-file', NAV, 'apply', path.join(tmp, 'nav.json'));
    menu = wp('post', 'list', '--post_type=wp_navigation', '--field=ID', '--orderby=ID', '--order=ASC').split('\n')[0];
    // I token di DESIGN.md e il CSS globale del kit, come dopo il setup; poi il primo commit.
    const sync = nodo(SYNC, tema);
    assert.equal(sync.status, 0, sync.stdout + sync.stderr);
    fs.writeFileSync(path.join(cfg.site, '.gitignore'), IGNORA);
    git('init', '-q');
    git('add', '.');
    git('commit', '-q', '-m', 'stato di partenza');
  });

  after(() => {
    sito.reset();
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('(a) stato buono: exit 0, ogni riga PASS, al più dodici righe', () => {
    const r = controllo();
    assert.equal(r.status, 0, r.out);
    assert.ok(r.righe.length <= 12, r.out);
    assert.deepEqual(r.righe.slice(0, -1).filter((x) => !x.startsWith('PASS')), [], r.out);
    assert.match(r.righe.at(-1), /^UNITÀ BUONA: 9 controlli passano\.$/);
    assert.match(rigaDi(r, 'Pagine'), /1 uguali al loro kit \(Catalogo blocchi\)/);
    // La build del controllo non ha lasciato file diversi da quelli committati.
    assert.equal(git('status', '--porcelain'), '');
  });

  it('(a2) ciò che aspetta un confirm del dev non è un difetto: NOTA per la pagina e per il menu', () => {
    // Il kit non ha più una sezione che la pagina ha: la cancellazione aspetta il confirm.
    const kit = file('src', 'kit', 'wdm-blocks.kit');
    const sorgente = fs.readFileSync(kit, 'utf8');
    const senzaSteps = sorgente.split('\n').filter((r) => !/@import .*wdm-block-steps\//.test(r)).join('\n');
    assert.notEqual(senzaSteps, sorgente);
    fs.writeFileSync(kit, senzaSteps);
    // Una voce aggiunta a mano nel menu: riallinearlo al kit la toglierebbe, quindi aspetta il confirm.
    const intero = contenutoMenu();
    wp('post', 'update', menu, `--post_content=${intero}\n<!-- wp:navigation-link {"label":"Blog","url":"https://example.com/blog","kind":"custom"} /-->`);
    try {
      const r = controllo();
      assert.match(rigaDi(r, 'Pagine'), /^NOTA.*Catalogo blocchi: una cancellazione aspetta il confirm del dev/);
      assert.match(rigaDi(r, 'Menu'), /^NOTA.*aspetta il confirm del dev: .*Blog/);
    } finally {
      wp('post', 'update', menu, `--post_content=${intero}`);
      git('checkout', '--', '.');
    }
  });

  it('(b) i difetti messi apposta: exit 1, ognuno con la sua riga FAIL; il menu resta com\'era', () => {
    // 1. Il kit cambia dopo la build: la pagina non è più ciò che il kit dice (e il file non è committato).
    cambia(file('blocks', 'wdm-block-cta', 'kit', '_wdm-block-cta-centered.kit'), '</h2>', ' cambiato</h2>');
    // 2. Un blocco perde una sezione del suo contratto (se ne accorge anche la build del tema).
    cambia(file('blocks', 'wdm-block-steps', 'README.md'), '## Scopo', '## Intento');
    // 3. Una riga nel debug.log.
    fs.appendFileSync(path.join(cfg.site, 'wp-content', 'debug.log'), '[20-Nov-2026 12:00:00 UTC] PHP Warning:  prova\n');
    // 4. Una build rimasta a metà.
    cambia(designMd(), '- Nessuna.', '- ⏳ build sito: pagina Catalogo blocchi 1/1 (dal 2026-11-20)');
    // 5. Una sessione dell'utente agente lasciata aperta.
    const apri = nodo(SESSIONE, 'apri', cfg.site, MODELLO, `id=${id}`);
    assert.equal(apri.status, 0, apri.stdout + apri.stderr);
    // 6. Un menu a cui manca una voce del kit.
    const intero = contenutoMenu();
    const senza = intero.replace(/<!-- wp:navigation-link [^>]*\/-->\n?/, '');
    assert.notEqual(senza, intero);
    wp('post', 'update', menu, `--post_content=${senza}`);
    const monco = contenutoMenu();

    const r = controllo();
    assert.equal(r.status, 1, r.out);
    assert.match(rigaDi(r, 'Tema'), /^FAIL.*build exit 1/);
    assert.match(rigaDi(r, 'Pagine'), /^FAIL.*Catalogo blocchi diversa dal kit: .*1 modificato/);
    assert.match(rigaDi(r, 'Blocchi'), /^FAIL.*wdm-block-steps: README senza Scopo/);
    assert.match(rigaDi(r, 'Sito'), /^FAIL.*debug\.log non è vuoto/);
    assert.match(rigaDi(r, 'Stato'), /^FAIL.*una build è rimasta a metà/);
    assert.match(rigaDi(r, 'Sessione'), /^FAIL.*1 sessioni dell'utente agente aperte/);
    assert.match(rigaDi(r, 'Menu'), /^FAIL.*diverso dal kit/);
    assert.match(rigaDi(r, 'Git'), /^FAIL.*file non committati/);
    assert.match(r.righe.at(-1), /^UNITÀ NON BUONA: 8 controlli non passano \(Tema, Pagine, Sito, Blocchi, Menu, Sessione, Stato, Git\)\.$/);
    assert.equal(contenutoMenu(), monco, 'il controllo ha scritto nel menu');
    // Si rimette tutto a posto: il caso seguente parte dallo stato buono.
    wp('post', 'update', menu, `--post_content=${intero}`);
    assert.equal(nodo(SESSIONE, 'chiudi', cfg.site).status, 0);
    fs.writeFileSync(path.join(cfg.site, 'wp-content', 'debug.log'), '');
    git('checkout', '--', '.');
  });

  it('(c) ciò che non è un difetto: pagina modificata a mano e kit in revisione sono NOTA, exit 0', () => {
    // Il cliente cambia un testo nell'editor: i contenuti restano suoi.
    const contenuto = wp('post', 'get', id, '--field=post_content');
    const modificato = contenuto.replace(/"title":"/, '"title":"Scritto a mano: ');
    assert.notEqual(modificato, contenuto);
    wp('post', 'update', id, `--post_content=${modificato}`);
    // Un kit aspetta l'ok: la sua riga ⏳, la pagina ancora da progettare, i file non committati.
    cambia(designMd(), '- Nessuna.', '- ⏳ kit Servizi in revisione (dal 2026-11-20)');
    cambia(designMd(), '| Servizi | /servizi/ | da progettare | — | — |', '| Servizi | /servizi/ | da progettare | src/kit/wdm-servizi.kit | cta |');
    fs.writeFileSync(file('src', 'kit', 'wdm-servizi.kit'), fs.readFileSync(file('src', 'kit', 'wdm-blocks.kit'), 'utf8'));

    const r = controllo();
    assert.equal(r.status, 0, r.out);
    assert.match(rigaDi(r, 'Pagine'), /^NOTA.*Catalogo blocchi: modificata a mano in WordPress/);
    assert.match(rigaDi(r, 'Kit in revisione'), /^PASS.*Servizi: mappabile dalla build/);
    assert.match(rigaDi(r, 'Stato'), /^PASS.*gate aperto: kit Servizi/);
    assert.match(rigaDi(r, 'Git'), /^NOTA.*file non committati: è atteso/);
    assert.match(r.righe.at(-1), /^UNITÀ BUONA: 8 controlli passano, 2 note\.$/);
  });

  it('(d) un kit in revisione che la build non saprebbe mappare: FAIL', () => {
    cambia(file('src', 'kit', 'wdm-servizi.kit'), '<main class="wdm-main">', '<main class="wdm-main">\n<div class="wdm-ignoto">testo fuori da un blocco</div>');
    const r = controllo();
    assert.equal(r.status, 1, r.out);
    assert.match(rigaDi(r, 'Kit in revisione'), /^FAIL.*Servizi: .*non mappabile/);
  });

  it('(e) non ha potuto verificare: exit 3, mai 0 (WordPress che non risponde; DESIGN.md senza pagine)', () => {
    const originale = fs.readFileSync(designMd(), 'utf8');
    try {
      fs.writeFileSync(designMd(), originale.replace(/^\| `\{wp-cli\}` \|.*$/m, () => `| \`{wp-cli}\` | ${path.join(tmp, 'php-che-non-esiste')} wp-cli.phar |`));
      let r = controllo();
      assert.equal(r.status, 3, r.out);
      assert.match(r.out, /non verificato — WordPress non risponde/);
      fs.writeFileSync(designMd(), originale.slice(0, originale.indexOf('## Pagine')));
      r = controllo();
      assert.equal(r.status, 3, r.out);
      assert.match(r.out, /non verificato — .*## Pagine non ha righe/);
    } finally {
      fs.writeFileSync(designMd(), originale);
    }
  });
});
