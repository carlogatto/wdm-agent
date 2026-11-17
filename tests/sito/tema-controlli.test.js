// I controlli del tema base (tools/check-*.js, npm run check) e la sua build, su una copia: ogni
// controllo fallisce quando deve, salta dichiarandolo quando il sito non c'è, e nessuno passa a
// vuoto (U21, U28, U43, U44, U50). Il tema base si legge soltanto.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const sito = require('../lib/sito');
const { RADICE } = require('../lib/citati');

// Asincrono: mentre il controllo gira, il server locale di prova deve poter rispondere.
function lancia(comando, argomenti, opzioni = {}) {
  return new Promise((resolve) => {
    const figlio = spawn(comando, argomenti, { ...opzioni, env: { ...process.env, ...(opzioni.env || {}) } });
    let out = '';
    figlio.stdout.on('data', (d) => { out += d; });
    figlio.stderr.on('data', (d) => { out += d; });
    figlio.on('error', (errore) => resolve({ status: null, out: errore.message }));
    figlio.on('close', (status) => resolve({ status, out }));
  });
}

describe('controlli e build del tema base', { skip: sito.nonDisponibile() || false }, () => {
  let tmp, tema, server, url, pagine;

  const nodo = (script, argomenti = [], env = {}) => lancia(process.execPath, [path.join(tema, ...script.split('/')), ...argomenti], { cwd: tema, env });
  const file = (relativo) => path.join(tema, ...relativo.split('/'));
  // Esegue `corpo` con un file modificato (o tolto, con null) e poi lo rimette com'era.
  const con = async (relativo, cambia, corpo) => {
    const originale = fs.existsSync(file(relativo)) ? fs.readFileSync(file(relativo)) : null;
    const nuovo = cambia === null ? null : cambia(originale === null ? '' : originale.toString('utf8'));
    if (nuovo === null) fs.rmSync(file(relativo)); else fs.writeFileSync(file(relativo), nuovo);
    try {
      return await corpo();
    } finally {
      if (originale === null) fs.rmSync(file(relativo), { force: true }); else fs.writeFileSync(file(relativo), originale);
    }
  };
  // Una pagina come la stamperebbe il tema: basta ciò che i controlli guardano.
  const pagina = (corpo = '', testa = '<link rel="preload" as="font" type="font/woff2" crossorigin href="/wp-content/themes/wdm-theme/assets/fonts/IBMPlexSans-Regular.woff2">') =>
    `<!doctype html><html><head>${testa}<link rel="stylesheet" href="/wp-content/themes/wdm-theme/assets/css/main.css"></head><body>${corpo}</body></html>`;

  before(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wdm-agent-tema-'));
    tema = sito.copiaBase(path.join(tmp, 'sito'), (relativo) => !relativo.startsWith('docs/'));
    sito.collegaModuli(tema);
    pagine = {};
    server = http.createServer((req, res) => {
      const risposta = pagine[req.url.split('?')[0]];
      res.writeHead(risposta ? 200 : 404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(risposta || 'non trovata');
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('nei controlli non restano script di shell né comandi del sistema', () => {
    assert.deepEqual(fs.readdirSync(file('tools'), { recursive: true }).filter((f) => f.endsWith('.sh')), []);
    const script = JSON.parse(fs.readFileSync(file('package.json'), 'utf8')).scripts;
    assert.doesNotMatch(Object.values(script).join(' '), /\bbash\b|\.sh\b/);
    for (const f of fs.readdirSync(file('tools'), { recursive: true }).filter((f) => f.endsWith('.js'))) {
      assert.doesNotMatch(fs.readFileSync(path.join(file('tools'), f), 'utf8'), /execSync|\bcurl\b|\bjq\b|stat -f|\bsed\b/, f);
    }
  });

  describe('check-tokens', () => {
    it('copia intatta: passa', async () => {
      const r = await nodo('tools/check-tokens.js', ['src/scss', 'blocks']);
      assert.equal(r.status, 0, r.out);
    });

    it('un colore rgb() letterale: fallisce (U44)', async () => {
      const r = await con('src/scss/_type.scss', (t) => `${t}\n.prova { color: rgb(0 0 0 / 50%); }\n`, () => nodo('tools/check-tokens.js', ['src/scss']));
      assert.equal(r.status, 1, r.out);
      assert.match(r.out, /_type\.scss/);
    });

    it('una cartella che non esiste: fallisce, non passa a vuoto (U44)', async () => {
      const r = await nodo('tools/check-tokens.js', ['src/scss', 'cartella-che-non-esiste']);
      assert.equal(r.status, 1, r.out);
      assert.match(r.out, /cartella-che-non-esiste/);
    });
  });

  describe('check-blocks', () => {
    it('copia intatta: passa', async () => {
      const r = await nodo('tools/check-blocks.js');
      assert.equal(r.status, 0, r.out);
    });

    it('nessun blocco: fallisce (U44)', async () => {
      fs.renameSync(file('blocks'), file('blocks-via'));
      fs.mkdirSync(file('blocks'));
      try {
        const r = await nodo('tools/check-blocks.js');
        assert.equal(r.status, 1, r.out);
        assert.match(r.out, /nessun blocco/);
        const uno = await nodo('tools/check-blocks.js', ['blocco-che-non-esiste']);
        assert.equal(uno.status, 1, uno.out);
      } finally {
        fs.rmSync(file('blocks'), { recursive: true });
        fs.renameSync(file('blocks-via'), file('blocks'));
      }
    });
  });

  describe('check-fonts', () => {
    it('copia intatta: passa, con il peso totale', async () => {
      const r = await nodo('tools/check-fonts.js');
      assert.equal(r.status, 0, r.out);
      assert.match(r.out, /PASS check-fonts \(\d+ byte/);
    });

    it('un file dichiarato in theme.json e assente: fallisce', async () => {
      const r = await con('assets/fonts/IBMPlexMono-Medium.woff2', null, () => nodo('tools/check-fonts.js'));
      assert.equal(r.status, 1, r.out);
      assert.match(r.out, /IBMPlexMono-Medium\.woff2/);
    });

    it('un font in assets/fonts che theme.json non dichiara: fallisce', async () => {
      const r = await con('assets/fonts/OpenSans-Regular.woff2', () => 'x', () => nodo('tools/check-fonts.js'));
      assert.equal(r.status, 1, r.out);
      assert.match(r.out, /OpenSans-Regular\.woff2/);
    });

    it('un @font-face in meno in fonts.scss: fallisce', async () => {
      const r = await con('src/scss/fonts.scss', (t) => t.replace('@font-face', '@font-fac'), () => nodo('tools/check-fonts.js'));
      assert.equal(r.status, 1, r.out);
      assert.match(r.out, /fonts\.scss/);
    });
  });

  describe('check-swiper e check-perf sul frontend', () => {
    it('sito irraggiungibile: SKIP dichiarato ed exit 0 (U21)', async () => {
      for (const script of ['tools/check-swiper.js', 'tools/check-perf.js']) {
        const r = await nodo(script, [], { SITE_URL: 'https://127.0.0.1:1' });
        assert.equal(r.status, 0, `${script}: ${r.out}`);
        assert.match(r.out, /SKIP.*non raggiungibile/, script);
        assert.match(r.out, /PASS .*senza frontend/, script);
      }
    });

    it('il sito risponde ma non usa questo tema: SKIP dichiarato', async () => {
      pagine = { '/': '<html><body>Benvenuto in MAMP PRO</body></html>' };
      for (const script of ['tools/check-swiper.js', 'tools/check-perf.js']) {
        const r = await nodo(script, [], { SITE_URL: url });
        assert.equal(r.status, 0, `${script}: ${r.out}`);
        assert.match(r.out, /SKIP.*non usa questo tema/, script);
      }
    });

    it('Home senza caroselli e Catalogo assente: passa, e il Catalogo saltato è dichiarato (U50)', async () => {
      pagine = { '/': pagina() };
      const swiper = await nodo('tools/check-swiper.js', [], { SITE_URL: `${url}/` });
      assert.equal(swiper.status, 0, swiper.out);
      assert.match(swiper.out, /SKIP.*\/catalogo-blocchi\//);
      assert.match(swiper.out, /PASS check-swiper/);
      const perf = await nodo('tools/check-perf.js', [], { SITE_URL: url });
      assert.equal(perf.status, 0, perf.out);
      assert.match(perf.out, /PASS check-perf$/m);
    });

    it('una pagina con un carosello e senza swiper.js: fallisce', async () => {
      pagine = { '/': pagina('<div class="swiper wdm-block-hero__swiper"></div>') };
      const r = await nodo('tools/check-swiper.js', [], { SITE_URL: url });
      assert.equal(r.status, 1, r.out);
      assert.match(r.out, /swiper\.js/);
    });

    it('una pagina senza caroselli che carica Swiper: fallisce', async () => {
      pagine = { '/': pagina(), '/catalogo-blocchi/': pagina('<script type="module" src="/wp-content/themes/wdm-theme/assets/js/swiper.js"></script>') };
      const r = await nodo('tools/check-swiper.js', [], { SITE_URL: url });
      assert.equal(r.status, 1, r.out);
      assert.match(r.out, /catalogo-blocchi/);
    });

    it('Catalogo con carosello, Swiper nell\'import map e CSS inline una volta: passa', async () => {
      const carosello = '<style id="wdm-swiper-inline-css">.swiper{}</style><script type="importmap">{"imports":{"wdm-swiper":"/wp-content/themes/wdm-theme/assets/js/swiper.js"}}</script><div class="swiper wdm-block-cards-carousel__swiper"></div>';
      pagine = { '/': pagina(), '/catalogo-blocchi/': pagina(carosello) };
      const r = await nodo('tools/check-swiper.js', [], { SITE_URL: url });
      assert.equal(r.status, 0, r.out);
      assert.doesNotMatch(r.out, /SKIP/);
    });

    it('Home senza il preload del font: check-perf fallisce', async () => {
      pagine = { '/': pagina('', '') };
      const r = await nodo('tools/check-perf.js', [], { SITE_URL: url });
      assert.equal(r.status, 1, r.out);
      assert.match(r.out, /preload/);
    });

    it('il sito risponde con un errore: fallisce, non salta', async () => {
      const guasto = http.createServer((req, res) => { res.writeHead(500); res.end('errore'); });
      await new Promise((resolve) => guasto.listen(0, '127.0.0.1', resolve));
      try {
        const r = await nodo('tools/check-perf.js', [], { SITE_URL: `http://127.0.0.1:${guasto.address().port}` });
        assert.equal(r.status, 1, r.out);
        assert.match(r.out, /500/);
      } finally {
        await new Promise((resolve) => guasto.close(resolve));
      }
    });

    it('senza SITE_URL l\'indirizzo è la riga {local-url} di DESIGN.md', async () => {
      pagine = { '/': pagina('', '') };
      const design = path.join(tmp, 'sito', 'DESIGN.md');
      const originale = fs.readFileSync(design, 'utf8');
      fs.writeFileSync(design, originale.replace(/^\| `\{local-url\}` \|.*$/m, () => `| \`{local-url}\` | ${url}/ |`));
      try {
        const r = await nodo('tools/check-perf.js', [], { SITE_URL: '' });
        assert.equal(r.status, 1, r.out);
        assert.match(r.out, /preload/);
      } finally {
        fs.writeFileSync(design, originale);
      }
    });
  });

  describe('check-design-tokens (sync --check dentro npm run check, U28)', () => {
    // Una cartella personale finta: il registro dei plugin di Claude Code punta a questo checkout.
    const casa = (conPlugin) => {
      const dir = fs.mkdtempSync(path.join(tmp, 'casa-'));
      fs.mkdirSync(path.join(dir, '.claude', 'plugins'), { recursive: true });
      const plugins = conPlugin ? { 'wdm-agent@wdm-agent': [{ installPath: RADICE }] } : {};
      fs.writeFileSync(path.join(dir, '.claude', 'plugins', 'installed_plugins.json'), JSON.stringify({ version: 2, plugins }));
      return { HOME: dir, USERPROFILE: dir };
    };

    it('token allineati: passa', async () => {
      const r = await nodo('tools/check-design-tokens.js', [], casa(true));
      assert.equal(r.status, 0, r.out);
      assert.match(r.out, /PASS check-design-tokens/);
    });

    it('theme.json modificato senza passare dagli hook: fallisce', async () => {
      const r = await con('theme.json', (t) => t.replace('"contentSize": "840px"', '"contentSize": "1px"'), () => nodo('tools/check-design-tokens.js', [], casa(true)));
      assert.equal(r.status, 1, r.out);
      assert.match(r.out, /1px/);
    });

    it('plugin non installato: SKIP dichiarato ed exit 0', async () => {
      const r = await nodo('tools/check-design-tokens.js', [], casa(false));
      assert.equal(r.status, 0, r.out);
      assert.match(r.out, /SKIP.*wdm-agent/);
    });
  });

  // Un file dichiarato e assente fa fallire la build, non la lascia passare con un avviso (U43).
  describe('build.js', () => {
    const build = () => nodo('build.js');

    it('copia intatta: exit 0', async () => {
      const r = await build();
      assert.equal(r.status, 0, r.out);
      assert.ok(fs.existsSync(file('assets/css/main.css')) && fs.existsSync(file('html/wdm-blocks.html')));
    });

    it('un @append verso un file che non esiste: exit 1, il messaggio lo nomina', async () => {
      const r = await con('src/js/main.js', (js) => `${js}\n// @append "_non-esiste.js";\n`, build);
      assert.equal(r.status, 1, r.out);
      assert.match(r.out, /_non-esiste\.js/);
    });

    it('un file fisso del tema assente (src/scss/fonts.scss): exit 1', async () => {
      const r = await con('src/scss/fonts.scss', null, build);
      assert.equal(r.status, 1, r.out);
      assert.match(r.out, /fonts\.scss/);
    });

    it('block.json dichiara build/index.js ma src/index.js non c\'è: exit 1', async () => {
      const r = await con('blocks/wdm-block-hero/src/index.js', null, build);
      assert.equal(r.status, 1, r.out);
      assert.match(r.out, /wdm-block-hero\/src\/index\.js/);
    });

    it('package.json dichiara la versione di Node e non è pubblicabile', () => {
      const p = JSON.parse(fs.readFileSync(file('package.json'), 'utf8'));
      assert.equal(p.engines.node, '>=22');
      assert.equal(p.private, true);
    });
  });

  describe('npm run check', () => {
    it('lancia i cinque controlli, tutti in Node', () => {
      const check = JSON.parse(fs.readFileSync(file('package.json'), 'utf8')).scripts.check;
      for (const nome of ['check-tokens.js', 'check-fonts.js', 'check-swiper.js', 'check-perf.js', 'check-design-tokens.js']) {
        assert.ok(check.includes(`node tools/${nome}`), `manca ${nome}: ${check}`);
      }
    });
  });
});
