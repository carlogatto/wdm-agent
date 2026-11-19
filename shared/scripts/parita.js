#!/usr/bin/env node
// Parità tra kit e sito: l'HTML compilato del kit (html/*.html) e l'HTML che WordPress serve
// devono avere la stessa struttura. Legge e basta: non scrive mai, né nel progetto né nel sito.
//
//   node parita.js <site-root> [--html <cartella>] [--url <indirizzo>]
//
// Cosa confronta: lo scheletro, cioè gli elementi che portano una classe del progetto
// ({prefix}-…), annidati come nel documento, con quelle classi più le classi di colore e di
// allineamento. Sono i blocchi, il loro ordine, la variante e il markup BEM: ciò che kit e tema
// devono avere uguale. Cosa non confronta: testi, immagini, icone, link, quanti elementi ha una
// serie ripetuta (le card di un carosello) e un campo facoltativo lasciato vuoto in WordPress
// (un elemento senza figli, come `__text` o `__link`, che il kit ha e il sito non stampa).
// Quelli sono contenuti: li decide chi scrive in WordPress, e una differenza lì non è una
// differenza. Un elemento che il sito stampa e il kit non ha, invece, si segnala.
// Dove: header e footer una volta sola (righe `implementato` di ## Telaio), poi il contenuto di
// ogni pagina `implementata` di ## Pagine.
// Tolleranze: le classi che WordPress e Swiper aggiungono da soli non contano; un elemento che
// ripete le classi di quello che lo contiene è lo stesso elemento stampato due volte da un
// blocco core (navigation); `{prefix}-header__toggle` esiste solo nel kit (in WordPress il
// bottone del menu è di core).
//
// Silenzio ed exit 0: struttura uguale. Exit 1: differenze, una per riga, con il lato che è
// cambiato per ultimo. Exit 3: non ha potuto verificare (sito fermo, kit non compilato,
// DESIGN.md assente o incompleto), e dice perché. Exit 2: uso.
// --html e --url sostituiscono la cartella dei kit compilati e l'indirizzo del sito (prove).

'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const path = require('node:path');

const { valore, eFse } = require('./lib/design-md.js');
const { albero } = require('./lib/html.js');

const USO = 'uso: node parita.js <site-root> [--html <cartella>] [--url <indirizzo>]';
// Classi che dicono il design di un elemento oltre a quelle del progetto.
const DESIGN = /^(has-[a-z0-9-]+-(background-)?color|has-background|has-text-color|align(full|wide|left|right|center))$/;

class Errore extends Error {}

// ---------- scheletro ----------

// Gli elementi con una classe del progetto, annidati; gli altri sono trasparenti.
function scheletro(html, prefisso) {
  const mio = (c) => c.startsWith(`${prefisso}-`);
  const soloKit = `${prefisso}-header__toggle`;
  const scendi = (nodo, sopra) => nodo.figli.flatMap((figlio) => {
    if (!figlio.classi.some(mio) || figlio.classi.includes(soloKit)) return scendi(figlio, sopra);
    const classi = [...new Set(figlio.classi.filter((c) => mio(c) || DESIGN.test(c)))].sort();
    const etichetta = classi.join(' ');
    // Stesse classi dell'elemento che lo contiene: è lo stesso elemento, stampato due volte.
    if (etichetta === sopra) return scendi(figlio, sopra);
    // Le sezioni di una pagina (i figli di {prefix}-main) non sono una serie: due uguali sono due.
    return [{ classi, etichetta, base: classi.find((c) => mio(c) && !c.includes('--')) || classi.find(mio), sezioni: classi.includes(`${prefisso}-main`), figli: scendi(figlio, etichetta) }];
  });
  return compatta(scendi(albero(html), ''), false);
}

// Un elemento del blocco senza altri elementi dentro (`__title`, `__text`, `__link`): c'è o non
// c'è secondo ciò che è stato scritto nel campo, quindi è contenuto.
function foglia(nodo) {
  return nodo.figli.length === 0 && nodo.base.includes('__');
}

// `senzaFoglie`: la firma con cui si riconosce una serie, che non guarda i campi facoltativi.
function firma(nodo, senzaFoglie = false) {
  const figli = senzaFoglie ? nodo.figli.filter((f) => !foglia(f)) : nodo.figli;
  return `${nodo.etichetta}(${figli.map((f) => firma(f, senzaFoglie)).join(',')})`;
}

// Una serie di elementi uguali in fila vale come uno: quante card ha un carosello è contenuto.
function compatta(nodi, serie = true) {
  const tenuti = [];
  for (const nodo of nodi) {
    nodo.figli = compatta(nodo.figli, !nodo.sezioni);
    if (!serie || !tenuti.length || firma(tenuti[tenuti.length - 1], true) !== firma(nodo, true)) tenuti.push(nodo);
  }
  return tenuti;
}

// Le zone di un documento: header, footer, e tutto il resto (il contenuto della pagina).
function zone(nodi, prefisso) {
  const e = (nome) => (n) => n.classi.includes(`${prefisso}-${nome}`);
  return { header: nodi.filter(e('header')), footer: nodi.filter(e('footer')), contenuto: nodi.filter((n) => !e('header')(n) && !e('footer')(n)) };
}

// ---------- confronto ----------

// Coppie (i, j) della sottosequenza comune più lunga.
function comuni(a, b) {
  const L = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  }
  const coppie = [];
  for (let i = 0, j = 0; i < a.length && j < b.length;) {
    if (a[i] === b[j]) coppie.push([i++, j++]);
    else if (L[i + 1][j] >= L[i][j + 1]) i++;
    else j++;
  }
  return coppie;
}

// Le differenze tra due scheletri, una frase per riga. Vuoto = stessa struttura.
function confronta(kit, sito, sopra = []) {
  const dove = (nodo) => [...sopra, nodo.etichetta].join(' › ');
  const coppie = comuni(kit.map((n) => n.base), sito.map((n) => n.base));
  const nelKit = new Set(coppie.map((c) => c[0]));
  const nelSito = new Set(coppie.map((c) => c[1]));
  const soloKit = kit.filter((_, i) => !nelKit.has(i));
  const soloSito = sito.filter((_, j) => !nelSito.has(j));
  const trovate = [];
  // Gli stessi elementi da una parte e dall'altra, in un altro ordine.
  const spostati = soloKit.filter((n) => soloSito.some((m) => firma(m) === firma(n)));
  for (const n of spostati) trovate.push(`ordine diverso: ${dove(n)}`);
  // Un campo facoltativo che il kit riempie e in WordPress è vuoto non è una differenza.
  for (const n of soloKit.filter((n) => !spostati.includes(n) && !foglia(n))) trovate.push(`solo nel kit: ${dove(n)}`);
  for (const n of soloSito.filter((n) => !spostati.some((m) => firma(m) === firma(n)))) trovate.push(`solo nel sito: ${dove(n)}`);
  for (const [i, j] of coppie) {
    if (kit[i].etichetta !== sito[j].etichetta) {
      trovate.push(`classi diverse: ${[...sopra, kit[i].base].join(' › ')} — kit [${kit[i].etichetta}] · sito [${sito[j].etichetta}]`);
    }
    trovate.push(...confronta(kit[i].figli, sito[j].figli, [...sopra, kit[i].base]));
  }
  return trovate;
}

// ---------- DESIGN.md ----------

// Le righe di una tabella sotto un titolo `## …`, come oggetti { colonna minuscola: valore }.
function tabella(design, titolo) {
  const righe = design.split(/\r?\n/);
  const inizio = righe.findIndex((r) => r.trim() === `## ${titolo}`);
  if (inizio === -1) return [];
  const celle = (riga) => riga.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const corpo = [];
  for (let i = inizio + 1; i < righe.length && !/^## /.test(righe[i]); i++) {
    if (righe[i].trim().startsWith('|')) corpo.push(righe[i]);
    else if (corpo.length) break;
  }
  if (corpo.length < 3) return [];
  const colonne = celle(corpo[0]).map((c) => c.toLowerCase());
  return corpo.slice(2).map((riga) => Object.fromEntries(celle(riga).map((valore, i) => [colonne[i] || `col${i}`, valore])));
}

// { prefisso, url, tema, pagine: [{ titolo, percorso, kit }], header, footer }
function progetto(sito) {
  const designMd = path.join(sito, 'DESIGN.md');
  if (!fs.existsSync(designMd)) throw new Errore(`In ${sito} non c'è DESIGN.md: non è la cartella di un progetto.`);
  const design = fs.readFileSync(designMd, 'utf8');
  if (!eFse(design)) throw new Errore(`${designMd} non è di un progetto wdm-theme (riga theme_family).`);
  const leggi = (nome) => {
    const v = valore(design, nome);
    if (!v) throw new Errore(`In DESIGN.md → Project Config manca la riga \`${nome}\`.`);
    return v;
  };
  const prefisso = leggi('{prefix}');
  const implementato = (voce) => tabella(design, 'Telaio').some((r) => (r.item || '').toLowerCase().startsWith(voce) && r.stato === 'implementato');
  const pagine = tabella(design, 'Pagine').filter((r) => r.stato === 'implementata' && /\.kit\b/.test(r.kit || ''))
    .map((r) => ({ titolo: r.pagina, percorso: (r.url || '/').replace(/`/g, ''), kit: /[^\s`]+\.kit\b/.exec(r.kit)[0] }));
  return { prefisso, url: leggi('{local-url}').replace(/\/+$/, ''), tema: path.join(sito, 'wp-content', 'themes', leggi('{theme-folder}')), pagine, header: implementato('header'), footer: implementato('footer') };
}

// ---------- sito ----------

// { status, body } oppure null se il sito non risponde. Il certificato del sito locale non si
// verifica: su alcuni sistemi è autofirmato. Un reindirizzamento (la barra finale) si segue.
function scarica(url, salti = 3) {
  return new Promise((resolve) => {
    const client = url.startsWith('https:') ? https : http;
    const richiesta = client.get(url, { rejectUnauthorized: false, timeout: 15000 }, (risposta) => {
      if ([301, 302, 307, 308].includes(risposta.statusCode) && risposta.headers.location && salti > 0) {
        risposta.resume();
        resolve(scarica(new URL(risposta.headers.location, url).href, salti - 1));
        return;
      }
      let body = '';
      risposta.setEncoding('utf8');
      risposta.on('data', (pezzo) => { body += pezzo; });
      risposta.on('end', () => resolve({ status: risposta.statusCode, body }));
    });
    richiesta.on('timeout', () => richiesta.destroy());
    richiesta.on('error', () => resolve(null));
  });
}

// ---------- quale lato è cambiato per ultimo ----------

// Data dell'ultimo commit che ha toccato i file dati; 'ora' se hanno modifiche non committate;
// null se non si può sapere (nessun repo, git assente).
function ultimoCommit(sito, file) {
  // --no-optional-locks: nemmeno l'indice di git viene riscritto. Questo script legge e basta.
  const git = (...args) => spawnSync('git', ['--no-optional-locks', '-C', sito, ...args, '--', ...file], { encoding: 'utf8' });
  const stato = git('status', '--porcelain');
  if (stato.error || stato.status !== 0) return null;
  if (stato.stdout.trim() !== '') return 'ora';
  const data = git('log', '-1', '--format=%cI').stdout.trim();
  return data === '' ? null : data;
}

// Giorno e ora nel fuso di questo computer. Il commit arriva con l'ora locale e WordPress in
// UTC: scritte com'erano, le due ore non si potevano confrontare a occhio.
function locale(data) {
  const d = new Date(data);
  const due = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())} ${due(d.getHours())}:${due(d.getMinutes())}`;
}

function ultimoLato(kit, wp, nomeWp) {
  const giorno = (d) => (d === 'ora' ? 'modifiche non ancora committate' : `ultimo commit ${locale(d)}`);
  if (!kit || !wp) return 'Non so dire quale lato è cambiato per ultimo: guarda la storia di git del kit e la data di modifica in WordPress.';
  const kitDopo = kit === 'ora' || (wp !== 'ora' && new Date(kit) > new Date(wp));
  return kitDopo
    ? `Per ultimo è cambiato il kit (${giorno(kit)}; ${nomeWp}: ${wp === 'ora' ? 'ora' : locale(wp)}): porta la differenza in WordPress.`
    : `Per ultimo è cambiato ${nomeWp} (${wp === 'ora' ? 'modifiche non ancora committate' : locale(wp)}; kit: ${giorno(kit)}): allinea il kit.`;
}

// ---------- main ----------

async function parita(sito, opzioni = {}) {
  const p = progetto(sito);
  const html = opzioni.html || path.join(p.tema, 'html');
  const url = (opzioni.url || p.url).replace(/\/+$/, '');
  const relTema = path.relative(sito, p.tema).split(path.sep).join('/');
  const differenze = [];
  const note = [];

  // Il telaio si guarda sulla prima pagina costruita; senza pagine, sul catalogo e sulla Home.
  const perTelaio = p.pagine[0] || { titolo: 'Home', percorso: '/', kit: `src/kit/${p.prefisso}-blocks.kit` };
  const daGuardare = [...(p.header || p.footer ? [{ ...perTelaio, telaio: true }] : []), ...p.pagine];
  if (!daGuardare.length) return { differenze, note };

  let modifiche = null;   // percorso → data di modifica della pagina in WordPress, letta una volta se serve
  const modificata = async (percorso) => {
    if (modifiche === null) {
      modifiche = {};
      const r = await scarica(`${url}/wp-json/wp/v2/pages?per_page=100&_fields=link,modified_gmt`);
      try {
        for (const voce of JSON.parse(r.body)) modifiche[new URL(voce.link).pathname.replace(/\/+$/, '') || '/'] = `${voce.modified_gmt}Z`;
      } catch { /* senza REST la data non si sa */ }
    }
    return modifiche[percorso.replace(/\/+$/, '') || '/'] || null;
  };

  const scaricate = new Map();
  for (const voce of daGuardare) {
    const fileKit = path.join(html, `${path.basename(voce.kit, '.kit')}.html`);
    if (!fs.existsSync(fileKit)) { note.push(`${voce.titolo}: kit non compilato (manca ${path.basename(fileKit)}): lancia la build del tema.`); continue; }
    const indirizzo = `${url}${voce.percorso.startsWith('/') ? '' : '/'}${voce.percorso}`;
    if (!scaricate.has(indirizzo)) scaricate.set(indirizzo, await scarica(indirizzo));
    const risposta = scaricate.get(indirizzo);
    if (!risposta) { note.push(`il sito non risponde (${url}): avvia i server di MAMP PRO.`); break; }
    if (risposta.status === 404) { note.push(`${voce.titolo}: la pagina ${voce.percorso} non esiste in WordPress.`); continue; }
    if (risposta.status !== 200) { note.push(`${voce.titolo}: il sito risponde ${risposta.status} a ${indirizzo}.`); continue; }
    if (!risposta.body.includes(`/themes/${path.basename(p.tema)}/`)) { note.push(`il sito a ${url} non usa il tema ${path.basename(p.tema)}.`); break; }
    const k = zone(scheletro(fs.readFileSync(fileKit, 'utf8'), p.prefisso), p.prefisso);
    const s = zone(scheletro(risposta.body, p.prefisso), p.prefisso);
    if (voce.telaio) {
      for (const parte of ['header', 'footer'].filter((nome) => p[nome])) {
        const trovate = confronta(k[parte], s[parte]);
        if (!trovate.length) continue;
        const lato = ultimoLato(ultimoCommit(sito, [`${relTema}/src/kit/main/${parte}`]), ultimoCommit(sito, [`${relTema}/parts/${parte}.html`]), `parts/${parte}.html`);
        differenze.push({ dove: `${parte} (telaio)`, trovate, lato });
      }
    } else {
      const trovate = confronta(k.contenuto, s.contenuto);
      if (!trovate.length) continue;
      const lato = ultimoLato(ultimoCommit(sito, [`${relTema}/${voce.kit}`, `${relTema}/blocks`]), await modificata(voce.percorso), 'la pagina in WordPress');
      differenze.push({ dove: `${voce.titolo} (${voce.percorso})`, trovate, lato });
    }
  }
  return { differenze, note: [...new Set(note)] };
}

module.exports = { scheletro, zone, confronta, tabella, ultimoLato, parita, Errore };

if (require.main === module) {
  const [sito, ...resto] = process.argv.slice(2);
  const opzioni = {};
  for (let i = 0; i < resto.length; i += 2) {
    if (!['--html', '--url'].includes(resto[i]) || !resto[i + 1]) { console.error(USO); process.exit(2); }
    opzioni[resto[i].slice(2)] = resto[i + 1];
  }
  if (!sito || sito.startsWith('--')) { console.error(USO); process.exit(2); }
  parita(path.resolve(sito), opzioni).then(({ differenze, note }) => {
    if (differenze.length) {
      console.log(`Parità kit ↔ sito: struttura diversa in ${differenze.length === 1 ? 'un punto' : `${differenze.length} punti`}.`);
      for (const d of differenze) {
        console.log(`\n${d.dove}`);
        for (const riga of d.trovate) console.log(`  ${riga}`);
        console.log(`  ${d.lato}`);
      }
    }
    for (const n of note) console.log(`${differenze.length ? '\n' : ''}Parità non verificata — ${n}`);
    process.exitCode = differenze.length ? 1 : note.length ? 3 : 0;
  }).catch((errore) => {
    if (!(errore instanceof Errore)) throw errore;
    // Non è una differenza di struttura: non c'è stato modo di guardare.
    console.log(`Parità non verificata — ${errore.message}`);
    process.exitCode = 3;
  });
}
