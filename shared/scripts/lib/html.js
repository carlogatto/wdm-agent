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

module.exports = { albero };
