#!/usr/bin/env node
// Controllo di un'unità di lavoro: dice in poche righe se il progetto è nello stato che il suo
// DESIGN.md dichiara. Lo lancia la conversazione principale dopo un kit o una build eseguiti in
// un sotto-agente: il verdetto non viene dal resoconto di chi ha lavorato.
//
//   node controllo.js <site-root>
//
// Che cosa aspettarsi lo legge da DESIGN.md (non ha modalità): ogni pagina `implementata` deve
// essere ciò che il suo kit dice; un kit in revisione (riga ⏳ in ## Domande aperte) deve essere
// mappabile dalla build, e finché il gate è aperto i suoi file non sono ancora committati.
// Non scrive mai in WordPress: le pagine si confrontano con `wp-page.php plan`, i menu con
// `wp-navigation.php apply … prova`, e un'immagine del kit che manca in libreria non si importa
// (`kit-pagina.js … sola-lettura`). Nel tema lancia la build e i controlli di package.json.
// Il controllo dell'editor (blocchi non validi) chiede il browser e resta a chi esegue l'unità.
//
// Uscita: una riga per criterio (PASS, FAIL o NOTA: una nota è un fatto da sapere, non un
// difetto: una pagina modificata a mano, una cancellazione che aspetta il confirm del dev) e una
// riga di verdetto.
// Exit: 0 unità buona · 1 non buona · 2 uso, o la cartella non è un progetto · 3 non ha potuto
// verificare (WordPress fermo, DESIGN.md senza pagine), e dice perché.

'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const os = require('node:os');
const path = require('node:path');

const { valore, eFse, argomenti, tabella } = require('./lib/design-md.js');

const USO = 'uso: node controllo.js <site-root>';
const PLUGIN = path.join(__dirname, '..', '..');
const KIT_PAGINA = path.join(PLUGIN, 'skills', 'fse-build', 'scripts', 'kit-pagina.js');
const WP_PAGE = path.join(PLUGIN, 'skills', 'fse-build', 'scripts', 'wp-page.php');
const WP_NAV = path.join(PLUGIN, 'skills', 'fse-menu-build', 'scripts', 'wp-navigation.php');
const PARITA = path.join(__dirname, 'parita.js');
const CONTRATTO = path.join(PLUGIN, 'hooks', 'check-block-contract.js');
const SEZIONI = ['Scopo', 'Varianti', 'Attributi', 'Figli', 'Markup (render.php = kit)', 'Markup di inserimento', 'Dipendenze JS / CSS', 'Componenti condivisi'];
const AVVISI_PHP = /<b>(Fatal error|Parse error|Warning|Notice|Deprecated)<\/b>:|\b(Fatal error|Warning|Notice|Deprecated): /g;

class Errore extends Error {
  constructor(messaggio, exit) {
    super(messaggio);
    this.exit = exit;
  }
}

// ---------- che cosa aspettarsi, e il verdetto ----------

// { pagine: [{ titolo, percorso, stato, kit }], revisione: [item], build: [riga], conferme: [riga] }
// `build` sono le righe di una build in corso (`⏳ build sito: pagina … M/N`): a unità finita
// vuol dire che si è fermata a metà. `conferme` sono le righe ⏳ che aspettano un `confirm` del
// dev, comunque siano scritte: un'attesa, non un difetto.
// `kit` è il nome del kit senza prefisso (home → html/{prefix}-home.html), o null.
function attese(design, prefisso) {
  const pagine = tabella(design, 'Pagine').map((r) => {
    const kit = /([^\s`/]+)\.kit\b/.exec(r.kit || '');
    return {
      titolo: r.pagina,
      percorso: (r.url || '/').replace(/`/g, ''),
      stato: r.stato,
      kit: kit ? (kit[1].startsWith(`${prefisso}-`) ? kit[1].slice(prefisso.length + 1) : kit[1]) : null,
    };
  });
  const righe = design.split(/\r?\n/);
  const inizio = righe.findIndex((r) => r.trim() === '## Domande aperte');
  const aperte = [];
  for (let i = inizio + 1; inizio !== -1 && i < righe.length && !/^## /.test(righe[i]); i++) aperte.push(righe[i]);
  return {
    pagine,
    revisione: aperte.flatMap((r) => { const m = /⏳ kit (.+?) in revisione/.exec(r); return m ? [m[1].trim()] : []; }),
    build: aperte.filter((r) => r.includes('⏳ build sito') && !/confirm/i.test(r)).map((r) => r.trim()),
    conferme: aperte.filter((r) => r.includes('⏳') && /confirm/i.test(r)).map((r) => r.trim()),
  };
}

function riga(esito, nome, testo) {
  const intera = `${esito.padEnd(4)}  ${nome}: ${String(testo).replace(/\s+/g, ' ').trim()}`;
  return intera.length > 320 ? `${intera.slice(0, 319)}…` : intera;
}

function verdetto(righe) {
  const di = (esito) => righe.filter((r) => r.startsWith(esito));
  const falliti = di('FAIL');
  const conta = (n, uno, molti) => `${n} ${n === 1 ? uno : molti}`;
  if (falliti.length) {
    const nomi = falliti.map((r) => r.slice(6, r.indexOf(':')));
    return { exit: 1, testo: `UNITÀ NON BUONA: ${conta(falliti.length, 'controllo non passa', 'controlli non passano')} (${nomi.join(', ')}).` };
  }
  const note = di('NOTA').length;
  return { exit: 0, testo: `UNITÀ BUONA: ${conta(di('PASS').length, 'controllo passa', 'controlli passano')}${note ? `, ${conta(note, 'nota', 'note')}` : ''}.` };
}

// ---------- strumenti ----------

function lancia(programma, args, opzioni = {}) {
  const r = spawnSync(programma, args, { encoding: 'utf8', timeout: 300000, maxBuffer: 256 * 1024 * 1024, ...opzioni });
  const out = `${r.stdout || ''}${r.stderr || ''}`.trim();
  return { status: r.error ? null : r.status, out: r.error ? r.error.message : out, stdout: (r.stdout || '').trim() };
}

const prima = (testo) => (testo.split('\n').find((r) => r.trim()) || '').trim();

// Uno script di package.json, senza npm e senza shell: una catena di `node …` unita da `&&`.
function script(tema, nome) {
  let comandi;
  try {
    comandi = JSON.parse(fs.readFileSync(path.join(tema, 'package.json'), 'utf8')).scripts[nome];
  } catch {
    comandi = null;
  }
  if (typeof comandi !== 'string') return { status: null, out: `package.json del tema non ha lo script «${nome}»` };
  let out = '';
  for (const pezzo of comandi.split('&&').map((p) => argomenti(p.trim()))) {
    if (pezzo[0] !== 'node') return { status: null, out: `script «${nome}»: «${pezzo.join(' ')}» non è un comando node` };
    const r = lancia(process.execPath, pezzo.slice(1), { cwd: tema });
    out += `${r.out}\n`;
    if (r.status !== 0) return { status: r.status, out: out.trim() };
  }
  return { status: 0, out: out.trim() };
}

// { status, body } o null. Il certificato del sito locale non si verifica; un reindirizzamento
// (la barra finale) si segue.
function scarica(url, salti = 3) {
  return new Promise((resolve) => {
    const client = url.startsWith('https:') ? https : http;
    const req = client.get(url, { rejectUnauthorized: false, timeout: 20000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && salti > 0) {
        res.resume();
        resolve(scarica(new URL(res.headers.location, url).href, salti - 1));
        return;
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (pezzo) => { body += pezzo; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve(null));
  });
}

const h1 = (html) => (html.match(/<h1[\s>]/g) || []).length;

// ---------- il controllo ----------

async function controlla(sitoDato) {
  const sito = path.resolve(sitoDato);
  const designMd = path.join(sito, 'DESIGN.md');
  if (!fs.existsSync(designMd)) throw new Errore(`In ${sito} non c'è DESIGN.md: non è la cartella di un progetto.`, 2);
  const design = fs.readFileSync(designMd, 'utf8');
  if (!eFse(design)) throw new Errore(`${designMd} non è di un progetto wdm-theme (riga theme_family).`, 2);
  const leggi = (nome) => {
    const v = valore(design, nome);
    if (!v) throw new Errore(`In DESIGN.md → Project Config manca la riga \`${nome}\`: la scrive il setup del progetto (fse-theme-setup).`, 2);
    return v;
  };
  const prefisso = leggi('{prefix}');
  const tema = path.join(sito, 'wp-content', 'themes', leggi('{theme-folder}'));
  const url = leggi('{local-url}').replace(/\/+$/, '');
  const agente = leggi('{agent-admin-user}');
  const [php, ...restoWp] = argomenti(leggi('{wp-cli}'));
  const wp = (...args) => lancia(php, [...restoWp, ...args], { cwd: sito });

  const a = attese(design, prefisso);
  if (!a.pagine.length) throw new Errore('DESIGN.md → ## Pagine non ha righe: non c\'è nulla da verificare.', 3);
  const casa = wp('option', 'get', 'home');
  if (casa.status !== 0) throw new Errore(`WordPress non risponde: avvia i server di MAMP PRO e rilancia. (${prima(casa.out)})`, 3);

  const righe = [];
  const esito = (nome, falliti, note, bene) => righe.push(falliti.length ? riga('FAIL', nome, falliti.join(' · ')) : note.length ? riga('NOTA', nome, [bene, ...note].filter(Boolean).join(' · ')) : riga('PASS', nome, bene));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wdm-agent-controllo-'));
  const implementate = a.pagine.filter((p) => p.stato === 'implementata');
  try {
    // 1. Il tema: build e controlli di package.json.
    {
      const build = script(tema, 'build');
      const check = build.status === 0 ? script(tema, 'check') : { status: null, out: '' };
      const falliti = [];
      if (build.status !== 0) falliti.push(`build exit ${build.status}: ${prima(build.out.split('\n').reverse().join('\n'))}`);
      else if (check.status !== 0) falliti.push(`check exit ${check.status}: ${check.out.split('\n').filter((r) => /FAIL/.test(r)).join(' / ') || prima(check.out)}`);
      const saltati = check.out.split('\n').filter((r) => /^SKIP/.test(r.trim())).map((r) => `saltato: ${r.trim().replace(/^SKIP\s*/, '')}`);
      esito('Tema', falliti, saltati, 'build e controlli a 0');
    }

    // 2. Ogni pagina implementata è ciò che il suo kit dice.
    const usati = new Set();
    {
      const falliti = [];
      const note = [];
      const uguali = [];
      for (const p of implementate) {
        if (!p.kit) { falliti.push(`${p.titolo}: la riga non ha un kit`); continue; }
        const rif = p.percorso.replace(/^\/+|\/+$/g, '') || wp('option', 'get', 'page_on_front').stdout;
        if (!rif || rif === '0') { falliti.push(`${p.titolo}: il sito non ha una pagina in front`); continue; }
        const file = path.join(tmp, `page-${p.kit}.html`);
        const g = lancia(process.execPath, [KIT_PAGINA, sito, p.kit, file, `page=${rif}`, 'sola-lettura']);
        if (g.status !== 0) { falliti.push(`${p.titolo}: ${prima(g.out)}`); continue; }
        for (const m of fs.readFileSync(file, 'utf8').matchAll(/<!-- wp:([a-z0-9-]+\/[a-z0-9-]+)/g)) usati.add(m[1]);
        const piano = wp('eval-file', WP_PAGE, 'plan', file, `page=${rif}`);
        if (piano.status === 0) uguali.push(p.titolo);
        else if (piano.status === 6) note.push(`${p.titolo}: modificata a mano in WordPress, i suoi contenuti restano quelli di WordPress`);
        else if (piano.status === 3) note.push(`${p.titolo}: una cancellazione aspetta il confirm del dev (${prima(piano.out)})`);
        else falliti.push(`${p.titolo} diversa dal kit: ${prima(piano.out)}`);
      }
      esito('Pagine', falliti, note, `${uguali.length} uguali al loro kit${uguali.length ? ` (${uguali.join(', ')})` : ''}`);
    }

    // 3. Un kit in revisione è una pagina che la build saprà mappare.
    if (a.revisione.length) {
      const falliti = [];
      const bene = [];
      for (const item of a.revisione) {
        const p = a.pagine.find((x) => x.titolo.toLowerCase() === item.toLowerCase());
        if (!p || !p.kit) { bene.push(`${item}: si guarda sull'anteprima`); continue; }
        const r = lancia(process.execPath, [KIT_PAGINA, sito, p.kit, 'controlla']);
        if (r.status === 0) bene.push(`${item}: mappabile dalla build`);
        else falliti.push(`${item}: ${r.out.split('\n').slice(0, 3).join(' ')}`);
      }
      esito('Kit in revisione', falliti, [], bene.join(' · '));
    }

    // 4. Il sito: ogni pagina implementata risponde, senza avvisi di PHP, con un solo h1.
    {
      const falliti = [];
      for (const p of implementate) {
        const servita = await scarica(`${url}${p.percorso.startsWith('/') ? '' : '/'}${p.percorso}`);
        if (!servita) { falliti.push(`${p.titolo}: non risponde`); continue; }
        if (servita.status !== 200) { falliti.push(`${p.titolo}: risponde ${servita.status}`); continue; }
        const avvisi = (servita.body.match(AVVISI_PHP) || []).length;
        if (avvisi) falliti.push(`${p.titolo}: ${avvisi} avvisi di PHP nella pagina`);
        if (h1(servita.body) !== 1) falliti.push(`${p.titolo}: ${h1(servita.body)} h1 nella pagina`);
        const kit = p.kit && path.join(tema, 'html', `${prefisso}-${p.kit}.html`);
        if (kit && fs.existsSync(kit) && h1(fs.readFileSync(kit, 'utf8')) !== 1) falliti.push(`${p.titolo}: ${h1(fs.readFileSync(kit, 'utf8'))} h1 nel kit`);
      }
      const log = path.join(sito, 'wp-content', 'debug.log');
      const byte = fs.existsSync(log) ? fs.statSync(log).size : 0;
      if (byte) falliti.push(`debug.log non è vuoto (${byte} byte)`);
      esito('Sito', falliti, [], `${implementate.length} pagine rispondono, senza avvisi di PHP, con un h1; debug.log vuoto`);
    }

    // 5. I blocchi: quelli usati sono registrati, ogni cartella ha il suo contratto.
    {
      const falliti = [];
      const registro = wp('eval', 'echo implode(",", array_keys(WP_Block_Type_Registry::get_instance()->get_all_registered()));').stdout.split(',');
      const ignoti = [...usati].filter((n) => n.startsWith(`${prefisso}/`) && !registro.includes(n));
      if (ignoti.length) falliti.push(`non registrati: ${ignoti.join(', ')}`);
      const cartella = path.join(tema, 'blocks');
      const blocchi = fs.existsSync(cartella) ? fs.readdirSync(cartella, { withFileTypes: true }).filter((e) => e.isDirectory() && e.name.startsWith(`${prefisso}-block-`)).map((e) => e.name) : [];
      for (const nome of blocchi) {
        const readme = path.join(cartella, nome, 'README.md');
        const testo = fs.existsSync(readme) ? fs.readFileSync(readme, 'utf8') : '';
        const mancanti = SEZIONI.filter((s) => !testo.includes(`## ${s}`));
        if (mancanti.length) falliti.push(`${nome}: README senza ${mancanti.join(', ')}`);
        const json = path.join(cartella, nome, 'block.json');
        if (!fs.existsSync(json)) continue;
        const hook = lancia(process.execPath, [CONTRATTO], { input: JSON.stringify({ cwd: sito, tool_input: { file_path: json } }) });
        if (hook.status !== 0) falliti.push(`${nome}: ${prima(hook.out)}`);
      }
      esito('Blocchi', falliti, [], `${blocchi.length} con il loro contratto; quelli usati nelle pagine sono registrati`);
    }

    // 6. Parità di struttura tra kit e sito.
    {
      const r = lancia(process.execPath, [PARITA, sito]);
      esito('Parità', r.status === 0 && r.out === '' ? [] : [r.out.split('\n').slice(0, 3).join(' ') || `parita.js exit ${r.status}`], [], 'kit e sito hanno la stessa struttura');
    }

    // 7. I menu sono quelli del kit del telaio: confronto senza scrittura.
    {
      const kit = (parte) => path.join(tema, 'src', 'kit', 'main', parte, `${parte}-parts`, `_${parte}-content.kit`);
      const piano = wp('eval-file', WP_NAV, 'plan', `header=${kit('header')}`, `footer=${kit('footer')}`);
      const falliti = [];
      const note = [];
      let quanti = 0;
      if (piano.status !== 0) {
        falliti.push(`piano dei menu non calcolato: ${prima(piano.out)}`);
      } else {
        const file = path.join(tmp, 'nav-plan.json');
        fs.writeFileSync(file, piano.stdout);
        const prova = wp('eval-file', WP_NAV, 'apply', file, 'prova');
        quanti = prova.out.split('\n').filter((r) => /0 differenze$/.test(r.trim())).length;
        // Un pezzo per menu diverso: la sua riga, poi il diff. Dove WordPress perderebbe qualcosa
        // il menu non si riallinea da solo: aspetta il confirm del dev, e non è un difetto.
        const pezzi = prova.out.split(/\n(?=\S.*(?:: differenze kit → WP|: da creare)$)/m).filter((p) => /^\S.*(: differenze kit → WP|: da creare)$/m.test(p.split('\n')[0]));
        for (const pezzo of pezzi) {
          const nome = pezzo.split('\n')[0].trim().replace(/: differenze kit → WP$/, '');
          const perdita = /WordPress perderebbe: (.*)$/m.exec(pezzo);
          if (perdita) note.push(`${nome} aspetta il confirm del dev: perderebbe ${perdita[1].trim()}`);
          else falliti.push(/: da creare$/.test(nome) ? nome : `${nome} diverso dal kit`);
        }
        if (prova.status !== 0 && prova.status !== 5) falliti.push(`confronto dei menu exit ${prova.status}: ${prima(prova.out)}`);
        else if (prova.status === 5 && !pezzi.length) falliti.push(`menu diversi dal kit: ${prima(prova.out)}`);
      }
      esito('Menu', falliti, note, `${quanti} a 0 differenze dal kit`);
    }

    // 8. Nessuna sessione dell'utente agente rimasta aperta.
    {
      const falliti = [];
      if (!/^[A-Za-z0-9_.@-]+$/.test(agente)) {
        falliti.push(`{agent-admin-user} non è un nome utente: ${agente}`);
      } else {
        const r = wp('eval', `$u = get_user_by("login", "${agente}"); if (!$u) { echo "assente"; return; } global $wpdb; echo count(WP_Session_Tokens::get_instance($u->ID)->get_all()) . ":" . (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM $wpdb->postmeta WHERE meta_key = '_edit_lock' AND meta_value LIKE %s", "%:" . $u->ID));`);
        const m = /^(\d+):(\d+)$/.exec(r.stdout.split('\n').pop() || '');
        if (r.stdout === 'assente') falliti.push(`l'utente agente ${agente} non esiste in WordPress`);
        else if (!m) falliti.push(`sessioni non lette: ${prima(r.out)}`);
        else if (m[1] !== '0' || m[2] !== '0') falliti.push(`${m[1]} sessioni dell'utente agente aperte, ${m[2]} pagine con il suo blocco di modifica: le chiude sessione.js chiudi`);
      }
      if (fs.existsSync(path.join(sito, '.playwright-mcp', '_sessione.json'))) falliti.push('resta il segno di una sessione aperta (.playwright-mcp/_sessione.json)');
      esito('Sessione', falliti, [], "nessuna sessione dell'utente agente aperta");
    }

    // 9. Lo stato dichiarato in DESIGN.md.
    {
      const approvate = a.pagine.filter((p) => p.stato === 'kit').map((p) => p.titolo);
      esito('Stato', a.build.map((r) => `una build è rimasta a metà: «${r.replace(/^[-*]\s*/, '')}»`),
        [...a.conferme.map((r) => `aspetta il confirm del dev: ${r.replace(/^[-*]\s*/, '').replace(/^⏳\s*(confirm:|build sito:)?\s*/, '').slice(0, 110)}`), ...(approvate.length ? [`approvate e non ancora costruite: ${approvate.join(', ')}`] : [])],
        `${implementate.length} pagine implementate, ${a.pagine.filter((p) => p.stato === 'da progettare').length} da progettare; ${a.revisione.length ? `gate aperto: kit ${a.revisione.join(', ')}` : 'nessun gate aperto'}`);
    }

    // 10. Git: tutto committato, salvo un kit che aspetta l'ok.
    {
      const git = (...args) => lancia('git', ['-C', sito, ...args]);
      const falliti = [];
      const note = [];
      let bene = 'albero pulito';
      if (git('rev-parse', '--is-inside-work-tree').stdout !== 'true') {
        falliti.push('la cartella del progetto non è un repository git');
      } else {
        const sporchi = git('status', '--porcelain').stdout.split('\n').filter(Boolean);
        if (sporchi.length && a.revisione.length) note.push(`${sporchi.length} file non committati: è atteso, il kit in revisione si committa all'ok`);
        else if (sporchi.length) falliti.push(`${sporchi.length} file non committati: ${sporchi.slice(0, 3).map((r) => r.slice(3)).join(', ')}${sporchi.length > 3 ? '…' : ''}`);
        const diWordPress = git('ls-files').stdout.split('\n').filter((f) => /^(wp-admin|wp-includes)\/|^wp-config\.php$|(^|\/)\.playwright-mcp\//.test(f));
        if (diWordPress.length) falliti.push(`${diWordPress.length} file di WordPress o di lavoro tracciati (${diWordPress[0]}…)`);
        if (sporchi.length) bene = '';
      }
      esito('Git', falliti, note, bene);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  const v = verdetto(righe);
  console.log([...righe, v.testo].join('\n'));
  return v.exit;
}

module.exports = { attese, riga, verdetto };

if (require.main === module) {
  const [sito, ...resto] = process.argv.slice(2);
  if (!sito || resto.length) {
    console.error(USO);
    process.exitCode = 2;
  } else {
    controlla(sito).then((exit) => { process.exitCode = exit; }).catch((errore) => {
      if (!(errore instanceof Errore)) throw errore;
      console.error(`controllo: ${errore.exit === 3 ? 'non verificato — ' : ''}${errore.message}`);
      process.exitCode = errore.exit;
    });
  }
}
