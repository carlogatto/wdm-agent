// Modello Playwright: prova di un blocco dall'editor al frontend (fse-foundations §9, «Per
// block», punti 1–5). Inserisce il blocco in una pagina nuova, la pubblica, controlla che il
// contenuto salvato sia valido e che il frontend stampi il markup di render.php.
//
//   node sessione.js apri "{site-root}" pw-blocco.js blocco={prefix}/{slug} attributi='{"title":"Prova"}'
//   → browser_run_code_unsafe filename=.playwright-mcp/_run.js
//   node sessione.js chiudi "{site-root}"
//   {wp-cli} post delete <id restituito> --force
//
// Per un blocco con figli o con più passi, copia questo file in {site-root}/.playwright-mcp/
// (pw-{slug}.js) e adattalo: nell'ambiente di Playwright MCP non esiste `require`.
async (page) => {
  const SITO = '{{local-url}}';
  const BLOCCO = '{{blocco}}';
  const ATTRIBUTI = JSON.parse('{{attributi}}');
  const CLASSE = `.${BLOCCO.replace('/', '-block-')}`;
  const errori = [];
  const rumore = /login\.css|favicon\.ico/;
  page.on('console', (m) => { if (m.type() === 'error' && !rumore.test(m.location().url || '')) errori.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => errori.push(String(e).slice(0, 300)));
  // Il primo salvataggio di una pagina nuova fa navigare l'editor: senza questo il dialogo
  // «uscire dalla pagina?» blocca l'esecuzione.
  page.on('dialog', (d) => d.accept());

  await page.context().addCookies(/*COOKIES*/);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${SITO}/wp-admin/post-new.php?post_type=page`);
  if (page.url().includes('wp-login.php')) return { errore: 'il backend chiede il login: la sessione è scaduta o revocata. Rilancia sessione.js apri.' };
  await page.waitForFunction((nome) => window.wp && wp.blocks && wp.blocks.getBlockType(nome) && document.querySelector('iframe[name="editor-canvas"]'), BLOCCO, { timeout: 30000 });

  const editor = await page.evaluate(async ({ nome, attributi }) => {
    const { select, dispatch } = wp.data;
    dispatch('core/preferences').set('core/edit-post', 'welcomeGuide', false);
    dispatch('core/block-editor').insertBlocks(wp.blocks.createBlock(nome, attributi));
    dispatch('core/editor').editPost({ title: `Prova ${nome}`, status: 'publish' });
    await dispatch('core/editor').savePost();
    const tutti = (blocchi) => blocchi.flatMap((b) => [b, ...tutti(b.innerBlocks)]);
    return {
      id: select('core/editor').getCurrentPostId(),
      nonValidi: tutti(select('core/block-editor').getBlocks()).filter((b) => !b.isValid).map((b) => b.name),
      daSalvare: select('core/editor').isEditedPostDirty(),
      contenuto: select('core/editor').getEditedPostContent(),
      permalink: select('core/editor').getPermalink(),
    };
  }, { nome: BLOCCO, attributi: ATTRIBUTI });
  const canvas = page.frameLocator('iframe[name="editor-canvas"]');
  editor.nelCanvas = await canvas.locator(CLASSE).count();

  await page.context().clearCookies();
  const frontend = {};
  for (const larghezza of [1440, 768, 390]) {
    await page.setViewportSize({ width: larghezza, height: 900 });
    await page.goto(editor.permalink);
    await page.waitForLoadState('networkidle');
    frontend[larghezza] = await page.evaluate((classe) => ({
      blocchi: document.querySelectorAll(classe).length,
      classi: document.querySelector(classe) ? document.querySelector(classe).className : null,
      senzaScorrimentoOrizzontale: document.documentElement.scrollWidth === window.innerWidth,
    }), CLASSE);
  }
  await page.screenshot({ path: '{{shots}}/blocco-' + BLOCCO.replace('/', '-') + '.png', fullPage: true });
  return { editor, frontend, errori };
}
