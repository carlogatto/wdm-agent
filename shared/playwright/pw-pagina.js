// Modello Playwright: una pagina costruita si apre nell'editor senza blocchi non validi e regge
// sul frontend a tre larghezze (fse-foundations §9, «Per page»).
//
//   node sessione.js apri "{site-root}" pw-pagina.js id=<ID della pagina>
//   → browser_run_code_unsafe filename=.playwright-mcp/_run.js
//   node sessione.js chiudi "{site-root}"
//
// sessione.js mette i cookie al posto di COOKIES e i valori al posto dei segnaposto tra doppie
// graffe, che stanno sempre dentro una stringa tra apici singoli. Per un controllo in più, copia
// questo file in {site-root}/.playwright-mcp/ e adattalo: nell'ambiente di Playwright MCP non
// esiste `require`.
async (page) => {
  const SITO = '{{local-url}}';
  const ID = Number('{{id}}');
  const errori = [];
  // Rumore noto, che non dipende dal tema: il CSS della pagina di login e la favicon.
  const rumore = /login\.css|favicon\.ico/;
  page.on('console', (m) => { if (m.type() === 'error' && !rumore.test(m.location().url || '')) errori.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => errori.push(String(e).slice(0, 300)));
  page.on('dialog', (d) => d.accept());

  await page.context().addCookies(/*COOKIES*/);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${SITO}/wp-admin/post.php?post=${ID}&action=edit`);
  if (page.url().includes('wp-login.php')) return { errore: 'il backend chiede il login: la sessione è scaduta o revocata. Rilancia sessione.js apri.' };
  await page.waitForFunction(() => window.wp && wp.data && wp.data.select('core/editor') && wp.data.select('core/editor').getCurrentPostId() && document.querySelector('iframe[name="editor-canvas"]'), null, { timeout: 30000 });
  await page.waitForTimeout(3000);
  const editor = await page.evaluate(() => {
    const { select } = wp.data;
    const tutti = (blocchi) => blocchi.flatMap((b) => [b, ...tutti(b.innerBlocks)]);
    const blocchi = tutti(select('core/block-editor').getBlocks());
    return {
      primoLivello: select('core/block-editor').getBlocks().map((b) => b.name),
      nonValidi: blocchi.filter((b) => !b.isValid).map((b) => b.name),
      mancanti: blocchi.filter((b) => b.name === 'core/missing').length,
      daSalvare: select('core/editor').isEditedPostDirty(),
      permalink: select('core/editor').getPermalink(),
    };
  });
  await page.screenshot({ path: '{{shots}}/pagina-' + ID + '-editor.png' });

  // Il frontend si guarda da visitatore.
  await page.context().clearCookies();
  const frontend = {};
  for (const larghezza of [1440, 768, 390]) {
    await page.setViewportSize({ width: larghezza, height: 900 });
    await page.goto(editor.permalink);
    await page.waitForLoadState('networkidle');
    frontend[larghezza] = await page.evaluate(() => ({
      senzaScorrimentoOrizzontale: document.documentElement.scrollWidth === window.innerWidth,
      h1: document.querySelectorAll('h1').length,
      caroselliAvviati: document.querySelectorAll('.swiper-initialized').length,
      ancoreSenzaBersaglio: [...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute('href')).filter((h) => h.length > 1 && !document.getElementById(h.slice(1))),
    }));
    await page.screenshot({ path: '{{shots}}/pagina-' + ID + '-' + larghezza + '.png', fullPage: true });
  }
  return { editor, frontend, errori };
}
