// Il pulitore degli SVG del tema base contro file veri (D3): i 204 SVG del campione raccolto
// nei progetti locali (docs/superpowers/plans/lotto-0/svg-campione.tsv nel repo del tema) e la
// serie scritta apposta. In Chrome: ogni file dà la stessa immagine prima e dopo la pulizia,
// anche passando dal parser HTML come nella stampa inline; ogni SVG malevolo, messo nella
// pagina, lascia un DOM di soli elementi ammessi e non fa partire nulla; un'icona di Affinity
// prende il colore del testo. I file del campione sono di progetti cliente: si leggono dove
// sono, non si copiano. Non usa il sito di prova: solo il PHP e il tema base della sua configurazione.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const sito = require('../lib/sito');
const chrome = require('../lib/chrome');

// Quota massima di pixel diversi tra due disegni dello stesso file (riquadro di 240 px). Due
// disegni uguali non danno zero: i bordi sfumati cambiano di poco quando il browser parte da una
// misura diversa (il file pulito per la stampa inline non ha più width e height). Il massimo
// misurato sul campione è scritto nell'esito della prova.
const SOGLIA = 0.005;
// File del campione che il pulitore rifiuta, con il motivo: non sono immagini.
const RIFIUTI = { 'fa-brands-400.svg': 'empty' }; // un font in formato SVG: nessuna forma da disegnare
// Animazioni: si tolgono per disegno. L'originale si confronta fermo, senza i suoi <animate>.
const ANIMAZIONE = /<(animate|animateTransform|animateMotion|set)\b[^>]*?(\/>|>[\s\S]*?<\/\1>)/g;

describe('SVG: campione reale e confronto nel browser', { skip: sito.nonDisponibile() || chrome.nonDisponibile() || false }, () => {
  let svg, campione, casi, tema, server, browser, esito;

  before(async () => {
    const cfg = sito.leggiConfig();
    tema = path.join(cfg.base, sito.TEMA_BASE);
    svg = require(path.join(tema, 'tools', 'lib', 'svg.js'));
    const elenco = path.join(cfg.base, 'docs', 'superpowers', 'plans', 'lotto-0', 'svg-campione.tsv');
    assert.ok(fs.existsSync(elenco), `manca l'elenco del campione (${elenco})`);
    campione = fs.readFileSync(elenco, 'utf8').trim().split('\n').slice(1).map((riga) => {
      const [gruppo, strumento, caratteristiche, file] = riga.split('\t');
      return { gruppo, strumento, caratteristiche, file };
    });
    const mancanti = campione.filter((c) => !fs.existsSync(c.file));
    assert.deepEqual(mancanti.map((c) => c.file), [], 'file del campione non più presenti: rigenera l\'elenco con node docs/superpowers/plans/lotto-0/svg-campione.js');

    const file = campione.map((c) => c.file);
    svg.pulisci(file).forEach((r, i) => { campione[i].pulito = r; });
    svg.pulisci(file, ['--strip-size', '--class=wdm-svg', '--id-prefix=wdm-svg-1-']).forEach((r, i) => { campione[i].inline = r; });

    const serie = JSON.parse(fs.readFileSync(path.join(tema, 'tools', 'svg', 'casi.json'), 'utf8'));
    casi = [...serie.malevoli.map((c) => ({ ...c, percorso: path.join(tema, 'tools', 'svg', 'malevoli', c.file) })), ...serie.legittimi.map((c) => ({ ...c, percorso: path.join(tema, 'tools', 'svg', 'legittimi', c.file), legittimo: true }))];
    svg.pulisci(casi.map((c) => c.percorso), ['--strip-size', '--class=wdm-svg', '--id-prefix=wdm-svg-1-']).forEach((r, i) => { casi[i].inline = r; });
    svg.pulisci(casi.map((c) => c.percorso)).forEach((r, i) => { casi[i].pulito = r; });

    // Nel browser: il campione e i casi legittimi si confrontano come immagini, i malevoli si ispezionano.
    const confronti = [...campione.filter((c) => c.pulito.ok).map((c) => ({ ...c, nome: c.file, percorso: c.file })), ...casi.filter((c) => c.legittimo).map((c) => ({ ...c, nome: `legittimi/${c.file}` }))];
    const malevoli = casi.filter((c) => !c.legittimo && c.inline.ok);
    const affinity = campione.find((c) => c.gruppo === 'affinity-a-caso' && c.inline.ok && /fill="(?!none)/.test(c.inline.svg));
    const pagina = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'svg', 'confronto.html'));

    esito = await new Promise((resolve, reject) => {
      const rispondi = (res, tipo, corpo) => { res.writeHead(200, { 'Content-Type': tipo, 'Cache-Control': 'no-store' }); res.end(corpo); };
      server = http.createServer((req, res) => {
        const [, cosa, quale] = /^\/([a-z.]+)(?:\/(\d+))?/.exec(req.url) || [];
        const i = Number(quale);
        if (req.method === 'POST' && cosa === 'esito') {
          let corpo = '';
          req.on('data', (d) => { corpo += d; });
          req.on('end', () => { res.end('ok'); resolve(JSON.parse(corpo)); });
        } else if (req.url === '/') rispondi(res, 'text/html; charset=utf-8', pagina);
        else if (cosa === 'main.css') rispondi(res, 'text/css; charset=utf-8', fs.readFileSync(path.join(tema, 'assets', 'css', 'main.css')));
        else if (cosa === 'elenco.json') rispondi(res, 'application/json', JSON.stringify({ confronti: confronti.map((c, n) => ({ i: n, nome: c.nome })), malevoli: malevoli.map((c, n) => ({ i: n, nome: c.file })) }));
        else if (cosa === 'originale') rispondi(res, 'image/svg+xml', confronti[i].caratteristiche && confronti[i].caratteristiche.includes('animazione') ? fs.readFileSync(confronti[i].percorso, 'utf8').replace(ANIMAZIONE, '') : fs.readFileSync(confronti[i].percorso));
        else if (cosa === 'pulito') rispondi(res, 'image/svg+xml', confronti[i].pulito.svg);
        else if (cosa === 'inline') rispondi(res, 'text/plain; charset=utf-8', confronti[i].inline.svg);
        else if (cosa === 'malevolo') rispondi(res, 'text/plain; charset=utf-8', malevoli[i].inline.svg);
        else if (cosa === 'grezzo') rispondi(res, 'text/plain; charset=utf-8', fs.readFileSync(path.join(tema, 'tools', 'svg', 'malevoli', 'eventi.svg')));
        else if (cosa === 'colore') rispondi(res, 'text/plain; charset=utf-8', affinity.inline.svg);
        else { res.writeHead(404); res.end(); }
      });
      server.listen(0, '127.0.0.1', () => {
        browser = chrome.apri(`http://127.0.0.1:${server.address().port}/`);
        setTimeout(() => reject(new Error('Chrome non ha mandato l\'esito entro tre minuti')), 180000).unref();
      });
    });
    esito.attesi = { confronti: confronti.length, malevoli: malevoli.length };
  });

  after(async () => {
    if (browser) await browser.chiudi();
    if (server) await new Promise((resolve) => server.close(resolve));
  });

  it('i 204 file del campione: puliti, tranne i rifiuti attesi con il loro motivo', () => {
    assert.equal(campione.length, 204);
    const rifiutati = Object.fromEntries(campione.filter((c) => !c.pulito.ok).map((c) => [path.basename(c.file), c.pulito.code]));
    assert.deepEqual(rifiutati, RIFIUTI);
    for (const c of campione.filter((x) => !x.pulito.ok)) assert.ok(c.pulito.message.length > 40, `${c.file}: rifiuto senza un messaggio che dica cosa fare`);
  });

  it('nessuna uscita del campione ha contenuto attivo; la stampa inline non ha misure', () => {
    const puliti = campione.filter((c) => c.pulito.ok);
    for (const c of puliti) {
      assert.deepEqual(svg.contenutoAttivo(c.pulito.svg), [], c.file);
      assert.deepEqual(svg.contenutoAttivo(c.inline.svg), [], `${c.file} (inline)`);
    }
    // La stampa inline toglie le misure dalla radice di ogni file: la dimensione la dà il CSS.
    for (const c of puliti) assert.doesNotMatch(c.inline.svg.slice(0, c.inline.svg.indexOf('>')), /\s(width|height)=/, c.file);
  });

  it('la pagina di prova ha lavorato su tutto e vede il contenuto attivo quando c\'è', () => {
    assert.deepEqual(esito.errori, []);
    assert.equal(esito.confronti.length, esito.attesi.confronti);
    assert.equal(esito.malevoli.length, esito.attesi.malevoli);
    assert.ok(esito.attesi.malevoli >= 25, 'pochi casi malevoli arrivano al browser');
    assert.ok(esito.controllo.length > 0, 'un SVG non ripulito, messo nella pagina, non ha fatto scattare nulla: la prova non vedrebbe un difetto');
  });

  it('stessa immagine prima e dopo: come <img>, e dopo il passaggio dal parser HTML', (t) => {
    const massimo = (chiave) => Math.max(...esito.confronti.filter((c) => !c.errore).map((c) => c[chiave].diversi));
    t.diagnostic(`${esito.confronti.length} file confrontati; massimo di pixel diversi: pulito ${(massimo('pulito') * 100).toFixed(3)}%, inline ${(massimo('inline') * 100).toFixed(3)}%`);
    const diversi = esito.confronti.filter((c) => c.errore || c.pulito.diversi > SOGLIA || c.inline.diversi > SOGLIA)
      .map((c) => `${c.nome}: ${c.errore || `pulito ${(c.pulito.diversi * 100).toFixed(2)}%, inline ${(c.inline.diversi * 100).toFixed(2)}% di pixel diversi`}`);
    assert.deepEqual(diversi, []);
    // Un confronto tra due riquadri vuoti passerebbe sempre: quasi tutti i file devono disegnare qualcosa.
    const vuoti = esito.confronti.filter((c) => !c.errore && c.pulito.disegnati === 0).map((c) => c.nome);
    assert.ok(vuoti.length <= 3, `troppi file che non disegnano nulla nemmeno da originali: ${vuoti.join(', ')}`);
  });

  it('nella pagina, campione e casi legittimi: solo elementi e attributi ammessi, nulla che parte', () => {
    assert.deepEqual(esito.confronti.filter((c) => c.dom.length || c.colpi.length).map((c) => `${c.nome}: ${[...c.dom, ...c.colpi].join('; ')}`), []);
  });

  it('nella pagina, serie malevola ripulita: solo elementi e attributi ammessi, nulla che parte', () => {
    assert.deepEqual(esito.malevoli.filter((c) => c.dom.length || c.colpi.length).map((c) => `${c.nome}: ${[...c.dom, ...c.colpi].join('; ')}`), []);
  });

  it('un\'icona di Affinity prende il colore del testo e lo segue; con «colori originali» tiene i suoi', () => {
    const { testo, originali } = esito.colore;
    assert.ok(testo.attributi.length > 0, 'l\'icona scelta non ha forme con un colore proprio');
    assert.ok(testo.attributi.every((a) => !/^(currentColor|rgb\(200, ?0, ?0\)|rgb\(0, ?0, ?200\))$/.test(a)), 'l\'icona ha già il colore della prova');
    assert.deepEqual([...new Set(testo.prima)], ['rgb(200, 0, 0)']);
    assert.deepEqual([...new Set(testo.dopo)], ['rgb(0, 0, 200)']);
    assert.ok(originali.dopo.every((c) => c !== 'rgb(0, 0, 200)' && c !== 'rgb(200, 0, 0)'), `con i colori originali una forma ha preso il colore del testo: ${originali.dopo.join(', ')}`);
    assert.deepEqual(originali.prima, originali.dopo);
  });
});
