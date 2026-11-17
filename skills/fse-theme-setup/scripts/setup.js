#!/usr/bin/env node
// setup.js — trasforma il tema base wdm-theme nel tema di un progetto nuovo.
//
//   node setup.js --prefix <p> --slug <s> --textdomain <td> --title <Titolo> --local-url <url> --target <site-root>
//
//   --prefix      prefisso minuscolo senza trattini (es. abc): sostituisce «wdm» ovunque
//   --slug        nome della cartella del tema, kebab-case (es. pincopallino)
//   --textdomain  text domain (di solito uguale allo slug): sostituisce «wdm-theme»
//   --title       titolo del progetto (es. "Pinco Pallino"): sostituisce «WDM Theme»
//   --local-url   indirizzo locale del sito, con la barra finale (proxy di build.js)
//   --target      la site root (contiene wp-content/)
//
// Cosa fa, nell'ordine: controlla tutti i valori prima di toccare il disco; toglie i file
// generati (li ricrea npm run build) e i kit di pagina dimostrativi del tema base; sostituisce
// prefisso, text domain e titolo in ogni file di testo del tema; mette formId a 0 nelle parts;
// rinomina cartelle e file che portano il prefisso; imposta il proxy di build.js; aggiorna
// .gitignore, README.md e DESIGN.md della site root; per ultima rinomina la cartella del tema;
// infine controlla che non restino riferimenti a «wdm».
//
// Ogni passo si può ripetere: se lo script si interrompe, rilanciarlo con gli stessi valori
// riprende; a lavoro già finito rifà solo il controllo ed esce con 0. CLAUDE.md non si tocca
// (legge prefisso e percorsi da DESIGN.md). Non esegue mai git.
//
// Exit: 0 fatto · 1 interrotto o riferimenti rimasti (il messaggio dice cosa fare) ·
// 2 errore d'uso o valori non validi · 3 tema base non trovato, o due temi tra cui non sa scegliere.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const USO = 'uso: node setup.js --prefix <p> --slug <s> --textdomain <td> --title <Titolo> --local-url <url> --target <site-root>';
const BASE = 'wdm-theme';
// Nomi che contengono «wdm» ma non sono il prefisso del tema: restano come sono.
const PROTETTI = ['carlogatto/wdm-theme', 'wdm-agent', 'wdm-starter'];
// Kit del tema base che restano al progetto: il catalogo dei blocchi e il telaio.
const KIT_TENUTI = ['wdm-blocks.kit', 'wdm-telaio.kit'];
const SALTATE = ['node_modules', '.git'];
const LOCK = 'package-lock.json';
const NOME_NEL_LOCK = /^\s*"name":/;
const U = `${String.fromCharCode(92)}u`;

// ─── Valori ──────────────────────────────────────────────────────────────────────────────────

// Elenco degli errori, vuoto se i valori vanno bene. Tutti insieme, prima di toccare il disco.
function valida(v) {
  const errori = [];
  const haWdm = (testo) => /wdm/i.test(testo);
  if (!/^[a-z][a-z0-9]*$/.test(v.prefix || '') || haWdm(v.prefix)) {
    errori.push(`--prefix: lettere minuscole e cifre, inizia con una lettera, senza "wdm" (ricevuto: ${JSON.stringify(v.prefix || '')}). Esempio: abc`);
  }
  for (const nome of ['slug', 'textdomain']) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v[nome] || '') || haWdm(v[nome])) {
      errori.push(`--${nome}: minuscolo, parole separate da trattini, senza "wdm" (ricevuto: ${JSON.stringify(v[nome] || '')}). Esempio: pinco-pallino`);
    }
  }
  if (!/^https?:\/\/[A-Za-z0-9.-]+(:\d+)?\/$/.test(v['local-url'] || '')) {
    errori.push(`--local-url: un indirizzo http o https con la barra finale (ricevuto: ${JSON.stringify(v['local-url'] || '')}). Esempio: https://pinco-pallino.local:8890/`);
  }
  const titolo = v.title || '';
  // eslint-disable-next-line no-control-regex
  if (titolo.trim() === '' || /["\\$`<>|\u0000-\u001f]/.test(titolo) || haWdm(titolo)) {
    errori.push(`--title: non può essere vuoto né contenere " \\ $ \` < > | , un a capo o "wdm" (ricevuto: ${JSON.stringify(titolo)}). L'apostrofo e & sono ammessi. Esempio: L'Atelier`);
  }
  return errori;
}

// ─── Sostituzione ────────────────────────────────────────────────────────────────────────────

// true se `prima` (l'inizio della riga) lascia aperta una stringa delimitata da `apice`.
function dentro(prima, apice) {
  let aperta = false;
  for (let i = 0; i < prima.length; i++) {
    if (prima[i] === '\\') i++;
    else if (prima[i] === apice) aperta = !aperta;
  }
  return aperta;
}

const html = (testo) => testo.replace(/&/g, '&amp;');
// Come serialize_block_attributes() di WordPress scrive una stringa negli attributi di un blocco.
const attributoDiBlocco = (testo) => testo.replace(/--/g, `${U}002d${U}002d`).replace(/&/g, `${U}0026`);

// Il titolo va scritto secondo il punto in cui cade: stringa PHP o JS, testo HTML, attributi di
// un commento di blocco. Negli altri file (JSON, CSS, Markdown) va com'è: i caratteri che li
// romperebbero sono rifiutati da valida().
function conTitolo(testo, nomeFile, titolo) {
  const estensione = path.extname(nomeFile).toLowerCase();
  return testo.replace(/WDM Theme/g, (trovato, indice) => {
    const prima = testo.slice(testo.lastIndexOf('\n', indice - 1) + 1, indice);
    if (estensione === '.php' || estensione === '.js') {
      if (dentro(prima, "'")) return titolo.replace(/'/g, "\\'");
      if (dentro(prima, '"')) return titolo;
      return estensione === '.php' ? html(titolo) : titolo;
    }
    if (estensione === '.html' || estensione === '.kit') {
      return prima.lastIndexOf('<!-- wp:') > prima.lastIndexOf('-->') ? attributoDiBlocco(titolo) : html(titolo);
    }
    return titolo;
  });
}

// Il testo di un file con i valori del progetto. `dove`: 'tema' (wdm-theme = text domain, salvo
// nei percorsi) o 'sito' (i file della site root: wdm-theme = cartella del progetto).
// Rifarla sul suo risultato non cambia nulla.
function sostituisci(testo, nomeFile, v, dove = 'tema') {
  // package-lock.json è pieno di impronte in base64, dove tre lettere a caso possono essere
  // «wdm»: lì si tocca solo il nome del pacchetto.
  if (path.basename(nomeFile) === LOCK) {
    return testo.split('\n').map((riga) => (NOME_NEL_LOCK.test(riga) ? sostituisciTesto(riga, nomeFile, v, dove) : riga)).join('\n');
  }
  return sostituisciTesto(testo, nomeFile, v, dove);
}

function sostituisciTesto(testo, nomeFile, v, dove) {
  const segno = (i) => `${String.fromCharCode(1)}${i}${String.fromCharCode(1)}`;
  let t = testo;
  PROTETTI.forEach((nome, i) => { t = t.split(nome).join(segno(i)); });
  t = t.split(`themes/${BASE}`).join(`themes/${v.slug}`).split(`${BASE}.local`).join(`${v.slug}.local`);
  t = t.split(BASE).join(dove === 'sito' ? v.slug : v.textdomain);
  t = conTitolo(t, nomeFile, v.title);
  t = t.split('WDM').join(v.prefix.toUpperCase()).split('wdm').join(v.prefix);
  PROTETTI.forEach((nome, i) => { t = t.split(segno(i)).join(nome); });
  return t;
}

// ─── Disco ───────────────────────────────────────────────────────────────────────────────────

// Tutti i file sotto `cartella`, in ordine, senza node_modules e .git.
function file(cartella) {
  return fs.readdirSync(cartella, { withFileTypes: true })
    .filter((voce) => !SALTATE.includes(voce.name))
    .sort((a, b) => (a.name < b.name ? -1 : 1))
    .flatMap((voce) => {
      const percorso = path.join(cartella, voce.name);
      return voce.isDirectory() ? file(percorso) : [percorso];
    });
}

// Il contenuto di un file di testo, o null per un file binario (font, immagini).
function testoDi(percorso) {
  const dati = fs.readFileSync(percorso);
  return dati.subarray(0, 8000).includes(0) ? null : dati.toString('utf8');
}

function riscrivi(percorso, cambia) {
  const testo = testoDi(percorso);
  if (testo === null) return;
  const nuovo = cambia(testo);
  if (nuovo !== testo) fs.writeFileSync(percorso, nuovo);
}

function togli(percorso) {
  fs.rmSync(percorso, { recursive: true, force: true });
}

// I file generati dalla build: si tolgono, npm run build li ricrea con i nomi nuovi.
function togliGenerati(tema) {
  const blocchi = path.join(tema, 'blocks');
  if (fs.existsSync(blocchi)) {
    for (const voce of fs.readdirSync(blocchi, { withFileTypes: true })) if (voce.isDirectory()) togli(path.join(blocchi, voce.name, 'build'));
  }
  const sotto = (cartella, tieni) => {
    const dir = path.join(tema, ...cartella.split('/'));
    if (fs.existsSync(dir)) for (const nome of fs.readdirSync(dir)) if (tieni(nome)) togli(path.join(dir, nome));
  };
  sotto('html', (nome) => nome.endsWith('.html'));
  sotto('assets/css', (nome) => ['main.css', 'fonts.css', 'swiper.css'].includes(nome) || nome.endsWith('.map'));
  sotto('assets/js', (nome) => nome.endsWith('.js') || nome.endsWith('.map'));
}

// I kit di pagina del tema base sono dimostrativi: il progetto disegna i suoi.
function togliKitDemo(tema) {
  const kit = path.join(tema, 'src', 'kit');
  if (!fs.existsSync(kit)) return;
  for (const nome of fs.readdirSync(kit)) {
    if (/^wdm-.*\.kit$/.test(nome) && !KIT_TENUTI.includes(nome)) togli(path.join(kit, nome));
  }
}

// Le parts portano ID del database del tema base: il form di Formidable e i menu (`ref` dei
// blocchi navigation). In un database nuovo quegli ID sono un'altra cosa o niente: il form va a
// 0 e il `ref` si toglie; lo riscrive wp-navigation.php quando crea i menu.
function senzaIdDelTemaBase(testo) {
  return testo
    .replace(/"formId":\s*\d+/g, '"formId":0')
    .replace(/(<!-- wp:navigation )(\{.*?\})( \/?-->)/gs, (tutto, apre, json, chiude) => apre
      + json.replace(/"ref":\s*\d+\s*,\s*/, '').replace(/,\s*"ref":\s*\d+/, '').replace(/^\{\s*"ref":\s*\d+\s*\}$/, '{}')
      + chiude);
}

// Cartelle e file che portano il prefisso nel nome, dal più profondo.
function rinominaNomi(cartella, prefisso) {
  for (const voce of fs.readdirSync(cartella, { withFileTypes: true })) {
    if (SALTATE.includes(voce.name)) continue;
    const percorso = path.join(cartella, voce.name);
    if (voce.isDirectory()) rinominaNomi(percorso, prefisso);
    if (voce.name.includes('wdm')) fs.renameSync(percorso, path.join(cartella, voce.name.split('wdm').join(prefisso)));
  }
}

// DESIGN.md → Project Config porta già i valori del progetto, scritti dalla skill e da mamp.js:
// percorsi compresi, e una cartella può chiamarsi «corso-wdm». Quella sezione non si tocca.
function fuoriDaProjectConfig(testo, cambia) {
  const inizio = testo.search(/^## Project Config\b/m);
  if (inizio === -1) return cambia(testo);
  const dopo = testo.indexOf('\n', inizio) + 1;
  const prossima = testo.slice(dopo).search(/^## /m);
  const fine = prossima === -1 ? testo.length : dopo + prossima;
  return cambia(testo.slice(0, inizio)) + testo.slice(inizio, fine) + cambia(testo.slice(fine));
}

// L'impronta di theme.json scritta nei Design Tokens del tema base non vale più dopo la rinomina
// (in theme.json cambiano i nomi dei blocchi): si toglie, e la riscrive il sync dei token.
function senzaImpronta(testo) {
  return testo.replace(/^# impronta theme\.json: .*\r?\n/m, '');
}

// Le righe che citano ancora «wdm», tolti i nomi protetti: «file:riga: testo».
function residui(elenco, radice) {
  const pulita = (riga) => PROTETTI.reduce((t, nome) => t.split(nome).join(''), riga);
  return elenco.flatMap((percorso) => {
    const relativo = path.relative(radice, percorso);
    const trovati = /wdm/i.test(pulita(path.basename(percorso))) ? [`${relativo}: il nome del file`] : [];
    const testo = testoDi(percorso);
    if (testo === null) return trovati;
    const daGuardare = path.basename(percorso) === LOCK ? (riga) => NOME_NEL_LOCK.test(riga) : () => true;
    return trovati.concat(testo.split('\n').flatMap((riga, i) => (daGuardare(riga) && /wdm/i.test(pulita(riga)) ? [`${relativo}:${i + 1}: ${riga.trim().slice(0, 160)}`] : [])));
  });
}

function rinomina(v) {
  const sito = v.target;
  const temi = path.join(sito, 'wp-content', 'themes');
  const base = path.join(temi, BASE);
  const tema = path.join(temi, v.slug);
  const delSito = ['.gitignore', 'README.md', 'DESIGN.md'].map((nome) => path.join(sito, nome)).filter((f) => fs.existsSync(f));

  if (fs.existsSync(base) && fs.existsSync(tema)) {
    console.error(`In ${temi} ci sono sia "${BASE}" sia "${v.slug}": non so quale sia il tema da tenere. Se "${v.slug}" è rimasta da un tentativo precedente, cancellala e rilancia.`);
    return 3;
  }
  if (!fs.existsSync(base) && !fs.existsSync(tema)) {
    console.error(`Non trovo il tema base in ${base}. Questo script rinomina wdm-theme, non crea un tema: scarica il repo wdm-theme nella cartella del sito e rilancia.`);
    return 3;
  }

  if (fs.existsSync(base)) {
    console.log(`▶ Rinomino wdm-theme → ${v.slug} (prefisso: wdm → ${v.prefix}, text domain: ${v.textdomain}, titolo: ${v.title})`);
    togliGenerati(base);
    togliKitDemo(base);
    console.log('  ✓ file generati e kit dimostrativi tolti');
    for (const percorso of file(base)) riscrivi(percorso, (testo) => sostituisci(testo, percorso, v, 'tema'));
    console.log('  ✓ prefisso, text domain e titolo sostituiti in ogni file di testo');
    const parts = path.join(base, 'parts');
    if (fs.existsSync(parts)) for (const percorso of file(parts)) riscrivi(percorso, senzaIdDelTemaBase);
    rinominaNomi(base, v.prefix);
    console.log('  ✓ cartelle dei blocchi, kit e pattern rinominati');
    const build = path.join(base, 'build.js');
    if (fs.existsSync(build)) riscrivi(build, (testo) => testo.replace(/proxy: '[^']*'/, () => `proxy: '${v['local-url']}'`));
    for (const percorso of delSito) {
      const cambia = (testo) => sostituisci(testo, percorso, v, 'sito');
      riscrivi(percorso, path.basename(percorso) === 'DESIGN.md' ? (testo) => senzaImpronta(fuoriDaProjectConfig(testo, cambia)) : cambia);
    }
    console.log('  ✓ build.js (proxy), .gitignore, README.md e DESIGN.md della site root');
    // Per ultima: finché la cartella si chiama wdm-theme, un rilancio riprende da qui sopra.
    fs.renameSync(base, tema);
    console.log(`  ✓ cartella del tema: ${BASE} → ${v.slug}`);
  } else {
    console.log(`▶ Il tema è già stato rinominato in "${v.slug}": rifaccio solo il controllo.`);
  }

  // DESIGN.md resta fuori dal controllo: la sua storia cita il tema base, e lo riscrive la skill.
  const rimasti = residui([...file(tema), ...delSito.filter((f) => path.basename(f) !== 'DESIGN.md')], sito);
  if (rimasti.length) {
    console.error(rimasti.join('\n'));
    console.error(`\nSono rimasti ${rimasti.length} riferimenti a "wdm" che lo script non ha saputo sostituire. In queste righe sostituisci a mano "wdm" con "${v.prefix}", poi rilancia lo stesso comando: rifà solo questo controllo.`);
    return 1;
  }
  console.log(`✅ Rinomina completata: tema "${v.slug}", prefisso "${v.prefix}", nessun riferimento a "wdm" rimasto.`);
  return 0;
}

// ─── Riga di comando ─────────────────────────────────────────────────────────────────────────

const CHIAVI = ['prefix', 'slug', 'textdomain', 'title', 'local-url', 'target'];

function main(argv) {
  const v = {};
  for (let i = 0; i < argv.length; i += 2) {
    const nome = argv[i];
    if (!nome.startsWith('--') || !CHIAVI.includes(nome.slice(2))) {
      console.error(`setup: argomento non riconosciuto: ${nome}\n${USO}`);
      return 2;
    }
    if (argv[i + 1] === undefined || argv[i + 1].startsWith('--')) {
      console.error(`setup: ${nome} vuole un valore\n${USO}`);
      return 2;
    }
    v[nome.slice(2)] = argv[i + 1];
  }
  const mancanti = CHIAVI.filter((chiave) => v[chiave] === undefined);
  if (mancanti.length) {
    console.error(`setup: ${mancanti.length === 1 ? 'manca' : 'mancano'} ${mancanti.map((m) => `--${m}`).join(', ')}\n${USO}`);
    return 2;
  }
  const errori = valida(v);
  // Un percorso relativo vale dalla cartella da cui si lancia: da qui in poi è assoluto.
  v.target = path.resolve(v.target);
  if (!fs.existsSync(v.target) || !fs.statSync(v.target).isDirectory()) errori.push(`--target: non è una cartella (${v.target})`);
  if (errori.length) {
    console.error(`setup: valori da correggere, nessun file è stato toccato:\n${errori.map((e) => `  - ${e}`).join('\n')}`);
    return 2;
  }
  try {
    return rinomina(v);
  } catch (errore) {
    console.error(`Il setup si è interrotto: ${errore.message}\nSistema la causa e rilancia lo stesso comando: riprende da dove si era fermato.`);
    return 1;
  }
}

module.exports = { valida, sostituisci, senzaImpronta };

if (require.main === module) process.exitCode = main(process.argv.slice(2));
