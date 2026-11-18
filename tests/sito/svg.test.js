// SVG dalla libreria media, stampato inline (D3, U20), sul sito di prova con il tema base attivo.
// Caricamento: ogni SVG malevolo della serie del tema (tools/svg/casi.json) è rifiutato oppure
// arriva su disco senza contenuto attivo, per ognuna delle strade con cui un file entra in
// WordPress: WP-CLI, REST (in multipart e con il file come corpo), libreria media.
// Stampa: wdm_render_svg() ripulisce di nuovo, anche ciò che è arrivato senza passare dal filtro.
// I casi sono in sequenza.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const os = require('node:os');
const path = require('node:path');

const sito = require('../lib/sito');

describe('SVG: caricamento e stampa inline', { skip: sito.nonDisponibile() || false }, () => {
  let cfg, tema, svg, serie, tmp, cookie;

  const php = (codice) => {
    const r = sito.wp(['eval', codice, '--user=' + sito.ADMIN]);
    assert.equal(r.status, 0, r.out);
    return r.stdout;
  };

  // Una richiesta al sito di prova, con i cookie della sessione. Il certificato locale non si verifica.
  const richiesta = (metodo, percorso, { headers = {}, body = null } = {}) => new Promise((resolve, reject) => {
    const url = new URL(percorso, cfg.url.replace(/\/+$/, '') + '/');
    const req = (url.protocol === 'https:' ? https : http).request(url, { method: metodo, rejectUnauthorized: false, timeout: 30000, headers: { Cookie: cookie, ...headers, ...(body ? { 'Content-Length': body.length } : {}) } }, (res) => {
      const pezzi = [];
      res.on('data', (d) => pezzi.push(d));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(pezzi).toString('utf8') }));
    });
    req.on('timeout', () => req.destroy(new Error(`nessuna risposta da ${url}`)));
    req.on('error', (errore) => reject(new Error(`il sito di prova non risponde a ${url} (${errore.message}): avvia i server di MAMP PRO.`)));
    req.end(body);
  });

  const multipart = (campi, campoFile, nome, dati) => {
    const confine = `----wdmagent${Date.now()}`;
    const testa = Object.entries(campi).map(([k, v]) => `--${confine}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`).join('');
    const file = `--${confine}\r\nContent-Disposition: form-data; name="${campoFile}"; filename="${nome}"\r\nContent-Type: image/svg+xml\r\n\r\n`;
    return { headers: { 'Content-Type': `multipart/form-data; boundary=${confine}` }, body: Buffer.concat([Buffer.from(testa + file), dati, Buffer.from(`\r\n--${confine}--\r\n`)]) };
  };

  // nome del file in uploads → percorso, per ogni allegato.
  const allegati = () => JSON.parse(php('$o = array(); foreach ( get_posts( array( "post_type" => "attachment", "post_status" => "any", "numberposts" => -1 ) ) as $p ) { $f = get_attached_file( $p->ID ); $o[ basename( $f ) ] = array( "id" => $p->ID, "file" => $f ); } echo wp_json_encode( $o );'));

  // Per ogni caso della serie: rifiutato con il messaggio del pulitore, oppure su disco c'è
  // esattamente l'uscita del pulitore, senza contenuto attivo. `esiti[file]` = { ok, messaggio }.
  const verifica = (strada, esiti) => {
    const trovati = allegati();
    for (const caso of serie) {
      const nome = `${strada}-${caso.file}`;
      const esito = esiti[caso.file];
      assert.ok(esito, `${nome}: nessun esito`);
      if (caso.atteso.ok) {
        assert.ok(esito.ok, `${nome}: rifiutato (${esito.messaggio}), atteso pulito`);
        assert.ok(trovati[nome], `${nome}: nessun allegato`);
        const salvato = fs.readFileSync(trovati[nome].file, 'utf8');
        assert.deepEqual(svg.contenutoAttivo(salvato), [], `${nome}: contenuto attivo su disco`);
        assert.equal(salvato, caso.atteso.svg, `${nome}: il file salvato non è l'uscita del pulitore`);
      } else {
        assert.ok(!esito.ok, `${nome}: caricato, atteso rifiuto ${caso.atteso.code}`);
        assert.ok(!trovati[nome], `${nome}: rifiutato ma l'allegato c'è`);
        // I primi caratteri bastano a distinguere i messaggi, e non contengono segni che una
        // risposta potrebbe codificare.
        assert.ok(esito.messaggio.includes(caso.atteso.message.slice(0, 26)), `${nome}: messaggio «${esito.messaggio}», atteso «${caso.atteso.message}»`);
      }
    }
  };

  before(() => {
    cfg = sito.prepara();
    tema = sito.copiaBase(cfg.site, (relativo) => relativo.startsWith('wp-content/themes/wdm-theme/'));
    assert.equal(sito.wp(['theme', 'activate', 'wdm-theme']).status, 0);
    // Verificatore e pulitore da riga di comando del tema base: il PHP è quello del suo DESIGN.md.
    svg = require(path.join(cfg.base, sito.TEMA_BASE, 'tools', 'lib', 'svg.js'));
    const casi = JSON.parse(fs.readFileSync(path.join(tema, 'tools', 'svg', 'casi.json'), 'utf8'));
    serie = [...casi.malevoli.map((c) => ({ ...c, percorso: path.join(tema, 'tools', 'svg', 'malevoli', c.file) })), ...casi.legittimi.map((c) => ({ ...c, percorso: path.join(tema, 'tools', 'svg', 'legittimi', c.file) }))];
    svg.pulisci(serie.map((c) => c.percorso)).forEach((r, i) => { serie[i].atteso = r; serie[i].dati = fs.readFileSync(serie[i].percorso); });
    assert.ok(serie.filter((c) => !c.atteso.ok).length >= 5 && serie.filter((c) => c.atteso.ok).length >= 20, 'la serie non ha abbastanza casi rifiutati e puliti');
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wdm-agent-svg-'));
    // Una sessione di dieci minuti per l'amministratore di prova: i due cookie che il browser avrebbe.
    cookie = php(`$u = get_user_by( "login", "${sito.ADMIN}" ); $fine = time() + 600; $t = WP_Session_Tokens::get_instance( $u->ID )->create( $fine ); echo SECURE_AUTH_COOKIE . "=" . wp_generate_auth_cookie( $u->ID, $fine, "secure_auth", $t ) . "; " . LOGGED_IN_COOKIE . "=" . wp_generate_auth_cookie( $u->ID, $fine, "logged_in", $t );`).trim();
  });

  after(() => {
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
    sito.reset();
  });

  describe('caricamento', () => {
    it('WP-CLI (wp media import): la serie esce pulita o è rifiutata', () => {
      const file = serie.map((c) => path.join(tmp, `cli-${c.file}`));
      serie.forEach((c, i) => fs.writeFileSync(file[i], c.dati));
      const r = sito.wp(['media', 'import', ...file, '--user=' + sito.ADMIN, '--porcelain']);
      const esiti = {};
      serie.forEach((c, i) => {
        const m = new RegExp(`Unable to import file '${file[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'\\. Reason: (.*)`).exec(r.stderr);
        esiti[c.file] = m ? { ok: false, messaggio: m[1] } : { ok: true };
      });
      verifica('cli', esiti);
    });

    it('REST in multipart (l\'editor a blocchi): la serie esce pulita o è rifiutata', async () => {
      const nonce = (await richiesta('GET', 'wp-admin/admin-ajax.php?action=rest-nonce')).body.trim();
      assert.match(nonce, /^[a-f0-9]{10}$/, 'la sessione di prova non è stata accettata dal sito');
      const esiti = {};
      for (const c of serie) {
        const r = await richiesta('POST', '?rest_route=/wp/v2/media', { ...((m) => ({ headers: { ...m.headers, 'X-WP-Nonce': nonce }, body: m.body }))(multipart({}, 'file', `rest-${c.file}`, c.dati)) });
        const json = JSON.parse(r.body);
        esiti[c.file] = r.status === 201 ? { ok: true } : { ok: false, messaggio: json.message };
      }
      verifica('rest', esiti);
    });

    it('REST con il file come corpo della richiesta: la serie esce pulita o è rifiutata', async () => {
      const nonce = (await richiesta('GET', 'wp-admin/admin-ajax.php?action=rest-nonce')).body.trim();
      const esiti = {};
      for (const c of serie) {
        const r = await richiesta('POST', '?rest_route=/wp/v2/media', { headers: { 'X-WP-Nonce': nonce, 'Content-Type': 'image/svg+xml', 'Content-Disposition': `attachment; filename="corpo-${c.file}"` }, body: c.dati });
        const json = JSON.parse(r.body);
        esiti[c.file] = r.status === 201 ? { ok: true } : { ok: false, messaggio: json.message };
      }
      verifica('corpo', esiti);
    });

    it('libreria media (async-upload.php): la serie esce pulita o è rifiutata', async () => {
      // La pagina della libreria porta il nonce con cui il suo caricatore invia i file.
      const pagina = await richiesta('GET', 'wp-admin/upload.php');
      const m = /"action":"upload-attachment","_wpnonce":"([a-f0-9]+)"/.exec(pagina.body);
      assert.ok(m, 'upload.php non ha il nonce del caricamento: sessione non accettata?');
      const esiti = {};
      for (const c of serie) {
        const r = await richiesta('POST', 'wp-admin/async-upload.php', multipart({ action: 'upload-attachment', _wpnonce: m[1], name: `libreria-${c.file}` }, 'async-upload', `libreria-${c.file}`, c.dati));
        const json = JSON.parse(r.body);
        esiti[c.file] = json.success ? { ok: true } : { ok: false, messaggio: json.data.message };
      }
      verifica('libreria', esiti);
    });

    it('i metadati dell\'allegato portano le misure del viewBox, per ogni strada', () => {
      const trovati = allegati();
      for (const strada of ['cli', 'rest', 'corpo', 'libreria']) {
        assert.equal(php(`$m = wp_get_attachment_metadata( ${trovati[`${strada}-gradienti.svg`].id} ); echo $m["width"], "x", $m["height"];`), '100x50', strada);
      }
    });

    it('SVGZ: rifiutato, con cosa fare', () => {
      const file = path.join(tmp, 'compresso.svgz');
      fs.writeFileSync(file, require('node:zlib').gzipSync(serie.find((c) => c.file === 'figma.svg').dati));
      const r = sito.wp(['media', 'import', file, '--user=' + sito.ADMIN]);
      assert.notEqual(r.status, 0, r.out);
      assert.match(r.out, /SVGZ.*non sono ammessi.*Esporta/);
      assert.ok(!allegati()['compresso.svgz']);
    });

    it('chi non può scrivere HTML libero non carica SVG: un autore, e WP-CLI senza utente', () => {
      assert.equal(sito.wp(['user', 'create', 'autore', 'autore@example.com', '--role=author', '--quiet']).status, 0);
      const file = path.join(tmp, 'autore.svg');
      fs.writeFileSync(file, serie.find((c) => c.file === 'figma.svg').dati);
      for (const utente of [['--user=autore'], []]) {
        const r = sito.wp(['media', 'import', file, ...utente]);
        assert.notEqual(r.status, 0, r.out);
        assert.match(r.out, /Non hai i permessi per caricare file SVG/);
      }
      assert.ok(!allegati()['autore.svg']);
    });
  });

  describe('wdm_render_svg()', () => {
    let figma, gradienti, immagine;
    const stampa = (id, argomenti = '') => php(`echo wdm_render_svg( ${id}${argomenti ? `, ${argomenti}` : ''} );`);
    // Un allegato SVG nato senza passare dal caricamento: il file è scritto in uploads così com'è.
    const diretto = (nome, dati) => {
      const file = path.join(cfg.site, 'wp-content', 'uploads', nome);
      fs.writeFileSync(file, dati);
      return Number(php(`echo wp_insert_attachment( array( "post_title" => "diretto", "post_mime_type" => "image/svg+xml", "post_status" => "inherit" ), ${JSON.stringify(file)} );`));
    };

    before(() => {
      const trovati = allegati();
      figma = trovati['cli-figma.svg'].id;
      gradienti = trovati['cli-gradienti.svg'].id;
      immagine = Number(sito.wp(['media', 'import', path.join(tema, 'assets', 'img', 'placeholder-2000x1150.jpg'), '--porcelain']).stdout.trim());
    });

    it('un SVG della libreria: span decorativo con l\'SVG dentro, senza misure sulla radice', () => {
      const html = stampa(figma, 'array( "class" => "blocco__icon" )');
      assert.match(html, /^<span class="blocco__icon" aria-hidden="true"><svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" class="wdm-svg" viewBox="0 0 48 48"/);
      assert.doesNotMatch(html.slice(0, html.indexOf('>', 60)), /\s(width|height)=/);
      assert.match(html, /<\/svg><\/span>$/);
      assert.deepEqual(svg.contenutoAttivo(html.replace(/^<span[^>]*>|<\/span>$/g, '')), []);
    });

    it('niente da stampare: id 0, id che non esiste, allegato che non è un SVG', () => {
      for (const id of [0, 999999, immagine]) assert.equal(stampa(id), '');
    });

    it('con un nome: role="img" e aria-label, senza aria-hidden', () => {
      const html = stampa(figma, 'array( "label" => "Logo \\"Rossi\\"" )');
      assert.match(html, /^<span role="img" aria-label="Logo &quot;Rossi&quot;"><svg /);
      assert.doesNotMatch(html, /aria-hidden/);
    });

    it('colori originali: la classe che spegne la regola di colore', () => {
      assert.match(stampa(figma, 'array( "original_colors" => true )'), /<svg xmlns="[^"]+" class="wdm-svg wdm-svg--original"/);
    });

    it('lo stesso SVG stampato due volte: id diversi, ognuno punta ai suoi', () => {
      const html = php(`echo wdm_render_svg( ${gradienti} ), "\\n", wdm_render_svg( ${gradienti} );`).split('\n');
      const id = html.map((h) => [...h.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
      assert.ok(id[0].length >= 3, html[0]);
      assert.equal(id[0].filter((x) => id[1].includes(x)).length, 0, 'le due stampe hanno id in comune');
      html.forEach((h, i) => { for (const m of h.matchAll(/url\(#([^)]+)\)|href="#([^"]+)"/g)) assert.ok(id[i].includes(m[1] || m[2]), `stampa ${i + 1}: riferimento a un id che non è suo`); });
    });

    it('file arrivato in uploads senza passare dal filtro: esce pulito', () => {
      const id = diretto('sporco.svg', serie.find((c) => c.file === 'eventi.svg').dati);
      const html = stampa(id);
      assert.match(html, /<svg [^>]*class="wdm-svg"/);
      assert.deepEqual(svg.contenutoAttivo(html.replace(/^<span[^>]*>|<\/span>$/g, '')), []);
      assert.doesNotMatch(html, /colpito/);
    });

    it('file che il pulitore rifiuta: non si stampa nulla', () => {
      assert.equal(stampa(diretto('entita.svg', serie.find((c) => c.file === 'entita-esterna.svg').dati)), '');
      assert.equal(stampa(diretto('non-svg.svg', Buffer.from('<html><body onload="alert(1)"></body></html>'))), '');
    });

    it('file fuori da uploads, o che non finisce in .svg: non si stampa nulla', () => {
      const fuori = path.join(tema, 'assets', 'img', 'icons', 'blocks.svg');
      const id = diretto('dentro.svg', serie.find((c) => c.file === 'figma.svg').dati);
      assert.notEqual(stampa(id), '');
      for (const percorso of [fuori, '../themes/wdm-theme/assets/img/icons/blocks.svg']) {
        php(`update_post_meta( ${id}, "_wp_attached_file", ${JSON.stringify(percorso)} );`);
        assert.equal(stampa(id), '', percorso);
      }
      fs.copyFileSync(fuori, path.join(cfg.site, 'wp-content', 'uploads', 'icona.txt'));
      php(`update_post_meta( ${id}, "_wp_attached_file", "icona.txt" );`);
      assert.equal(stampa(id), '');
    });

    it('oltre 64 KB: un <img>, non la stampa inline', () => {
      const grande = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${'<path d="M0 0h1v1z"/>'.repeat(3500)}</svg>`);
      assert.ok(grande.length > 65536 && grande.length < 1048576);
      const html = stampa(diretto('grande.svg', grande), 'array( "class" => "blocco__icon" )');
      assert.match(html, /^<span class="blocco__icon" aria-hidden="true"><img src="[^"]+\/grande\.svg" alt="" loading="lazy" decoding="async"><\/span>$/);
    });

  });

  // Gli SVG entrati in libreria prima del pulitore, o senza passare dal caricamento: lo script
  // del tema li elenca e, solo se glielo si chiede, li riscrive.
  describe('tools/svg-libreria.php', () => {
    const scansione = (...argomenti) => sito.wp(['eval-file', path.join(tema, 'tools', 'svg-libreria.php'), ...argomenti, '--user=' + sito.ADMIN]);
    const inUploads = (nome) => path.join(cfg.site, 'wp-content', 'uploads', nome);
    const riga = (testo, nome) => testo.split('\n').find((r) => r.includes(nome)) || '';

    it('elenca: pulito, da pulire con ciò che perde, non stampabile con il motivo; non tocca i file', () => {
      const prima = fs.readFileSync(inUploads('sporco.svg'), 'utf8');
      const r = scansione();
      assert.equal(r.status, 0, r.out);
      assert.match(riga(r.stdout, 'cli-figma.svg'), /\bpulito$/);
      assert.match(riga(r.stdout, 'sporco.svg'), /da pulire: perde .*@onclick/);
      assert.match(riga(r.stdout, 'entita.svg'), /non stampabile: .*DOCTYPE/);
      assert.match(r.stdout, /^Da pulire: 1\b.*riscrivi/m);
      assert.equal(fs.readFileSync(inUploads('sporco.svg'), 'utf8'), prima, 'l\'elenco ha modificato un file');
    });

    it('riscrivi: pulisce ciò che è da pulire, lascia il resto; il secondo elenco non ha più nulla da pulire', () => {
      const rifiutato = fs.readFileSync(inUploads('entita.svg'), 'utf8');
      const r = scansione('riscrivi');
      assert.equal(r.status, 0, r.out);
      assert.match(riga(r.stdout, 'sporco.svg'), /riscritto/);
      const dopo = fs.readFileSync(inUploads('sporco.svg'), 'utf8');
      assert.deepEqual(svg.contenutoAttivo(dopo), []);
      assert.doesNotMatch(dopo, /colpito/);
      assert.equal(fs.readFileSync(inUploads('entita.svg'), 'utf8'), rifiutato, 'un file che il pulitore rifiuta è stato toccato');
      const secondo = scansione();
      assert.match(riga(secondo.stdout, 'sporco.svg'), /\bpulito$/);
      assert.match(secondo.stdout, /^Da pulire: 0\b/m);
    });

    it('un argomento sconosciuto: errore, nessuna scrittura', () => {
      const r = scansione('cancella');
      assert.notEqual(r.status, 0, r.out);
      assert.match(r.out, /riscrivi/);
    });
  });

  describe('alla fine', () => {
    it('nessun avviso in debug.log', () => {
      const log = path.join(cfg.site, 'wp-content', 'debug.log');
      assert.equal(fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : '', '');
    });
  });
});
