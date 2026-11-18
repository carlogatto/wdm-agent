// I testi del tema base (wdm-theme), letti dalla copia di lavoro e mai scritti: nessun residuo
// del flusso a quattro gate né della password dell'agente, e una fonte sola per le varianti di
// un blocco, il suo README (U30). Le tabelle di stato dicono quali blocchi esistono, non come sono.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sito = require('../lib/sito');

describe('testi del tema base', { skip: sito.nonDisponibile() || false }, () => {
  const base = sito.leggiConfig().base;
  const tema = path.join(base, sito.TEMA_BASE);
  const leggi = (...relativo) => fs.readFileSync(path.join(base, ...relativo), 'utf8');
  // DESIGN.md: lo stato di oggi. Domande aperte e Log decisioni raccontano la storia.
  const design = () => leggi('DESIGN.md').split(/^## Domande aperte/m)[0];
  const blocchi = () => fs.readdirSync(path.join(tema, 'blocks'), { withFileTypes: true }).filter((v) => v.isDirectory()).map((v) => v.name.replace(/^wdm-block-/, '')).sort();
  const kit = () => fs.readdirSync(path.join(tema, 'src', 'kit')).filter((f) => f.endsWith('.kit')).map((f) => path.join(sito.TEMA_BASE, 'src', 'kit', f));
  const html = () => fs.readdirSync(path.join(tema, 'html')).filter((f) => f.endsWith('.html')).map((f) => path.join(sito.TEMA_BASE, 'html', f));
  const testi = () => ['README.md', 'CLAUDE.md', path.join(sito.TEMA_BASE, 'README.md'), ...kit(), ...html()];
  const trovate = (elenco, modello) => elenco.flatMap((f) => leggi(f).split('\n').flatMap((riga, i) => (modello.test(riga) ? [`${f}:${i + 1}: ${riga.trim().slice(0, 100)}`] : [])));

  it('il flusso ha tre gate: nessun «quattro gate» nei README, in CLAUDE.md, nei kit e nei kit compilati', () => {
    assert.deepEqual(trovate(testi(), /quattro\s+gate|gate[-\s]+4\b|four\s+gates/i), []);
    assert.deepEqual(design().split('\n').filter((riga) => /quattro\s+gate|gate[-\s]+4\b/i.test(riga)), []);
  });

  it('nessuna password dell\'agente: né .env né AGENT_ADMIN nei testi che descrivono il progetto', () => {
    assert.deepEqual(trovate(['README.md', 'CLAUDE.md', path.join(sito.TEMA_BASE, 'README.md')], /AGENT_ADMIN_|\.env\b|\{password\}/), []);
    assert.deepEqual(design().split('\n').filter((riga) => /AGENT_ADMIN_|\.env\b/.test(riga)), []);
  });

  it('le varianti stanno solo nel README del blocco: le altre tabelle sono elenchi di nomi', () => {
    for (const [file, testo] of [['CLAUDE.md', leggi('CLAUDE.md')], ['DESIGN.md', design()], ['README del tema', leggi(sito.TEMA_BASE, 'README.md')]]) {
      assert.doesNotMatch(testo, /^\|[^\n]*\b(Variants|Varianti)\b[^\n]*\|\s*$/m, `${file} ha ancora una tabella con le varianti`);
    }
    for (const slug of blocchi()) assert.match(leggi(sito.TEMA_BASE, 'blocks', `wdm-block-${slug}`, 'README.md'), /^## Varianti$/m, slug);
  });

  it('i tre elenchi nominano gli stessi blocchi che stanno su disco', () => {
    const nomi = (testo, modello) => [...testo.matchAll(modello)].map((m) => m[1]).sort();
    assert.deepEqual(nomi(leggi('CLAUDE.md').split('### Existing Blocks')[1].split(/^## /m)[0], /^- `\{prefix\}-block-([a-z-]+)` — `\{prefix\}\/\1`$/gm), blocchi(), 'CLAUDE.md → Existing Blocks');
    assert.deepEqual(nomi(leggi(sito.TEMA_BASE, 'README.md'), /^- `wdm\/([a-z-]+)` — \[`blocks\/wdm-block-\1\/README\.md`\]/gm), blocchi(), 'README del tema → Blocchi');
    assert.deepEqual(nomi(design().split(/^## Blocchi$/m)[1].split(/^## /m)[0], /^\| wdm\/([a-z-]+) \| (?:kit|implementato) \|/gm), blocchi(), 'DESIGN.md → Blocchi');
  });
});
