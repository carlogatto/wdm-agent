// Riconosce un file dentro un tema di WordPress: {sito}/wp-content/themes/{tema}/…
// Il modulo dei percorsi è un argomento: con path.win32 la stessa funzione si prova su macOS.

'use strict';

const path = require('node:path');

// { sito, tema, resto } per un percorso assoluto dentro un tema, altrimenti null.
// `resto` sono i segmenti dopo la cartella del tema (es. ['blocks', 'abc-block-hero', 'block.json']).
function nelTema(file, p = path) {
  const parti = p.normalize(file).split(p.sep);
  const i = parti.lastIndexOf('themes');
  if (i < 2 || parti[i - 1] !== 'wp-content' || parti.length < i + 3) return null;
  return {
    sito: parti.slice(0, i - 1).join(p.sep),
    tema: parti.slice(0, i + 2).join(p.sep),
    resto: parti.slice(i + 2),
  };
}

module.exports = { nelTema };
