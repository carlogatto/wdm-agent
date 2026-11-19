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

  // Lotto 7.3, lettura cieca dei README. Il README della site root e quello del tema viaggiano
  // in ogni progetto: non possono dire cose vere solo nell'installazione del tema base.
  it('README della site root: gli stessi gate e gli stessi controlli degli altri due README', () => {
    const readme = leggi('README.md');
    assert.match(readme, /Decidi tre cose: l'ok a un gate/, 'il gate del brief non è un kit');
    assert.match(readme.split('\n').find((r) => r.includes('**gate 1**')), /:8848/, "il gate 1 non cita l'anteprima dei blocchi nel brand nuovo");
    assert.match(readme.split('\n').find((r) => r.startsWith('| `npm run check`')), /SVG/, 'la riga di npm run check non nomina il controllo degli SVG');
    assert.match(readme.split('### Un progetto nuovo')[1].split('###')[0], /clon/, 'non dice in quale caso è chi ha clonato il tema base');
    assert.doesNotMatch(readme, /A fine sessione `debug\.log` vuoto/, 'la regola di fine sessione non dice chi la applica');
    assert.match(readme, /Node\.js 22 o successivo/, 'la versione di Node non è scritta come negli altri due README');
    assert.match(readme.split('### Un progetto nuovo')[1].split('###')[0], /senza accenti/, 'la regola del nome della cartella non è quella del README del plugin');
  });

  it('README del tema: ogni controllo di npm run check è nominato', () => {
    const controlli = [...JSON.parse(leggi(sito.TEMA_BASE, 'package.json')).scripts.check.matchAll(/tools\/(check-[a-z-]+\.js)/g)].map((m) => m[1]);
    assert.ok(controlli.length >= 7, `controlli trovati: ${controlli.length}`);
    const readme = leggi(sito.TEMA_BASE, 'README.md');
    for (const controllo of controlli) assert.ok(readme.includes(controllo), `nel README del tema manca ${controllo}`);
  });

  it('README del tema: nessun id del database del tema base, nessuno script che il repo non contiene', () => {
    const readme = leggi(sito.TEMA_BASE, 'README.md');
    assert.deepEqual(trovate([path.join(sito.TEMA_BASE, 'README.md')], /\b69\b|\b70\b|\b71\b/), [], 'id dei menu del tema base');
    assert.deepEqual(trovate([path.join(sito.TEMA_BASE, 'README.md')], /pw-(?!pagina|blocco|kit)[a-z0-9-]+\.js/), [], 'script di .playwright-mcp/, ignorata da git');
    assert.doesNotMatch(readme, /nello starter: "Home"/, '«starter» qui è il tema base');
    assert.match(readme, /wdm-starter \(/, 'wdm-starter va spiegato alla prima occorrenza');
    assert.doesNotMatch(readme, /blocks\/\{slug\}\//, 'la cartella di un blocco è blocks/wdm-block-{slug}/');
    assert.match(readme, /(agente|setup)[^\n]*`npm install`/, 'non dice chi lancia npm install');
  });

  it('i tre elenchi nominano gli stessi blocchi che stanno su disco', () => {
    const nomi = (testo, modello) => [...testo.matchAll(modello)].map((m) => m[1]).sort();
    assert.deepEqual(nomi(leggi('CLAUDE.md').split('### Existing Blocks')[1].split(/^## /m)[0], /^- `\{prefix\}-block-([a-z-]+)` — `\{prefix\}\/\1`$/gm), blocchi(), 'CLAUDE.md → Existing Blocks');
    assert.deepEqual(nomi(leggi(sito.TEMA_BASE, 'README.md'), /^- `wdm\/([a-z-]+)` — \[`blocks\/wdm-block-\1\/README\.md`\]/gm), blocchi(), 'README del tema → Blocchi');
    assert.deepEqual(nomi(design().split(/^## Blocchi$/m)[1].split(/^## /m)[0], /^\| wdm\/([a-z-]+) \| (?:kit|implementato) \|/gm), blocchi(), 'DESIGN.md → Blocchi');
  });
});
