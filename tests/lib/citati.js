// I file del plugin che skill, fondamenta e hooks.json citano come ${CLAUDE_PLUGIN_ROOT}/…
// Le prove li ricavano dai testi: uno script citato e mai provato non può esistere.
const fs = require('node:fs');
const path = require('node:path');

const RADICE = path.join(__dirname, '..', '..');

function testi() {
  const skills = path.join(RADICE, 'skills');
  const shared = path.join(RADICE, 'shared');
  return [
    ...fs.readdirSync(skills).map((s) => path.join(skills, s, 'SKILL.md')).filter((f) => fs.existsSync(f)),
    ...fs.readdirSync(shared).filter((f) => f.endsWith('.md')).map((f) => path.join(shared, f)),
    path.join(RADICE, 'hooks', 'hooks.json'),
  ];
}

// Percorsi relativi alla radice del plugin, con la barra, senza doppioni. `estensione` filtra.
function citati(estensione) {
  const trovati = new Set();
  for (const file of testi()) {
    for (const m of fs.readFileSync(file, 'utf8').matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/([A-Za-z0-9_.\/-]+\.[a-z]+)/g)) {
      trovati.add(m[1]);
    }
  }
  return [...trovati].sort().filter((f) => !estensione || f.endsWith(estensione));
}

module.exports = { RADICE, citati, assoluto: (relativo) => path.join(RADICE, ...relativo.split('/')) };
