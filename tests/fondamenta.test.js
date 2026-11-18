// Le convenzioni del prodotto e il flusso a tre gate sono scritti nelle fondamenta: ogni voce
// dell'elenco è un termine che le skill citano e che deve restare definito lì.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const fondamenta = fs.readFileSync(path.join(__dirname, '..', 'shared', 'fse-foundations.md'), 'utf8');

const TERMINI = [
  '_section.scss', 'Shared attribute vocabulary', 'headingLevel', 'token-exception', '_focus.scss',
  '_motion.scss', '{prefix}-swiper', '--wp--custom--shadow--', 'keywords', 'in_array(',
  'aria-expanded', 'reverse', 'Six moments, three gates', 'The decision charter',
  '[da confermare]', 'da eliminare', '## Brief', 'kit {item} in revisione', 'build sito: pagina',
  'The handover message', 'Prossimo passo', 'sessione.js', 'chiudi-sessione.js', 'pw-pagina.js',
  'without a password', '_fse_build',
];

for (const termine of TERMINI) {
  test(`le fondamenta definiscono «${termine}»`, () => {
    assert.ok(fondamenta.includes(termine));
  });
}
