// Il setup di un progetto nuovo, su una copia del tema base (E1): la rinomina con un titolo con
// l'apostrofo in una cartella con spazi (U03, U04, U51), la ripresa dopo un'interruzione, e la
// catena dall'inizio alla fine sul sito di prova, con i passi di fse-theme-setup/SKILL.md nello
// stesso ordine (U06, U13, U42). Il tema base si legge soltanto.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const https = require('node:https');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const sito = require('../lib/sito');
const { RADICE, assoluto } = require('../lib/citati');
const { valore, imposta, argomenti } = require(path.join(RADICE, 'shared', 'scripts', 'lib', 'design-md.js'));

const SETUP = assoluto('skills/fse-theme-setup/scripts/setup.js');
const MAMP = assoluto('skills/fse-theme-setup/scripts/mamp.js');
const SESSIONE = path.join(RADICE, 'shared', 'scripts', 'sessione.js');
const PARITA = path.join(RADICE, 'shared', 'scripts', 'parita.js');
const SYNC = assoluto('shared/scripts/sync-theme-json-tokens.js');
const NAV = assoluto('skills/fse-menu-build/scripts/wp-navigation.php');
const PROTETTI = ['carlogatto/wdm-theme', 'wdm-agent', 'wdm-starter'];
const VALORI = { prefix: 'atl', slug: 'atelier', textdomain: 'atelier', title: "L'Atelier" };

function lancia(comando, args, opzioni = {}) {
  const r = spawnSync(comando, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opzioni, env: { ...process.env, ...(opzioni.env || {}) } });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '', out: `${r.stdout || ''}${r.stderr || ''}${r.error ? r.error.message : ''}` };
}

function setup(target, url, opzioni) {
  return lancia(process.execPath, [SETUP, '--prefix', VALORI.prefix, '--slug', VALORI.slug, '--textdomain', VALORI.textdomain,
    '--title', VALORI.title, '--local-url', url, '--target', target], opzioni);
}

// Ciò che la skill scrive in DESIGN.md → Project Config prima di lanciare gli script.
function scriviProjectConfig(sitoRoot, url) {
  const file = path.join(sitoRoot, 'DESIGN.md');
  let testo = fs.readFileSync(file, 'utf8');
  const righe = {
    '{prefix}': VALORI.prefix, '{site-folder}': path.basename(sitoRoot), '{theme-folder}': VALORI.slug, '{text-domain}': VALORI.textdomain,
    '{category-title}': VALORI.title, '{local-url}': url, '{agent-admin-user}': `${VALORI.prefix}adminclaude`,
    '{site-root}': sitoRoot, '{theme-root}': path.join(sitoRoot, 'wp-content', 'themes', VALORI.slug),
  };
  for (const [nome, v] of Object.entries(righe)) testo = imposta(testo, nome, v);
  fs.writeFileSync(file, testo);
}

function tuttiIFile(cartella) {
  return fs.readdirSync(cartella, { withFileTypes: true }).flatMap((voce) => {
    if (['node_modules', '.git'].includes(voce.name)) return [];
    const p = path.join(cartella, voce.name);
    return voce.isDirectory() ? tuttiIFile(p) : [p];
  });
}

// «file:riga» per ogni riferimento a wdm rimasto, nei nomi e nei testi, tolti i nomi protetti.
function residui(elenco, radice) {
  const pulita = (t) => PROTETTI.reduce((testo, nome) => testo.split(nome).join(''), t);
  return elenco.flatMap((f) => {
    const relativo = path.relative(radice, f);
    const dati = fs.readFileSync(f);
    const nelNome = /wdm/i.test(pulita(relativo)) ? [relativo] : [];
    if (dati.subarray(0, 8000).includes(0)) return nelNome;
    return nelNome.concat(dati.toString('utf8').split('\n').flatMap((riga, i) => (/wdm/i.test(pulita(riga)) ? [`${relativo}:${i + 1}`] : [])));
  });
}

// Impronta di un albero: percorso relativo → sha1 del contenuto.
function impronta(cartella) {
  return Object.fromEntries(tuttiIFile(cartella).sort().map((f) => [path.relative(cartella, f), crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex')]));
}

// Una cartella personale finta: il registro dei plugin di Claude Code punta a questo checkout,
// così `npm run check` usa il sync di questa versione e non quello installato.
function casaFinta(dentro) {
  const casa = fs.mkdtempSync(path.join(dentro, 'casa-'));
  fs.mkdirSync(path.join(casa, '.claude', 'plugins'), { recursive: true });
  fs.writeFileSync(path.join(casa, '.claude', 'plugins', 'installed_plugins.json'), JSON.stringify({ version: 2, plugins: { 'wdm-agent@wdm-agent': [{ installPath: RADICE }] } }));
  return casa;
}

function scarica(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    client.get(url, { rejectUnauthorized: false }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (d) => { body += d; });
      res.on('end', () => resolve({ status: res.statusCode, body, location: res.headers.location }));
    }).on('error', reject);
  });
}

// Le asserzioni sul tema rinominato, uguali per la copia senza WordPress e per il sito di prova.
function controllaRinomina(sitoRoot, url, php) {
  const tema = path.join(sitoRoot, 'wp-content', 'themes', VALORI.slug);
  const leggi = (...relativo) => fs.readFileSync(path.join(tema, ...relativo), 'utf8');
  assert.ok(fs.existsSync(tema) && !fs.existsSync(path.join(sitoRoot, 'wp-content', 'themes', 'wdm-theme')), 'cartella del tema non rinominata');
  // I CSS compilati del tema base non restano: li ricrea la build con i nomi nuovi (kit.css compreso).
  // (vale finché la build non è girata: dopo, html/ ha di nuovo i kit compilati)
  const compilati = fs.existsSync(path.join(tema, 'html')) ? fs.readdirSync(path.join(tema, 'html')).filter((f) => f.endsWith('.html')) : [];
  if (compilati.length === 0) {
    for (const css of ['main.css', 'fonts.css', 'swiper.css', 'kit.css']) assert.ok(!fs.existsSync(path.join(tema, 'assets', 'css', css)), `assets/css/${css} del tema base è rimasto`);
  }

  const delSito = ['README.md', '.gitignore'].map((f) => path.join(sitoRoot, f));
  assert.deepEqual(residui([...tuttiIFile(tema), ...delSito], sitoRoot), []);
  assert.ok(leggi('README.md').includes('carlogatto/wdm-agent'), 'il nome del plugin è stato rinominato nel README del tema');
  assert.ok(fs.readFileSync(delSito[0], 'utf8').includes('github.com/carlogatto/wdm-agent#prerequisiti'), 'il nome del plugin è stato rinominato nel README del sito');
  assert.ok(fs.readFileSync(delSito[0], 'utf8').includes('github.com/carlogatto/wdm-theme'));
  assert.ok(fs.readFileSync(delSito[1], 'utf8').includes(`!wp-content/themes/${VALORI.slug}/`));

  // Titolo con l'apostrofo: PHP e JSON restano validi (U04).
  assert.ok(leggi('style.css').includes(`Theme Name: ${VALORI.title}`));
  assert.ok(leggi('blocks', 'blocks.php').includes("'title' => 'L\\'Atelier'"), 'titolo non protetto nella stringa PHP');
  const file = tuttiIFile(tema);
  for (const f of file.filter((f) => f.endsWith('.php'))) {
    const r = lancia(php, ['-l', f]);
    assert.equal(r.status, 0, `${path.relative(tema, f)}: ${r.out}`);
  }
  for (const f of file.filter((f) => f.endsWith('.json'))) {
    assert.doesNotThrow(() => JSON.parse(fs.readFileSync(f, 'utf8')), path.relative(tema, f));
  }

  // Kit dimostrativi tolti, catalogo e telaio tenuti (U51).
  assert.deepEqual(fs.readdirSync(path.join(tema, 'src', 'kit')).filter((f) => f.endsWith('.kit')).sort(), ['atl-blocks.kit', 'atl-telaio.kit']);
  // Niente ID del database del tema base nelle parts (U06).
  assert.match(leggi('parts', 'form-contacts.html'), /"formId":0[,}]/);
  for (const part of ['header.html', 'footer.html']) assert.doesNotMatch(leggi('parts', part), /"ref":/);
  assert.ok(leggi('build.js').includes(`proxy: '${url}'`));
  assert.ok(fs.existsSync(path.join(tema, 'blocks', 'atl-block-hero', 'block.json')));
  assert.equal(JSON.parse(leggi('blocks', 'atl-block-hero', 'block.json')).name, 'atl/hero');
}

describe('setup di un progetto nuovo dal tema base', { skip: sito.nonDisponibile() || false }, () => {
  let cfg, tmp;

  const copia = (nome) => {
    const dir = path.join(tmp, 'Mario Rossi', nome);
    sito.copiaBase(dir, (relativo) => !relativo.startsWith('docs/'));
    return dir;
  };
  const temaDi = (dir) => path.join(dir, 'wp-content', 'themes', VALORI.slug);

  before(() => {
    cfg = sito.leggiConfig();
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wdm-agent-setup-'));
  });

  after(() => {
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  });

  describe('rinomina in una cartella con spazi, senza WordPress', () => {
    const URL = 'https://atelier.invalid:8890/';
    let dir, albero;

    before(() => {
      dir = copia('sito');
      scriviProjectConfig(dir, URL);
    });

    it('--target relativo: exit 0, e il tema è rinominato per intero', () => {
      const r = setup('sito', URL, { cwd: path.dirname(dir) });
      assert.equal(r.status, 0, r.out);
      assert.match(r.stdout, /Rinomina completata/);
      controllaRinomina(dir, URL, cfg.php);
      albero = impronta(temaDi(dir));
    });

    it('secondo lancio: nessun errore «già eseguito», rifà il controllo ed esce con 0', () => {
      const r = setup(dir, URL);
      assert.equal(r.status, 0, r.out);
      assert.match(r.stdout, /già stato rinominato/);
      assert.deepEqual(impronta(temaDi(dir)), albero);
    });

    it('un riferimento a wdm rimasto: exit 1, con file, riga e cosa fare', () => {
      const file = path.join(temaDi(dir), 'README.md');
      const originale = fs.readFileSync(file, 'utf8');
      fs.writeFileSync(file, `${originale}\nUn residuo: wdm-qualcosa.\n`);
      try {
        const r = setup(dir, URL);
        assert.equal(r.status, 1, r.out);
        assert.match(r.stderr, /README\.md:\d+: Un residuo/);
        assert.match(r.stderr, /rilancia lo stesso comando/);
      } finally {
        fs.writeFileSync(file, originale);
      }
    });

    it('interruzione a metà e rilancio: stesso risultato di un lancio senza interruzioni', () => {
      const altra = copia('interrotto');
      scriviProjectConfig(altra, URL);
      const ostacolo = path.join(altra, 'wp-content', 'themes', 'wdm-theme', 'theme.json');
      fs.chmodSync(ostacolo, 0o000);
      const primo = setup(altra, URL);
      fs.chmodSync(ostacolo, 0o644);
      assert.equal(primo.status, 1, primo.out);
      assert.match(primo.stderr, /Il setup si è interrotto/);
      assert.match(primo.stderr, /rilancia lo stesso comando/);
      assert.doesNotMatch(primo.stderr, /\bat .*\.js:\d+/);
      // Fermo a metà davvero: una parte dei file è già riscritta, la cartella no.
      const base = path.join(altra, 'wp-content', 'themes', 'wdm-theme');
      assert.ok(fs.existsSync(base), 'la cartella del tema è stata rinominata prima della fine');
      assert.ok(fs.readFileSync(path.join(base, 'style.css'), 'utf8').includes(VALORI.title), 'nessun file riscritto prima dell\'interruzione');
      assert.ok(fs.readFileSync(ostacolo, 'utf8').includes('wdm/'), 'il file dopo l\'ostacolo è già stato riscritto');

      const secondo = setup(altra, URL);
      assert.equal(secondo.status, 0, secondo.out);
      assert.deepEqual(impronta(temaDi(altra)), albero);
    });

    it('interruzione mentre rinomina file e cartelle: il rilancio dà lo stesso risultato', () => {
      const altra = copia('interrotto sui nomi');
      scriviProjectConfig(altra, URL);
      // Una cartella in sola lettura: i file dentro si riscrivono, ma non si possono rinominare.
      const ostacolo = path.join(altra, 'wp-content', 'themes', 'wdm-theme', 'patterns');
      fs.chmodSync(ostacolo, 0o555);
      const primo = setup(altra, URL);
      fs.chmodSync(ostacolo, 0o755);
      assert.equal(primo.status, 1, primo.out);
      assert.match(primo.stderr, /rilancia lo stesso comando/);
      const base = path.join(altra, 'wp-content', 'themes', 'wdm-theme');
      assert.ok(fs.existsSync(path.join(base, 'blocks', 'atl-block-hero')), 'nessuna cartella rinominata prima dell\'interruzione');
      assert.ok(fs.existsSync(path.join(base, 'patterns', 'wdm-cta.php')), 'il file dentro l\'ostacolo è già stato rinominato');
      const secondo = setup(altra, URL);
      assert.equal(secondo.status, 0, secondo.out);
      assert.deepEqual(impronta(temaDi(altra)), albero);
    });

    it('cartella del sito con «wdm» nel percorso: Project Config resta com\'è e {wp-cli} funziona ancora', () => {
      const altra = path.join(tmp, 'corso-wdm', 'pinco');
      sito.copiaBase(altra, (relativo) => !relativo.startsWith('docs/'));
      scriviProjectConfig(altra, URL);
      fs.copyFileSync(cfg.phar, path.join(altra, 'wp-cli.phar'));
      assert.equal(lancia(process.execPath, [MAMP, '--site', altra]).status, 0);
      const config = () => /^## Project Config[\s\S]*?(?=^## )/m.exec(fs.readFileSync(path.join(altra, 'DESIGN.md'), 'utf8'))[0];
      const prima = config();
      const r = setup(altra, URL);
      assert.equal(r.status, 0, r.out);
      assert.equal(config(), prima);
      const design = fs.readFileSync(path.join(altra, 'DESIGN.md'), 'utf8');
      assert.equal(valore(design, '{site-root}'), altra);
      const [php, ...resto] = argomenti(valore(design, '{wp-cli}'));
      const versione = lancia(php, [...resto, '--version']);
      assert.equal(versione.status, 0, versione.out);
      // Il resto di DESIGN.md si rinomina come prima.
      assert.match(design, /^# Design: atelier$/m);
    });

    it('un\'impronta di package-lock.json che contiene «wDm» per caso: non è un residuo e non si tocca', () => {
      const altra = copia('lock');
      scriviProjectConfig(altra, URL);
      const lock = path.join(altra, 'wp-content', 'themes', 'wdm-theme', 'package-lock.json');
      const righe = fs.readFileSync(lock, 'utf8').split('\n');
      const i = righe.findIndex((riga) => riga.includes('"integrity": "sha512-'));
      righe[i] = righe[i].replace('"sha512-', '"sha512-wDmwdm');
      fs.writeFileSync(lock, righe.join('\n'));
      const r = setup(altra, URL);
      assert.equal(r.status, 0, r.out);
      const dopo = fs.readFileSync(path.join(temaDi(altra), 'package-lock.json'), 'utf8');
      assert.equal(dopo.split('\n')[i], righe[i]);
      assert.equal(JSON.parse(dopo).name, VALORI.textdomain);
    });

    it('la catena senza WordPress: mamp.js, build e controlli a 0, frontend saltato e dichiarato', () => {
      fs.copyFileSync(cfg.phar, path.join(dir, 'wp-cli.phar'));
      const mamp = lancia(process.execPath, [MAMP, '--site', dir]);
      assert.equal(mamp.status, 0, mamp.out);
      const [php, ...resto] = argomenti(valore(fs.readFileSync(path.join(dir, 'DESIGN.md'), 'utf8'), '{wp-cli}'));
      assert.equal(lancia(php, [...resto, '--version']).status, 0);

      sito.collegaModuli(temaDi(dir));
      const build = lancia('npm', ['run', 'build'], { cwd: temaDi(dir) });
      assert.equal(build.status, 0, build.out.slice(-3000));
      const check = lancia('npm', ['run', 'check'], { cwd: temaDi(dir), env: { HOME: casaFinta(tmp) } });
      assert.equal(check.status, 0, check.out.slice(-3000));
      assert.match(check.out, /SKIP.*non raggiungibile/);
      assert.match(check.out, /PASS check-design-tokens/);
      assert.deepEqual(residui(tuttiIFile(temaDi(dir)), dir), [], 'la build ha rimesso un riferimento a wdm');
    });
  });

  describe('dall\'inizio alla fine sul sito di prova', () => {
    let url, tema, wp, casa, dbHost;

    before(() => {
      sito.reset();
      url = `${cfg.url.replace(/\/+$/, '')}/`;
      tema = temaDi(cfg.site);
      casa = casaFinta(tmp);
      // Il clone del tema base nella cartella dell'host, poi Project Config (Step 0 della skill).
      sito.copiaBase(cfg.site);
      scriviProjectConfig(cfg.site, url);
      fs.copyFileSync(cfg.phar, path.join(cfg.site, 'wp-cli.phar'));
    });

    after(() => sito.reset());

    it('Step 1: mamp.js trova PHP, usa il database vuoto e scrive {wp-cli}', () => {
      const r = lancia(process.execPath, [MAMP, '--site', cfg.site, '--db', cfg.db]);
      assert.equal(r.status, 0, r.out);
      assert.equal(JSON.parse(r.stdout).database.stato, 'vuoto');
      dbHost = JSON.parse(r.stdout).dbHost;
      // Da qui in poi WP-CLI è la riga scritta in DESIGN.md, come nelle skill.
      const [php, ...resto] = argomenti(valore(fs.readFileSync(path.join(cfg.site, 'DESIGN.md'), 'utf8'), '{wp-cli}'));
      wp = (...args) => lancia(php, [...resto, ...args.flat()]);
    });

    it('Step 2: WordPress scaricato, configurato e installato con quella riga', () => {
      const scarico = wp('core', 'download', '--version=7.1.3', '--locale=it_IT', '--skip-content', '--quiet');
      assert.equal(scarico.status, 0, scarico.out);
      const php = "define( 'WP_DEBUG', true );\ndefine( 'WP_DEBUG_DISPLAY', false );\ndefine( 'WP_DEBUG_LOG', true );\ndefine( 'WP_DEVELOPMENT_MODE', 'theme' );\n";
      const [eseguibile, ...resto] = argomenti(valore(fs.readFileSync(path.join(cfg.site, 'DESIGN.md'), 'utf8'), '{wp-cli}'));
      const config = lancia(eseguibile, [...resto, 'config', 'create', `--dbname=${cfg.db}`, '--dbuser=root', '--dbpass=root', `--dbhost=${dbHost}`,
        '--dbcharset=utf8mb4', `--dbprefix=${VALORI.prefix}_`, '--extra-php', '--quiet'], { input: php });
      assert.equal(config.status, 0, config.out);
      // Come nella skill (Step 2c): nessuna password scelta né salvata. Quella del dev la genera
      // WP-CLI e la stampa una volta; l'utente agente ne riceve una che nessuno vede.
      const installa = wp('core', 'install', `--url=${url}`, `--title=${VALORI.title}`, '--admin_user=testadmin', '--admin_email=admin@example.com', '--skip-email');
      assert.equal(installa.status, 0, installa.out);
      assert.match(installa.stdout, /^Admin password: \S+$/m);
      const agente = wp('user', 'create', `${VALORI.prefix}adminclaude`, `${VALORI.prefix}adminclaude@${VALORI.slug}.local`, '--role=administrator', '--porcelain');
      assert.equal(agente.status, 0, agente.out);
      assert.match(agente.out.trim(), /^[0-9]+$/, 'la creazione dell\'utente agente ha stampato altro oltre all\'ID');
      assert.ok(!fs.existsSync(path.join(cfg.site, '.env')), 'il setup non crea più .env');
      // Come nella skill: WP-CLI può aggiungere il percorso della cartella all'indirizzo.
      for (const opzione of ['siteurl', 'home']) assert.equal(wp('option', 'update', opzione, url.replace(/\/$/, '')).status, 0);
      assert.equal(wp('core', 'version').stdout.trim(), '7.1.3');
    });

    it('Step 3a: setup.js rinomina il tema (titolo con l\'apostrofo)', () => {
      const r = setup(cfg.site, url);
      assert.equal(r.status, 0, r.out);
      controllaRinomina(cfg.site, url, cfg.php);
    });

    it('Step 3b: npm install e npm run build a 0', () => {
      const ci = lancia('npm', ['install', '--no-audit', '--no-fund', '--prefer-offline'], { cwd: tema });
      assert.equal(ci.status, 0, ci.out.slice(-3000));
      const build = lancia('npm', ['run', 'build'], { cwd: tema });
      assert.equal(build.status, 0, build.out.slice(-3000));
      assert.ok(fs.existsSync(path.join(tema, 'blocks', 'atl-block-hero', 'build', 'index.asset.php')));
      assert.ok(fs.existsSync(path.join(tema, 'html', 'atl-blocks.html')));
    });

    it('Step 4a: il tema si attiva e registra i suoi blocchi con il prefisso nuovo', () => {
      assert.equal(wp('theme', 'activate', VALORI.slug).status, 0);
      const registro = wp('eval', 'foreach ( WP_Block_Type_Registry::get_instance()->get_all_registered() as $n => $b ) if ( str_starts_with( $n, "atl/" ) ) echo $n, "\\n";');
      assert.equal(registro.status, 0, registro.out);
      const attesi = fs.readdirSync(path.join(tema, 'blocks')).filter((d) => fs.existsSync(path.join(tema, 'blocks', d, 'block.json'))).map((d) => d.replace('atl-block-', 'atl/')).sort();
      assert.deepEqual(registro.stdout.trim().split('\n').sort(), attesi);
    });

    it('Step 4b: i menu dei kit di header e footer nascono, e ogni blocco navigation ha un ref che esiste (U06)', () => {
      const kit = (parte) => path.join(tema, 'src', 'kit', 'main', parte, `${parte}-parts`, `_${parte}-content.kit`);
      const piano = wp('eval-file', NAV, 'plan', `header=${kit('header')}`, `footer=${kit('footer')}`);
      assert.equal(piano.status, 0, piano.out);
      const file = path.join(tmp, 'nav-plan.json');
      fs.writeFileSync(file, piano.stdout);
      const applica = wp('eval-file', NAV, 'apply', file);
      assert.equal(applica.status, 0, applica.out);

      const dump = JSON.parse(wp('eval-file', NAV, 'dump').stdout);
      const menu = dump.navigations.map((n) => n.id);
      const blocchi = Object.entries(dump.navigation_blocks).flatMap(([part, elenco]) => elenco.map((b) => ({ part, ...b })));
      assert.equal(blocchi.length, 4, JSON.stringify(dump.navigation_blocks));
      for (const b of blocchi) assert.ok(menu.includes(b.ref), `${b.part} «${b.ariaLabel}»: ref ${b.ref} non è un wp_navigation (${menu.join(', ')})`);
      assert.equal(new Set(blocchi.map((b) => b.ref)).size, 4, 'i quattro blocchi navigation non hanno quattro menu distinti');
      assert.deepEqual(dump.navigations.map((n) => n.title).sort(), ['Demo', 'Menu principale', 'Pagine', 'Policy']);
      // Un secondo apply non trova nulla da scrivere.
      const ancora = wp('eval-file', NAV, 'apply', file);
      assert.equal(ancora.status, 0, ancora.out);
      assert.equal((ancora.stdout.match(/0 differenze/g) || []).length, 4, ancora.stdout);
    });

    it('Step 4c: Home, pagina iniziale e permalink', () => {
      const home = wp('post', 'create', '--post_type=page', '--post_title=Home', '--post_name=home', '--post_status=publish', '--porcelain');
      assert.equal(home.status, 0, home.out);
      for (const args of [['option', 'update', 'show_on_front', 'page'], ['option', 'update', 'page_on_front', home.stdout.trim()],
        ['option', 'update', 'permalink_structure', '/%postname%/'], ['rewrite', 'flush', '--hard']]) {
        const r = wp(args);
        assert.equal(r.status, 0, `${args.join(' ')}: ${r.out}`);
      }
    });

    it('Step 4d: sync dei token (CSS globale via {wp-cli}, impronta in DESIGN.md), poi build e --check a 0', () => {
      const sync = lancia(process.execPath, [SYNC, tema]);
      assert.equal(sync.status, 0, sync.out);
      assert.match(fs.readFileSync(path.join(cfg.site, 'DESIGN.md'), 'utf8'), /^# impronta theme\.json: [0-9a-f]{64}$/m);
      assert.match(fs.readFileSync(path.join(tema, 'assets', 'css', 'wp-global-styles.css'), 'utf8'), /--wp--preset--color--/);
      assert.equal(lancia(process.execPath, [SYNC, tema, '--check']).status, 0);
      const build = lancia('npm', ['run', 'build'], { cwd: tema });
      assert.equal(build.status, 0, build.out.slice(-3000));
    });

    it('npm run check a 0, con i controlli sul frontend eseguiti davvero', () => {
      const r = lancia('npm', ['run', 'check'], { cwd: tema, env: { HOME: casa } });
      assert.equal(r.status, 0, r.out.slice(-3000));
      for (const nome of ['check-tokens', 'check-fonts', 'check-swiper', 'check-perf', 'check-design-tokens']) assert.match(r.out, new RegExp(`PASS ${nome}`));
      assert.doesNotMatch(r.out, /non raggiungibile|non usa questo tema/);
      assert.match(r.out, /SKIP.*\/catalogo-blocchi\//);
    });

    it('la home risponde 200 con header, footer e menu, senza errori di PHP; debug.log vuoto', async () => {
      const home = await scarica(url);
      assert.equal(home.status, 200, `risposta ${home.status}${home.location ? ` verso ${home.location}` : ''}`);
      assert.doesNotMatch(home.body, /Fatal error|Warning:|Notice:|Deprecated:/);
      assert.match(home.body, /atl-header/);
      assert.match(home.body, /atl-footer/);
      assert.match(home.body, /wp-block-navigation/);
      const log = path.join(cfg.site, 'wp-content', 'debug.log');
      assert.equal(fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : '', '');
    });

    it('login dell\'agente senza password: sessione.js entra con l\'utente di DESIGN.md e non lascia sessioni', () => {
      const sessione = (...args) => lancia(process.execPath, [SESSIONE, ...args]);
      const apri = sessione('apri', cfg.site, path.join(RADICE, 'shared', 'playwright', 'pw-pagina.js'), 'id=1');
      assert.equal(apri.status, 0, apri.out);
      assert.ok(fs.readFileSync(path.join(cfg.site, '.playwright-mcp', '_run.js'), 'utf8').includes(`"value":"${VALORI.prefix}adminclaude|`));
      const chiudi = sessione('chiudi', cfg.site);
      assert.equal(chiudi.status, 0, chiudi.out);
      assert.match(chiudi.out, /sessioni attive: 0/);
      // La cartella degli script del browser è fuori da git, come dichiara il .gitignore del progetto.
      fs.rmSync(path.join(cfg.site, '.playwright-mcp'), { recursive: true, force: true });
    });

    it('parità: header e footer del progetto nuovo hanno la stessa struttura nel kit e in WordPress', () => {
      // Step 5a della skill: le pagine dimostrative del tema base non sono pagine del progetto.
      const design = path.join(cfg.site, 'DESIGN.md');
      fs.writeFileSync(design, fs.readFileSync(design, 'utf8').replaceAll('| implementata |', '| da progettare |'));
      const r = lancia(process.execPath, [PARITA, cfg.site]);
      assert.equal(r.status, 0, r.out);
      assert.equal(r.out.trim(), '');
      // Non è un silenzio a vuoto: senza il footer nel kit compilato la differenza si vede.
      const copia = path.join(tmp, 'html-senza-footer');
      fs.cpSync(path.join(tema, 'html'), copia, { recursive: true });
      const blocchi = path.join(copia, `${VALORI.prefix}-blocks.html`);
      fs.writeFileSync(blocchi, fs.readFileSync(blocchi, 'utf8').replace(new RegExp(`class="${VALORI.prefix}-footer__inner`), `class="${VALORI.prefix}-footer__dentro`));
      const diverso = lancia(process.execPath, [PARITA, cfg.site, '--html', copia]);
      assert.equal(diverso.status, 1, diverso.out);
      assert.match(diverso.out, /footer \(telaio\)/);
    });

    it('a setup finito nel progetto non resta nessun riferimento a wdm, nemmeno nei file compilati', () => {
      const delSito = ['README.md', '.gitignore'].map((f) => path.join(cfg.site, f));
      assert.deepEqual(residui([...tuttiIFile(tema), ...delSito], cfg.site), []);
    });
  });
});
