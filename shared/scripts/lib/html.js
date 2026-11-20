// Lettura minima dell'HTML, senza pacchetti: l'albero degli elementi con le loro classi. Serve al
// confronto di struttura tra kit e sito (parita.js): testi, attributi diversi da `class`,
// commenti, script, stili e SVG non entrano nell'albero.

'use strict';

const VUOTI = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
// Commento · elemento il cui contenuto non è HTML da leggere (non chiuso su se stesso: un
// <svg … /> non ha contenuto) · tag di chiusura · tag di apertura.
const ATTRIBUTI = `(?:[^>"']|"[^"]*"|'[^']*')*`;
const PEZZO = new RegExp(`<!--[\\s\\S]*?-->|<(script|style|template|svg|noscript)\\b${ATTRIBUTI}(?<!\\/)>[\\s\\S]*?<\\/\\1\\s*>|<\\/([a-zA-Z][\\w:-]*)\\s*>|<([a-zA-Z][\\w:-]*)(${ATTRIBUTI})>`, 'g');
// Un attributo alla volta: così `class=` scritto dentro il valore di un altro non conta.
const ATTRIBUTO = /([^\s"'=<>\/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

function classi(attributi) {
  for (const m of attributi.matchAll(ATTRIBUTO)) {
    if (m[1].toLowerCase() === 'class') return (m[2] ?? m[3] ?? m[4] ?? '').split(/\s+/).filter(Boolean);
  }
  return [];
}

// { tag, classi: [..], figli: [..] } a partire da una radice senza tag.
function albero(html) {
  const radice = { tag: '', classi: [], figli: [] };
  const pila = [radice];
  for (const m of String(html).matchAll(PEZZO)) {
    if (m[2]) {
      // Un tag di chiusura chiude l'elemento aperto più vicino con quel nome; se non c'è, si ignora.
      const tag = m[2].toLowerCase();
      for (let i = pila.length - 1; i > 0; i--) {
        if (pila[i].tag === tag) { pila.length = i; break; }
      }
    } else if (m[3]) {
      const tag = m[3].toLowerCase();
      const nodo = { tag, classi: classi(m[4] || ''), figli: [] };
      pila[pila.length - 1].figli.push(nodo);
      if (!VUOTI.has(tag) && !/\/\s*$/.test(m[4] || '')) pila.push(nodo);
    }
  }
  return radice;
}

function attributi(testo) {
  const trovati = {};
  for (const m of testo.matchAll(ATTRIBUTO)) {
    const nome = m[1].toLowerCase();
    if (!(nome in trovati)) trovati[nome] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return trovati;
}

// Il documento intero, per chi deve leggere anche i valori (kit-pagina.js): elementi con
// attributi e classi, testi ({ testo }) e commenti ({ commento }) tra i figli, nell'ordine.
// `dentroDa` e `dentroA` sono le posizioni dell'HTML interno in `sorgente` (sulla radice).
// Un elemento il cui contenuto non è HTML (svg, script, style) non ha figli: ha `grezzo`.
function documento(html) {
  const sorgente = String(html);
  const radice = { tag: '', attr: {}, classi: [], figli: [], dentroDa: 0, dentroA: sorgente.length, sorgente };
  const pila = [radice];
  let letto = 0;
  const testoFino = (fine) => {
    if (fine > letto) pila[pila.length - 1].figli.push({ testo: sorgente.slice(letto, fine) });
  };
  for (const m of sorgente.matchAll(PEZZO)) {
    testoFino(m.index);
    letto = m.index + m[0].length;
    const sopra = pila[pila.length - 1];
    if (m[0].startsWith('<!--')) {
      sopra.figli.push({ commento: m[0].slice(4, -3).trim() });
    } else if (m[1]) {
      const apertura = /^<[a-zA-Z][\w:-]*((?:[^>"']|"[^"]*"|'[^']*')*)>/.exec(m[0]);
      const attr = attributi(apertura ? apertura[1] : '');
      sopra.figli.push({ tag: m[1].toLowerCase(), attr, classi: (attr.class || '').split(/\s+/).filter(Boolean), figli: [], grezzo: m[0] });
    } else if (m[2]) {
      const tag = m[2].toLowerCase();
      for (let i = pila.length - 1; i > 0; i--) {
        if (pila[i].tag !== tag) continue;
        for (let j = i; j < pila.length; j++) pila[j].dentroA = m.index;
        pila.length = i;
        break;
      }
    } else if (m[3]) {
      const tag = m[3].toLowerCase();
      const attr = attributi(m[4] || '');
      const nodo = { tag, attr, classi: (attr.class || '').split(/\s+/).filter(Boolean), figli: [], dentroDa: letto, dentroA: letto };
      sopra.figli.push(nodo);
      if (!VUOTI.has(tag) && !/\/\s*$/.test(m[4] || '')) pila.push(nodo);
    }
  }
  testoFino(sorgente.length);
  for (let j = 1; j < pila.length; j++) pila[j].dentroA = sorgente.length;
  return radice;
}

module.exports = { albero, documento };
