// Modello Playwright: una pagina di kit (l'HTML compilato, servito dall'anteprima di `npm run
// dev`) a tre larghezze (fse-foundations §9, «Kit»). Serve al catalogo dei blocchi dopo il
// brief, al kit del telaio e al kit di una pagina. Non entra in WordPress: nessuna sessione.
//
//   node sessione.js prepara "{site-root}" pw-kit.js url=https://localhost:8848/html/{prefix}-home.html nome=kit-home
//   → browser_run_code_unsafe filename=.playwright-mcp/_run.js
//   node sessione.js chiudi "{site-root}"
//
// `url` è l'indirizzo che l'anteprima stampa all'avvio (la porta può non essere la 8848), `nome`
// il prefisso degli screenshot. Per un controllo in più (menu aperto, header dopo lo scorrimento)
// copia questo file in {site-root}/.playwright-mcp/ e adattalo: nell'ambiente di Playwright MCP
// non esiste `require`.
async (page) => {
  const URL = '{{url}}';
  const NOME = '{{nome}}';
  const errori = [];
  // L'anteprima ha un certificato fatto in casa: serve un contesto che lo accetti.
  const contesto = await page.context().browser().newContext({ ignoreHTTPSErrors: true });
  const kit = await contesto.newPage();
  kit.on('console', (m) => { if (m.type() === 'error' && !/favicon\.ico/.test(m.location().url || '')) errori.push(m.text().slice(0, 300)); });
  kit.on('pageerror', (e) => errori.push(String(e).slice(0, 300)));

  const larghezze = {};
  try {
    for (const larghezza of [1440, 768, 390]) {
      await kit.setViewportSize({ width: larghezza, height: 900 });
      // Con l'anteprima spenta goto lancia (connessione rifiutata): deve uscire un messaggio, non l'errore grezzo.
      const risposta = await kit.goto(URL).catch(() => null);
      if (!risposta || !risposta.ok()) return { errore: `${URL} ${risposta ? `risponde ${risposta.status()}` : 'non risponde'}: l'anteprima è accesa (npm run dev) e la pagina è stata compilata?` };
      await kit.waitForLoadState('networkidle');
      // L'avviso «BS: connected» dell'anteprima non è della pagina: fuori dagli screenshot.
      await kit.addStyleTag({ content: '#__bs_notify__ { display: none !important; }' });
      // I caroselli partono quando entrano nello schermo: prima si scorre tutta la pagina.
      await kit.evaluate(async () => {
        for (let y = 0; y < document.documentElement.scrollHeight; y += window.innerHeight) {
          window.scrollTo(0, y);
          await new Promise((fatto) => setTimeout(fatto, 150));
        }
        // Il tema ha scroll-behavior: smooth: senza `instant` lo screenshot parte a pagina in movimento.
        window.scrollTo({ top: 0, behavior: 'instant' });
        await new Promise((fatto) => setTimeout(fatto, 400));
      });
      await kit.waitForFunction(() => document.querySelectorAll('.swiper').length === document.querySelectorAll('.swiper-initialized').length, null, { timeout: 5000 }).catch(() => {});
      larghezze[larghezza] = await kit.evaluate(() => {
        const famiglia = (selettore) => { const e = document.querySelector(selettore); return e ? getComputedStyle(e).fontFamily.split(',')[0].replace(/["']/g, '').trim() : null; };
        return {
          senzaScorrimentoOrizzontale: document.documentElement.scrollWidth === window.innerWidth,
          h1: document.querySelectorAll('h1').length,
          caroselli: document.querySelectorAll('.swiper').length,
          caroselliAvviati: document.querySelectorAll('.swiper-initialized').length,
          ancoreSenzaBersaglio: [...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute('href')).filter((h) => h.length > 1 && !document.getElementById(h.slice(1))),
          immaginiRotte: [...document.images].filter((i) => i.complete && !i.naturalWidth).map((i) => i.getAttribute('src')),
          fontDelTesto: famiglia('body'),
          fontDeiTitoli: famiglia('main h1, main h2'),
          fontCaricati: [...new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, '')))],
        };
      });
      await kit.screenshot({ path: '{{shots}}/' + NOME + '-' + larghezza + '.png', fullPage: true });
    }
  } finally {
    await contesto.close();
  }
  return { url: URL, larghezze, errori };
}
