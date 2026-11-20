// Ciò che gli hook hanno in comune. Per i due di Write e Edit: il file appena scritto, se sta
// dentro un tema di un progetto FSE (DESIGN.md → theme_family: fse); altrimenti null, e l'hook
// non giudica. Per quelli di fine turno e di avvio: la site root del progetto in cui si lavora.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { eFse, valore } = require('../../shared/scripts/lib/design-md.js');
const { nelTema } = require('../../shared/scripts/lib/tema.js');

// { file, sito, tema, resto, design } oppure null.
function fileDelTema() {
  let dati;
  try {
    dati = JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    return null;
  }
  const scritto = dati && dati.tool_input && dati.tool_input.file_path;
  if (typeof scritto !== 'string' || scritto === '') return null;
  const file = path.resolve(typeof dati.cwd === 'string' ? dati.cwd : process.cwd(), scritto);
  const posto = nelTema(file);
  if (!posto || !fs.existsSync(file)) return null;
  const designMd = path.join(posto.sito, 'DESIGN.md');
  if (!fs.existsSync(designMd)) return null;
  const design = fs.readFileSync(designMd, 'utf8');
  if (!eFse(design)) return null;
  // Con la riga {theme-folder} si giudica solo il tema del progetto, non gli altri installati.
  const cartella = valore(design, '{theme-folder}');
  if (cartella && path.basename(posto.tema) !== cartella) return null;
  return { file, ...posto, design };
}

// La site root del progetto FSE che contiene `cartella` (le skill lavorano anche dentro il tema),
// o null.
function sitoDi(cartella) {
  for (let c = path.resolve(cartella); ; c = path.dirname(c)) {
    const design = path.join(c, 'DESIGN.md');
    if (fs.existsSync(design) && eFse(fs.readFileSync(design, 'utf8'))) return c;
    if (c === path.dirname(c)) return null;
  }
}

module.exports = { fileDelTema, sitoDi };
