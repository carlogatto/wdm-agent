// parita.js sul sito di prova, con una copia del tema base attiva: il kit compilato del tema
// e l'HTML servito da WordPress hanno la stessa struttura per header e footer; una differenza di
// struttura messa apposta viene trovata, un testo cambiato no (D4). I casi sono in sequenza.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const sito = require('../lib/sito');
const { assoluto } = require('../lib/citati');

const SCRIPT = assoluto('shared/scripts/parita.js');
const NAV = assoluto('skills/fse-menu-build/scripts/wp-navigation.php');
const TEMA = path.join('wp-content', 'themes', 'wdm-theme');
const BLOCCHI = '<!-- wp:wdm/cta {"variant":"split","title":"Titolo della prova","text":"Testo della prova"} /-->\n\n<!-- wp:wdm/steps {"title":"Passi"} --><!-- wp:wdm/step {"title":"Uno"} /--><!-- wp:wdm/step {"title":"Due"} /--><!-- /wp:wdm/steps -->';

describe('parita.js', { skip: sito.nonDisponibile() || false }, () => {
  let cfg, tmp, html, id;

  const wp = (...args) => {
    const r = sito.wp(args);
    assert.equal(r.status, 0, `wp ${args.join(' ')}\n${r.out}`);
    return r.stdout.trim();
  };
  const parita = (...args) => {
    const r = spawnSync(process.execPath, [SCRIPT, cfg.site, ...args], { encoding: 'utf8' });
    return { status: r.status, out: r.stdout + r.stderr };
  };
  // DESIGN.md del progetto di prova, con le righe di ## Pagine date.
  const design = (...pagine) => fs.writeFileSync(path.join(cfg.site, 'DESIGN.md'), [sito.designMd(cfg),
    '## Telaio', '| Item | Stato | Kit | Note |', '|---|---|---|---|', '| header | implementato | src/kit/main/header | — |', '| footer | implementato | src/kit/main/footer | — |', '',
    '## Pagine', '| Pagina | URL | Stato | Kit | Blocchi (in ordine) |', '|---|---|---|---|---|', ...pagine, ''].join('\n'));
  const scarica = (percorso) => {
    const r = spawnSync(process.execPath, ['-e', 'require("https").get(process.argv[1], { rejectUnauthorized: false }, (r) => { r.pipe(process.stdout); });', `${cfg.url.replace(/\/+$/, '')}${percorso}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout;
  };

  before(() => {
    cfg = sito.prepara();
    sito.copiaBase(cfg.site, (relativo) => relativo.startsWith('wp-content/themes/wdm-theme/'));
    wp('theme', 'activate', 'wdm-theme');
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wdm-agent-parita-'));
    // I quattro menu del tema base, dai kit, come nel setup: senza, i blocchi navigation sono vuoti.
    const kit = (parte) => path.join(cfg.site, TEMA, 'src', 'kit', 'main', parte, `${parte}-parts`, `_${parte}-content.kit`);
    const piano = sito.wp(['eval-file', NAV, 'plan', `header=${kit('header')}`, `footer=${kit('footer')}`]);
    assert.equal(piano.status, 0, piano.out);
    fs.writeFileSync(path.join(tmp, 'nav.json'), piano.stdout);
    wp('eval-file', NAV, 'apply', path.join(tmp, 'nav.json'));
    id = wp('post', 'create', '--post_type=page', '--post_status=publish', '--post_title=Prova', `--post_content=${BLOCCHI}`, '--porcelain');
    html = path.join(cfg.site, TEMA, 'html');
  });

  after(() => {
    sito.reset();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('(a) header e footer del tema base, kit compilato contro WordPress: stessa struttura, nessuna riga', () => {
    design();
    const r = parita();
    assert.equal(r.status, 0, r.out);
    assert.equal(r.out, '');
  });

  it('(b) una pagina costruita: allineata al suo kit', () => {
    // Il kit di un blocco è il suo render: qui il kit compilato della pagina è la pagina resa.
    fs.writeFileSync(path.join(html, 'wdm-prova.html'), scarica(`/?page_id=${id}`));
    design(`| Prova | /?page_id=${id} | implementata | src/kit/wdm-prova.kit | cta, steps |`);
    const r = parita();
    assert.equal(r.status, 0, r.out);
    assert.equal(r.out, '');
  });

  it('(c) un testo cambiato nel kit: non è una differenza', () => {
    const copia = path.join(tmp, 'testo');
    fs.cpSync(html, copia, { recursive: true });
    const file = path.join(copia, 'wdm-prova.html');
    const testo = fs.readFileSync(file, 'utf8');
    assert.ok(testo.includes('Titolo della prova'));
    fs.writeFileSync(file, testo.replaceAll('Titolo della prova', 'Un titolo riscritto').replaceAll('Testo della prova', 'Altro testo'));
    const r = parita('--html', copia);
    assert.equal(r.status, 0, r.out);
    assert.equal(r.out, '');
  });

  it('(d) una differenza di struttura messa apposta: exit 1, con pagina, punto e lato cambiato per ultimo', () => {
    const copia = path.join(tmp, 'struttura');
    fs.cpSync(html, copia, { recursive: true });
    const file = path.join(copia, 'wdm-prova.html');
    const testo = fs.readFileSync(file, 'utf8');
    assert.ok(testo.includes('wdm-block-cta--split'));
    fs.writeFileSync(file, testo.replaceAll('wdm-block-cta--split', 'wdm-block-cta--centered').replace('wdm-footer__bottom', 'wdm-footer__fondo'));
    const r = parita('--html', copia);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /struttura diversa in 2 punti/);
    assert.match(r.out, /footer \(telaio\)\n {2}solo nel sito: .*wdm-footer__bottom/);
    assert.match(r.out, /Prova \(\/\?page_id=\d+\)\n {2}classi diverse: wdm-main › wdm-block-cta — kit \[.*--centered.*\] · sito \[.*--split.*\]/);
    assert.match(r.out, /Per ultimo è cambiato|Non so dire quale lato/);
  });

  it('(e) sito che non risponde, kit non compilato, pagina che non esiste: exit 3 con il motivo, mai un verde', () => {
    let r = parita('--url', 'https://127.0.0.1:1');
    assert.equal(r.status, 3, r.out);
    assert.match(r.out, /Parità non verificata — il sito non risponde .*avvia i server di MAMP PRO/);
    design('| Altra | /?page_id=999999 | implementata | src/kit/wdm-prova.kit | cta |', '| Senza kit | / | implementata | src/kit/wdm-senza.kit | cta |');
    r = parita();
    assert.equal(r.status, 3, r.out);
    assert.match(r.out, /Altra: la pagina \/\?page_id=999999 non esiste in WordPress/);
    assert.match(r.out, /Senza kit: kit non compilato \(manca wdm-senza\.html\)/);
  });

  it('(f) non scrive nulla: tema e DESIGN.md come prima', () => {
    const impronta = () => fs.readdirSync(path.join(cfg.site, TEMA), { recursive: true }).length;
    const prima = [impronta(), fs.statSync(path.join(cfg.site, 'DESIGN.md')).mtimeMs];
    parita();
    assert.deepEqual([impronta(), fs.statSync(path.join(cfg.site, 'DESIGN.md')).mtimeMs], prima);
  });
});
