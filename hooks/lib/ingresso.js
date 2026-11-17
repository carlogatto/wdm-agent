// Ciò che i due hook hanno in comune: il file appena scritto da Write o Edit, se sta dentro un
// tema di un progetto FSE (DESIGN.md → theme_family: fse). Altrimenti null: l'hook non giudica.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { eFse } = require('../../shared/scripts/lib/design-md.js');
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
  return eFse(design) ? { file, ...posto, design } : null;
}

module.exports = { fileDelTema };
