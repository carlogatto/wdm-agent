#!/usr/bin/env node
// fse-build 2a/2d — dal kit compilato di una pagina al file di blocchi che wp-page.php confronta.
//
//   node kit-pagina.js <site-root> <pagina> <file-di-uscita> [page=<slug|ID>]
//   node kit-pagina.js <site-root> <pagina> controlla
//
// <pagina> è il nome del kit senza prefisso (home → html/{prefix}-home.html). Legge il kit
// compilato, i README dei blocchi (il contratto), le icone del set e i pattern del tema; da
// WordPress, con {wp-cli} di DESIGN.md, solo gli id (immagini, post, form). `page=` è la pagina
// già costruita, se c'è: serve alle card segnaposto, che tengono il post che hanno lì.
// `controlla` mappa e basta: non chiede nulla a WordPress e non scrive file (fse-kit prima del
// gate).
//
// Non ha regole per singolo blocco: applica il vocabolario condiviso degli attributi
// (fondamenta §3) e legge dal README ciò che il vocabolario non dice. Nulla si perde in
// silenzio: dentro un blocco ogni classe del progetto, modificatore, data-*, proprietà di stile
// e testo deve essere letto da una regola o nominato dal README; altrimenti la pagina non è
// mappabile, e lo dice. Prima tutta la mappatura, poi le letture in WordPress, poi l'import
// delle immagini che mancano: una pagina non mappabile non lascia nulla in WordPress.
//
// Exit: 0 file scritto (o pagina mappabile, con `controlla`) · 2 uso o ambiente, con cosa fare ·
// 3 pagina non mappabile: una riga per motivo, nulla scritto. L'1 non è mai dello script.

'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { valore, eFse, argomenti } = require('../../../shared/scripts/lib/design-md.js');
const { documento } = require('../../../shared/scripts/lib/html.js');

const PHP = path.join(__dirname, 'kit-pagina.php');
const USO = 'uso: node kit-pagina.js <site-root> <pagina> <file-di-uscita> [page=<slug|ID>] | node kit-pagina.js <site-root> <pagina> controlla';
// Il titolo delle card «da un post» nel catalogo del tema base: non si cerca tra i post.
const SEGNAPOSTO = 'Titolo del contenuto';
// Attributi che hanno una regola loro, non quella dell'elemento con lo stesso nome.
const RISERVATI = new Set(['align', 'headingLevel', 'imageId', 'imageUrl', 'imageAlt', 'icon', 'iconId', 'iconOriginalColors', 'postType', 'postId', 'formId']);

class Errore extends Error {}

const perRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const kebab = (nome) => nome.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const spazi = (s) => s.replace(/\s+/g, ' ').trim();
const senzaTag = (s) => s.replace(/<[^>]*>/g, '');
const ENTITA = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: String.fromCharCode(160) };

// Le entità di un valore che non è HTML (un URL, un alt, un titolo da cercare).
function decodifica(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (tutto, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return e.toLowerCase() in ENTITA ? ENTITA[e.toLowerCase()] : tutto;
  });
}

// ---------- README: il contratto ----------

function sezioni(testo) {
  const trovate = {};
  let titolo = null;
  for (const riga of testo.split(/\r?\n/)) {
    const m = /^## (.+?)\s*$/.exec(riga);
    if (m) { titolo = m[1]; trovate[titolo] = []; } else if (titolo) trovate[titolo].push(riga);
  }
  return Object.fromEntries(Object.entries(trovate).map(([nome, righe]) => [nome, righe.join('\n')]));
}

// Le righe della prima tabella di un testo, come celle (senza intestazione).
function righe(testo) {
  const corpo = [];
  for (const riga of testo.split('\n')) {
    if (riga.trim().startsWith('|')) corpo.push(riga);
    else if (corpo.length) break;
  }
  return corpo.slice(2).map((riga) => riga.trim().replace(/^\|/, '').replace(/\|\s*$/, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|')));
}

const senzaApici = (cella) => cella.trim().replace(/^`|`$/g, '');

function predefinito(cella, tipo) {
  const v = senzaApici(cella);
  if (v === '' || v === '—') return undefined;
  if (tipo === 'integer' || tipo === 'number') return Number(v);
  if (tipo === 'boolean') return v === 'true';
  return v === '""' ? '' : v;
}

// Ciò che lo script legge da un README (fondamenta §3 «README.md — the contract»):
// attributi (nome, tipo, default e, dalla Nota, da dove si legge il valore nel kit), varianti,
// figli, supports, l'elemento che stampa un plugin, e le parole che il README nomina.
function contratto(testo, prefisso, slug) {
  const s = sezioni(testo);
  const attributi = righe(s.Attributi || '').map((c) => {
    const tipo = (/^(string|integer|number|boolean|array|object)/.exec(c[1] || '') || [])[1] || 'string';
    const nota = c[4] || '';
    const a = { nome: senzaApici(c[0] || ''), tipo, default: predefinito(c[3] || '', tipo) };
    const valori = /`([a-z0-9-]+(?:\|[a-z0-9-]+)+)`/.exec(c[1] || '');
    if (valori) a.valori = valori[1].split('|');
    const kit = /kit: `?\.?__([a-z0-9-]+)`?/.exec(nota);
    if (kit) a.kit = kit[1];
    const stile = /`style="(--[a-z0-9-]+):N"`/.exec(nota);
    if (stile) a.stile = stile[1];
    const data = /`(data-[a-z0-9-]+)`/.exec(nota);
    if (data) a.data = data[1];
    const modificatore = /`([^`]+)` → `(__[a-z0-9-]+--[a-z0-9-]+)`/.exec(nota);
    if (modificatore) a.modificatore = { valore: modificatore[1], classe: modificatore[2] };
    return a;
  }).filter((a) => /^[a-zA-Z][a-zA-Z0-9]*$/.test(a.nome));
  const varianti = righe(s.Varianti || '').map((c) => {
    const nome = (/^`?([a-z0-9][a-z0-9-]*)/.exec(c[0] || '') || [])[1];
    if (!nome) return null;
    const detto = new RegExp('`([a-zA-Z]+): "' + perRegex(nome) + '"`').exec(c.join(' | '));
    return { nome, attributo: detto ? detto[1] : 'variant' };
  }).filter(Boolean);
  const figli = s.Figli || '';
  const solo = /Solo in `([a-z0-9-]+)`/.exec(figli);
  const supports = (/^Supports:([\s\S]*?)(?:\n\s*\n|$)/m.exec(s.Attributi || '') || ['', ''])[1];
  const plugin = /Parità kit ↔ render: fino a `__([a-z0-9-]+)` incluso/.exec(testo);
  return {
    slug,
    attributi,
    attributo: Object.fromEntries(attributi.map((a) => [a.nome, a])),
    varianti,
    figli: {
      nomi: [...new Set([...figli.matchAll(new RegExp('`' + perRegex(prefisso) + '/([a-z0-9-]+)`', 'g'))].map((m) => m[1]))],
      liberi: /InnerBlocks liberi/i.test(figli),
      soloIn: solo ? solo[1] : null,
    },
    supports: { anchor: /`anchor`/.test(supports), colore: /`color[.`]/.test(supports) },
    plugin: plugin ? plugin[1] : null,
    parole: new Set(testo.match(/[A-Za-z0-9_-]+/g) || []),
  };
}

// ---------- mappatura ----------

function trova(nodo, test) {
  for (const f of nodo.figli || []) {
    if (!f.tag) continue;
    if (test(f)) return f;
    const sotto = trova(f, test);
    if (sotto) return sotto;
  }
  return null;
}

// { blocchi, opzioni: { titolo, form }, note, errori, richieste: { immagini, post, form } }.
// `leggiReadme(slug)` e `pattern(nome)` restituiscono il testo del file o null; `icone` è
// { slug: svg }. Con errori la pagina non è mappabile: i blocchi non vanno usati.
function mappa({ html, prefisso, leggiReadme, icone, pattern }) {
  const doc = documento(html);
  const errori = [];
  const note = [];
  const richieste = { immagini: new Set(), post: new Set(), form: new Set() };
  const esito = (blocchi, opzioni) => ({ blocchi, opzioni, note, errori, richieste: { immagini: [...richieste.immagini], post: [...richieste.post], form: [...richieste.form] } });
  const dentro = (n) => doc.sorgente.slice(n.dentroDa, n.dentroA);
  const radice = new RegExp(`^${perRegex(prefisso)}-block-([a-z0-9]+(?:-[a-z0-9]+)*)$`);
  const slugDi = (n) => {
    for (const c of n.classi) {
      const m = radice.exec(c);
      if (m) return m[1];
    }
    return null;
  };
  const contratti = new Map();
  const leggi = (slug) => {
    if (!contratti.has(slug)) {
      const testo = leggiReadme(slug);
      contratti.set(slug, testo ? contratto(testo, prefisso, slug) : null);
    }
    return contratti.get(slug);
  };
  const senzaSpazi = (s) => s.replace(/\s+/g, '');
  const set = Object.entries(icone || {}).map(([slug, svg]) => [slug, senzaSpazi(svg)]);
  const apertura = (n) => `<${n.tag}${n.attr.class ? ` class="${n.attr.class}"` : ''}>`;

  const main = trova(doc, (n) => n.tag === 'main');
  if (!main) {
    errori.push('la pagina non ha un elemento <main>: non è il kit compilato di una pagina');
    return esito([], { titolo: 1, form: 0 });
  }

  // Un blocco core dentro un blocco con InnerBlocks liberi: solo le forme senza attributi.
  function core(f, err) {
    const altri = Object.keys(f.attr).filter((a) => a !== 'class');
    const classi = (ammessa) => f.classi.filter((c) => c !== ammessa);
    const rifiuta = (perche) => { err(`blocco core ${apertura(f)}: ${perche}`); return null; };
    if (f.tag === 'p' || /^h[1-6]$/.test(f.tag)) {
      const sua = f.tag === 'p' ? 'wp-block-paragraph' : 'wp-block-heading';
      if (classi(sua).length) return rifiuta(`la classe «${classi(sua).join(' ')}» chiede un attributo che lo script non sa scrivere`);
      if (altri.length) return rifiuta(`l'attributo «${altri.join(', ')}» chiede un attributo di blocco che lo script non sa scrivere`);
      if (f.tag === 'p') return { grezzo: `<!-- wp:paragraph -->\n<p>${spazi(dentro(f))}</p>\n<!-- /wp:paragraph -->` };
      const livello = Number(f.tag[1]);
      return { grezzo: `<!-- wp:heading${livello === 2 ? '' : ` {"level":${livello}}`} -->\n<${f.tag} class="wp-block-heading">${spazi(dentro(f))}</${f.tag}>\n<!-- /wp:heading -->` };
    }
    if (f.tag === 'pre' && f.classi.join(' ') === 'wp-block-code' && !altri.length) {
      return { grezzo: `<!-- wp:code -->\n<pre class="wp-block-code">${dentro(f)}</pre>\n<!-- /wp:code -->` };
    }
    return rifiuta('lo script conosce paragrafo, titoli e codice, senza attributi');
  }

  function blocco(el, slug, sopra) {
    const B = `${prefisso}-block-${slug}`;
    const modificatori = el.classi.filter((c) => c.startsWith(`${B}--`)).map((c) => c.slice(B.length + 2));
    const etichetta = `${sopra ? `${sopra} › ` : ''}${slug}${modificatori.length ? ` (${modificatori.join(', ')})` : ''}`;
    const err = (messaggio) => errori.push(`${etichetta}: ${messaggio}`);
    const c = leggi(slug);
    if (!c) {
      err(`il blocco ${prefisso}/${slug} non ha un README (blocks/${B}/README.md): serve fse-kit`);
      return null;
    }

    const valori = {};            // attributo → valore letto da stile, data-* o modificatore
    const foglie = new Map();     // elemento → i nodi che lo portano, in ordine
    const figli = [];             // blocchi figli e blocchi core, in ordine
    const presenti = new Set();   // modificatori di elemento presenti (`__inner--start`)
    let plugin = null;

    // I link: {p}Text + {p}Url (+ {p}NewTab) ← a.B__{p}; secondary{P}* ← il secondo .B__{p}.
    const gruppi = [];
    for (const a of c.attributi) {
      const m = /^(.+)Text$/.exec(a.nome);
      if (!m || !c.attributo[`${m[1]}Url`]) continue;
      const secondo = /^secondary([A-Z].*)$/.exec(m[1]);
      gruppi.push({ p: m[1], elemento: kebab(secondo ? secondo[1][0].toLowerCase() + secondo[1].slice(1) : m[1]), indice: secondo ? 1 : 0 });
    }
    const deiGruppi = new Set(gruppi.flatMap((g) => [`${g.p}Text`, `${g.p}Url`, `${g.p}NewTab`]));
    const delleVarianti = new Set(['variant', ...c.varianti.map((v) => v.attributo)]);
    const testuali = c.attributi.filter((a) => a.tipo === 'string' && !deiGruppi.has(a.nome) && !RISERVATI.has(a.nome) && !delleVarianti.has(a.nome) && !a.stile && !a.data && !a.modificatore);
    const elementoDi = (a) => a.kit || kebab(a.nome);
    const sonoFoglie = new Set([...testuali.map(elementoDi), ...gruppi.map((g) => g.elemento), ...(c.attributo.imageId ? ['img'] : []), ...(c.attributo.icon ? ['icon'] : [])]);

    // data-* e stile in linea: li legge una nota del README, o il README li nomina (data-*).
    const leggiAttributi = (n, dove) => {
      for (const [nome, v] of Object.entries(n.attr)) {
        if (nome.startsWith('data-')) {
          const a = c.attributi.find((x) => x.data === nome);
          if (a) valori[a.nome] = v;
          else if (!c.parole.has(nome)) err(`attributo «${nome}» su ${dove}: il README non lo nomina`);
        } else if (nome === 'style') {
          for (const dichiarazione of v.split(';').map((d) => d.trim()).filter(Boolean)) {
            const due = dichiarazione.indexOf(':');
            const a = c.attributi.find((x) => x.stile === dichiarazione.slice(0, due).trim());
            if (a) valori[a.nome] = dichiarazione.slice(due + 1).trim();
            else err(`stile in linea «${dichiarazione}» su ${dove}: nessuna nota del README dice che attributo è`);
          }
        }
      }
    };

    const visita = (nodo) => {
      for (const f of nodo.figli) {
        if (f.commento !== undefined) {
          if (f.commento.includes('[da confermare]')) note.push(`${etichetta}: ${spazi(f.commento)}`);
          continue;
        }
        if (f.testo !== undefined) {
          if (f.testo.trim() !== '') err(`testo fuori da un elemento mappato: «${spazi(f.testo).slice(0, 60)}»`);
          continue;
        }
        if (f.grezzo !== undefined) continue;   // svg, script, style: non sono contenuto
        const figlio = slugDi(f);
        if (figlio) { figli.push({ nodo: f, slug: figlio }); continue; }
        const miei = f.classi.filter((k) => k.startsWith(`${B}__`));
        if (!miei.length) {
          if (c.figli.liberi) { figli.push({ core: core(f, err) }); continue; }
          const estranea = f.classi.find((k) => k.startsWith(`${prefisso}-`));
          if (estranea) err(`classe «${estranea}» su ${apertura(f)}: non è un elemento di ${B}`);
          visita(f);
          continue;
        }
        const nomi = [...new Set(miei.map((k) => k.slice(B.length + 2).split('--')[0]))];
        const nome = nomi[0];
        if (nomi.length > 1) err(`${apertura(f)} porta due elementi del blocco (${nomi.map((n) => `__${n}`).join(', ')})`);
        for (const k of f.classi) {
          if (miei.includes(k)) {
            const mod = k.slice(B.length).split('--')[1];
            if (mod === undefined) continue;
            const corto = `__${nome}--${mod}`;
            if (c.attributi.some((a) => a.modificatore && a.modificatore.classe === corto)) presenti.add(corto);
            else if (!c.parole.has(corto) && !c.parole.has(k)) err(`modificatore «${k}»: nessuna nota del README dice che attributo è (${corto})`);
          } else if (!c.parole.has(k)) {
            err(`classe «${k}» su ${B}__${nome}: il README non la nomina`);
          }
        }
        if (c.plugin === nome) { plugin = f; continue; }   // uscita di un plugin: non si legge dentro
        leggiAttributi(f, `${B}__${nome}`);
        if (sonoFoglie.has(nome)) {
          foglie.set(nome, [...(foglie.get(nome) || []), f]);
          continue;
        }
        if (!c.parole.has(`${B}__${nome}`) && !c.parole.has(`__${nome}`)) err(`elemento «${B}__${nome}»: il README non lo nomina, né come attributo né nel markup`);
        visita(f);
      }
    };

    // La radice: classi, id, stile, data-*.
    const attrs = {};
    const colori = {};
    for (const k of el.classi) {
      let m;
      if (k === B || k === `wp-block-${prefisso}-${slug}` || k.startsWith(`${B}--`) || k === 'has-text-color' || k === 'has-background' || /^align(full|wide|left|right|center)$/.test(k)) continue;
      if ((m = /^has-([a-z0-9-]+)-background-color$/.exec(k))) colori.backgroundColor = m[1];
      else if ((m = /^has-([a-z0-9-]+)-color$/.exec(k))) colori.textColor = m[1];
      else if (!c.parole.has(k)) err(`classe «${k}» sulla radice: il README non la nomina`);
    }
    if (Object.keys(colori).length && !c.supports.colore) err(`colore sulla radice (${Object.values(colori).join(', ')}): il README non dichiara color tra i Supports`);
    if (el.attr.id && !c.supports.anchor) err(`id="${el.attr.id}" sulla radice: il README non dichiara anchor tra i Supports`);
    leggiAttributi(el, 'la radice');
    for (const x of modificatori) {
      const riga = c.varianti.find((v) => v.nome === x);
      const nome = riga ? riga.attributo : (c.attributo.variant && (c.attributo.variant.valori || []).includes(x) ? 'variant' : null);
      if (!nome || !c.attributo[nome]) err(`modificatore «${B}--${x}»: non è una riga di ## Varianti del README`);
      else valori[nome] = x;
    }
    visita(el);

    const uno = (nome) => {
      const nodi = foglie.get(nome) || [];
      if (nodi.length > 1) err(`più di un ${B}__${nome}: il README ha un solo attributo per lui`);
      return nodi[0] || null;
    };
    const converti = (a, v) => {
      if (a.tipo === 'boolean') return v === true || v === 'true';
      if (a.tipo !== 'integer' && a.tipo !== 'number') return v;
      const n = Number(v);
      if (Number.isNaN(n)) err(`${a.nome}: «${v}» non è un numero`);
      return n;
    };
    for (const g of gruppi) {
      const nodi = foglie.get(g.elemento) || [];
      const usati = gruppi.filter((x) => x.elemento === g.elemento).length;
      if (g.indice === 0 && nodi.length > usati) err(`un ${B}__${g.elemento} in più (${nodi.length}): il README ha attributi per ${usati}`);
    }

    // Modalità post (vocabolario: postId > 0): il kit mostra l'elemento senza il suo testo.
    const elementoTesto = c.attributo.text ? elementoDi(c.attributo.text) : 'text';
    const daPost = !!c.attributo.postId && !(foglie.get(elementoTesto) || []).length;
    const titolo = uno(c.attributo.title ? elementoDi(c.attributo.title) : 'title');

    for (const a of c.attributi) {
      let v;
      if (daPost) {
        if (a.nome === 'postId') {
          const cercato = titolo ? spazi(decodifica(senzaTag(dentro(titolo)))) : '';
          if (cercato !== SEGNAPOSTO && cercato !== '') richieste.post.add(cercato);
          v = { $post: cercato === SEGNAPOSTO ? { segnaposto: true } : { titolo: cercato } };
        } else if (a.nome === 'postType') {
          v = { $tipo: a.default };
        }
      } else if (delleVarianti.has(a.nome) || a.stile || a.data) {
        if (valori[a.nome] !== undefined) v = converti(a, valori[a.nome]);
      } else if (a.modificatore) {
        if (presenti.has(a.modificatore.classe)) v = converti(a, a.modificatore.valore);
      } else if (a.nome === 'headingLevel') {
        const m = titolo && /^h([2-6])$/.exec(titolo.tag);
        if (m) v = Number(m[1]);
      } else if (deiGruppi.has(a.nome)) {
        const g = gruppi.find((x) => a.nome.startsWith(x.p) && ['Text', 'Url', 'NewTab'].includes(a.nome.slice(x.p.length)));
        const n = (foglie.get(g.elemento) || [])[g.indice];
        if (!n) continue;
        const parte = a.nome.slice(g.p.length);
        const testo = spazi(dentro(n).replace(/<span class="screen-reader-text">[\s\S]*?<\/span>/g, ''));
        const href = decodifica(n.attr.href || '');
        if (parte === 'Text') {
          if (n.tag !== 'a') err(`${B}__${g.elemento} è <${n.tag}>, non un link: ${g.p}Url non ha da dove leggersi`);
          v = testo;
        } else if (parte === 'Url') {
          const bottone = n.classi.includes('wp-element-button');
          if (bottone && (href === '#' || href === '')) note.push(`${etichetta} › «${senzaTag(testo)}»: href "${href}" nel kit → ${a.nome} vuoto, il bottone non si stampa`);
          else v = href;
          if (!bottone && href === '#') note.push(`${etichetta} › «${senzaTag(testo)}»: link "#" tenuto come nel kit`);
        } else if (n.attr.target === '_blank') {
          v = true;
        }
      } else if (a.nome === 'imageId' || a.nome === 'imageUrl' || a.nome === 'imageAlt') {
        const n = uno('img');
        if (!n) continue;
        const src = decodifica(n.attr.src || '');
        const m = /(?:^|\/)assets\/img\/([^/?#]+)$/.exec(src);
        if (!m || n.tag !== 'img') {
          if (a.nome === 'imageId') err(`immagine «${src}» (${apertura(n)}): non è un file di assets/img/ del tema`);
          continue;
        }
        richieste.immagini.add(m[1]);
        v = a.nome === 'imageId' ? { $immagine: m[1] } : a.nome === 'imageUrl' ? { $url: m[1] } : decodifica(n.attr.alt || '');
      } else if (a.nome === 'icon') {
        const n = uno('icon');
        const svg = n && n.figli.find((f) => f.tag === 'svg' && f.grezzo !== undefined);
        if (!svg) continue;
        const trovata = set.find(([, markup]) => markup === senzaSpazi(svg.grezzo));
        if (trovata) v = trovata[0];
        else err(`icona di ${B}__icon non riconosciuta nel set (assets/img/icons/): un SVG della libreria media si sceglie in WordPress, il kit non può dirlo`);
      } else if (a.nome === 'formId') {
        if (!plugin) continue;
        const campo = trova(plugin, (n) => n.tag === 'input' && n.attr.name === 'form_key');
        if (!campo || !campo.attr.value) { err(`${B}__${c.plugin} senza il campo form_key: non so quale form di Formidable è`); continue; }
        richieste.form.add(campo.attr.value);
        v = { $form: campo.attr.value };
      } else if (testuali.includes(a)) {
        const n = uno(elementoDi(a));
        if (!n) continue;
        v = spazi(dentro(n));
        const avvolto = a.nome === 'title' && /^<a\b[^>]*>([\s\S]*)<\/a>$/.exec(v);
        if (avvolto && !avvolto[1].includes('<a')) v = spazi(avvolto[1]);
      }
      if (v !== undefined && v !== a.default) attrs[a.nome] = v;
    }
    if (el.attr.id && c.supports.anchor) attrs.anchor = el.attr.id;
    if (c.supports.colore) Object.assign(attrs, colori);

    // I figli: blocchi core (InnerBlocks liberi) o blocchi che ## Figli nomina.
    const derivati = c.figli.soloIn && modificatori.length && !modificatori.includes(c.figli.soloIn);
    const blocchi = [];
    for (const f of figli) {
      if ('core' in f) {
        if (f.core) blocchi.push(f.core);
      } else if (!c.figli.nomi.includes(f.slug)) {
        err(`contiene ${prefisso}/${f.slug}, che ## Figli del README non nomina`);
      } else if (!derivati) {
        const b = blocco(f.nodo, f.slug, etichetta);
        if (b) { b.posizione = blocchi.length; blocchi.push(b); }
      }
    }
    return { nome: `${prefisso}/${slug}`, etichetta, attrs, figli: blocchi };
  }

  // Un pattern del tema: il suo markup, con i testi del kit al posto dei suoi, nell'ordine.
  function daPattern(el, nome, sorgente) {
    const etichetta = `pattern ${nome}`;
    const corpo = sorgente.replace(/^[\s\S]*?\?>\s*/, '');
    const TESTI = /<(h[1-6]|p)\b([^>]*)>([\s\S]*?)<\/\1>/g;
    const nelPattern = [...corpo.matchAll(TESTI)].map((m) => m[1]);
    const nelKit = [];
    const raccogli = (nodo) => {
      for (const f of nodo.figli) {
        if (!f.tag) continue;
        if (/^(h[1-6]|p)$/.test(f.tag)) nelKit.push(f); else raccogli(f);
      }
    };
    raccogli(el);
    if (corpo.includes('<?')) {
      errori.push(`${etichetta}: il file del pattern ha codice PHP dentro il markup: lo script non sa scriverlo`);
    } else if (nelPattern.join(' ') !== nelKit.map((n) => n.tag).join(' ')) {
      errori.push(`${etichetta}: il kit ha ${nelKit.length} titoli e paragrafi (${nelKit.map((n) => n.tag).join(' ')}), il pattern ${nelPattern.length} (${nelPattern.join(' ')}): non so quale testo va dove`);
    }
    let i = 0;
    const grezzo = corpo.replace(TESTI, (tutto, tag, attr) => (nelKit[i] ? `<${tag}${attr}>${spazi(dentro(nelKit[i++]))}</${tag}>` : tutto));
    return { etichetta, grezzo: grezzo.trim() };
  }

  const blocchi = [];
  let form = 0;
  let titolo = 1;
  for (const f of main.figli) {
    if (f.commento !== undefined) {
      if (f.commento.includes('[da confermare]')) note.push(spazi(f.commento));
      continue;
    }
    if (f.testo !== undefined) {
      if (f.testo.trim() !== '') errori.push(`testo in <main> fuori da una sezione: «${spazi(f.testo).slice(0, 60)}»`);
      continue;
    }
    // Il form di default è telaio: lo stampa il template. Decide solo l'opzione di pagina.
    if (f.classi.includes('wp-block-template-part') && f.classi.includes(`${prefisso}-form-contacts`)) { form = 1; continue; }
    const slug = slugDi(f);
    const nomePattern = f.classi.filter((k) => k.startsWith(`${prefisso}-`)).map((k) => k.slice(prefisso.length + 1)).find((n) => pattern && pattern(n));
    if (slug && f.tag === 'section') {
      const b = blocco(f, slug, '');
      if (b) blocchi.push(b);
    } else if (nomePattern) {
      blocchi.push(daPattern(f, nomePattern, pattern(nomePattern)));
    } else {
      errori.push(`elemento di primo livello non mappato: ${apertura(f)} non è un blocco (section.${prefisso}-block-…), né un pattern del tema, né il form di default`);
      continue;
    }
    if (f.tag === 'h1' || trova(f, (n) => n.tag === 'h1')) titolo = 0;
  }
  return esito(blocchi, { titolo, form });
}

// ---------- serializzazione ----------

// La sequenza \uXXXX di un carattere (composta qui: nel sorgente non si scrive).
const sequenza = (c) => `\\${'u'}${c.charCodeAt(0).toString(16).padStart(4, '0')}`;

// Come serialize_block_attributes di WordPress.
function codifica(attrs) {
  return JSON.stringify(attrs)
    .replace(/--/g, sequenza('-') + sequenza('-'))
    .replace(/</g, sequenza('<'))
    .replace(/>/g, sequenza('>'))
    .replace(/&/g, sequenza('&'))
    .replace(/\\"/g, sequenza('"'));
}

// Il testo del file di blocchi. `risposte` è ciò che WordPress sa: { immagini: { file: { id,
// url } }, post: { titolo: { id, tipo } }, form: { chiave: id }, pagina: [{ chiave, figli:
// [{ postId, postType }] }], ultimo: { id, tipo } | null }. Restituisce { testo, note }.
function serializza(blocchi, risposte) {
  const note = [];
  const visti = {};
  const uno = (b, wp) => {
    if (b.grezzo !== undefined) return b.grezzo;
    const attrs = {};
    let post;
    if (b.attrs.postId && b.attrs.postId.$post) {
      const q = b.attrs.postId.$post;
      const giaLi = wp && wp.figli[b.posizione] && wp.figli[b.posizione].postId ? { id: wp.figli[b.posizione].postId, tipo: wp.figli[b.posizione].postType } : null;
      post = q.segnaposto ? (giaLi || risposte.ultimo || null) : (risposte.post[q.titolo] || null);
      if (!post) note.push(`${b.etichetta}: card senza contenuto: ${q.segnaposto ? 'il sito non ha contenuti pubblicati per la card segnaposto' : `titolo «${q.titolo}» non trovato fra i contenuti pubblicati`} (postId 0: la card non si stampa)`);
    }
    for (const [nome, v] of Object.entries(b.attrs)) {
      if (v === null || typeof v !== 'object') attrs[nome] = v;
      else if ('$immagine' in v) attrs[nome] = risposte.immagini[v.$immagine].id;
      else if ('$url' in v) attrs[nome] = risposte.immagini[v.$url].url;
      else if ('$form' in v) {
        if (risposte.form[v.$form]) attrs[nome] = risposte.form[v.$form];
        else note.push(`${b.etichetta}: il form «${v.$form}» del kit non esiste in Formidable → formId 0, la sezione esce senza campi: form da creare in Formidable`);
      } else if ('$tipo' in v) {
        if (post && post.tipo && post.tipo !== v.$tipo) attrs[nome] = post.tipo;
      } else if ('$post' in v && post) attrs[nome] = post.id;
    }
    // Il blocco che la pagina ha già, nella stessa posizione tra quelli con lo stesso nome.
    let suo = null;
    if (!wp) {
      visti[b.nome] = (visti[b.nome] || 0) + 1;
      suo = (risposte.pagina || []).filter((x) => x.chiave === b.nome)[visti[b.nome] - 1] || null;
    }
    const json = Object.keys(attrs).length ? ` ${codifica(attrs)}` : '';
    if (!b.figli.length) return `<!-- wp:${b.nome}${json} /-->`;
    return `<!-- wp:${b.nome}${json} -->\n${b.figli.map((f) => uno(f, suo || { figli: [] })).join('\n')}\n<!-- /wp:${b.nome} -->`;
  };
  return { testo: blocchi.map((b) => uno(b, null)).join('\n\n'), note };
}

// ---------- progetto, WordPress, riga di comando ----------

function progetto(sito) {
  const designMd = path.join(sito, 'DESIGN.md');
  if (!fs.existsSync(designMd)) throw new Errore(`In ${sito} non c'è DESIGN.md: non è la cartella di un progetto.`);
  const design = fs.readFileSync(designMd, 'utf8');
  if (!eFse(design)) throw new Errore(`${designMd} non è di un progetto wdm-theme (riga theme_family).`);
  const leggi = (nome) => {
    const v = valore(design, nome);
    if (!v) throw new Errore(`In DESIGN.md → Project Config manca la riga \`${nome}\`: la scrive il setup del progetto (fse-theme-setup).`);
    return v;
  };
  return { prefisso: leggi('{prefix}'), tema: path.join(sito, 'wp-content', 'themes', leggi('{theme-folder}')), wp: () => argomenti(leggi('{wp-cli}')) };
}

// WP-CLI con la riga {wp-cli} di DESIGN.md, senza shell. Restituisce stdout.
function wp(riga, args) {
  const [php, ...resto] = riga;
  const r = spawnSync(php, [...resto, ...args], { encoding: 'utf8', timeout: 120000, maxBuffer: 64 * 1024 * 1024 });
  if (r.error || r.status !== 0) {
    throw new Errore(`WordPress non risponde: avvia i server di MAMP PRO e riprova.\n${r.error ? r.error.message : (r.stderr || r.stdout || '').trim()}`);
  }
  return r.stdout;
}

function chiedi(riga, richiesta) {
  const cartella = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-pagina-'));
  try {
    const file = path.join(cartella, 'richiesta.json');
    fs.writeFileSync(file, JSON.stringify(richiesta));
    const uscita = wp(riga, ['eval-file', PHP, file]).trim();
    try {
      return JSON.parse(uscita.split('\n').pop());
    } catch {
      throw new Errore(`risposta di WordPress non leggibile: ${uscita.slice(0, 300)}`);
    }
  } finally {
    fs.rmSync(cartella, { recursive: true, force: true });
  }
}

function esegui(argv) {
  const [sitoDato, pagina, terzo, ...resto] = argv;
  const soloControllo = terzo === 'controlla';
  const pageWp = resto.length === 1 && /^page=.+/.test(resto[0]) ? resto[0].slice(5) : '';
  if (!sitoDato || !pagina || !terzo || (soloControllo ? resto.length : resto.length > 1 || (resto.length === 1 && !pageWp))) {
    console.error(USO);
    return 2;
  }
  const sito = path.resolve(sitoDato);
  const p = progetto(sito);
  const nome = `${p.prefisso}-${pagina}`;
  const fileHtml = path.join(p.tema, 'html', `${nome}.html`);
  if (!fs.existsSync(fileHtml)) throw new Errore(`kit non compilato: manca ${fileHtml}. Lancia npm run build nella cartella del tema (il kit è src/kit/${nome}.kit).`);
  const cartellaIcone = path.join(p.tema, 'assets', 'img', 'icons');
  const icone = {};
  if (fs.existsSync(cartellaIcone)) {
    for (const f of fs.readdirSync(cartellaIcone).filter((x) => x.endsWith('.svg')).sort()) icone[path.basename(f, '.svg')] = fs.readFileSync(path.join(cartellaIcone, f), 'utf8');
  }
  const leggiSe = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null);
  const m = mappa({
    html: fs.readFileSync(fileHtml, 'utf8'),
    prefisso: p.prefisso,
    leggiReadme: (slug) => leggiSe(path.join(p.tema, 'blocks', `${p.prefisso}-block-${slug}`, 'README.md')),
    icone,
    pattern: (x) => leggiSe(path.join(p.tema, 'patterns', `${p.prefisso}-${x}.php`)),
  });
  for (const file of m.richieste.immagini) {
    if (!fs.existsSync(path.join(p.tema, 'assets', 'img', file))) m.errori.push(`immagine «${file}»: il file non è in assets/img/ del tema`);
  }
  if (m.errori.length) {
    console.log(`${nome}: pagina non mappabile (${m.errori.length === 1 ? 'un motivo' : `${m.errori.length} motivi`}): nulla è stato scritto e WordPress non è stato toccato.`);
    for (const e of m.errori) console.log(`  - ${e}`);
    console.log('Si corregge il kit o il README del blocco (fse-kit), mai il file di blocchi a mano.');
    return 3;
  }
  let note = m.note;
  if (!soloControllo) {
    const riga = p.wp();
    const richiesta = { ...m.richieste, pagina: pageWp };
    let risposte = chiedi(riga, richiesta);
    const importate = [];
    for (const file of m.richieste.immagini.filter((f) => !risposte.immagini[f])) {
      importate.push(`${file} (id ${wp(riga, ['media', 'import', path.join(p.tema, 'assets', 'img', file), '--porcelain']).trim()})`);
    }
    if (importate.length) {
      risposte = chiedi(riga, richiesta);
      const perse = m.richieste.immagini.filter((f) => !risposte.immagini[f]);
      if (perse.length) throw new Errore(`immagini importate ma non ritrovate nella libreria media: ${perse.join(', ')}`);
      note = [...note, `immagini importate nella libreria media: ${importate.join(', ')}`];
    }
    const s = serializza(m.blocchi, risposte);
    note = [...note, ...s.note];
    fs.writeFileSync(path.resolve(terzo), `${s.testo}\n`);
    console.log(`${nome}: ${m.blocchi.length} blocchi → ${path.resolve(terzo)}`);
  } else {
    console.log(`${nome}: mappabile, ${m.blocchi.length} blocchi`);
  }
  console.log(`K: ${m.blocchi.map((b) => b.etichetta).join(' · ')}`);
  console.log(`opzioni di pagina: ${p.prefisso}_show_title ${m.opzioni.titolo} (${m.opzioni.titolo ? 'il kit non ha un h1 suo: lo dà il titolo del template' : 'il kit ha il suo h1'}) · ${p.prefisso}_show_form ${m.opzioni.form} (${m.opzioni.form ? 'il kit stampa il form di default' : 'il kit non stampa il form di default'})`);
  for (const n of note) console.log(`nota — ${n}`);
  return 0;
}

module.exports = { contratto, mappa, serializza };

if (require.main === module) {
  try {
    process.exitCode = esegui(process.argv.slice(2));
  } catch (errore) {
    if (!(errore instanceof Errore)) throw errore;
    console.error(`kit-pagina: ${errore.message}`);
    process.exitCode = 2;
  }
}
