// DESIGN.md → Project Config: lettura e scrittura delle righe `| `nome` | valore |`, e la riga
// {wp-cli} come elenco di argomenti. Lo usano gli hook, il sync dei token e il setup.
//
// {wp-cli} è una riga di comando scritta per bash (su Windows: Git Bash). Chi la esegue da Node
// la divide con argomenti() e lancia il primo elemento senza shell; chi la scrive usa comando().

'use strict';

function modello(nome) {
  return new RegExp('^\\|[ \\t]*`' + nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '`[ \\t]*\\|[ \\t]*(.*?)[ \\t]*\\|[ \\t]*$', 'm');
}

// Il valore della riga, o null se la riga non c'è.
function valore(testo, nome) {
  const m = modello(nome).exec(testo);
  return m ? m[1] : null;
}

function eFse(testo) {
  return valore(testo, 'theme_family') === 'fse';
}

// Sostituisce il valore della riga; se manca, la aggiunge in fondo alla tabella di ### Paths.
function imposta(testo, nome, nuovo) {
  const riga = `| \`${nome}\` | ${nuovo} |`;
  if (modello(nome).test(testo)) return testo.replace(modello(nome), () => riga);
  const righe = testo.split('\n');
  const inizio = righe.findIndex((r) => /^### Paths\s*$/.test(r));
  if (inizio === -1) throw new Error(`DESIGN.md non ha la sezione "### Paths": non so dove scrivere \`${nome}\`.`);
  let fine = inizio + 1;
  while (fine < righe.length && !righe[fine].startsWith('|')) {
    if (righe[fine].startsWith('#')) throw new Error('DESIGN.md: la sezione "### Paths" non ha una tabella.');
    fine++;
  }
  while (fine < righe.length && righe[fine].startsWith('|')) fine++;
  righe.splice(fine, 0, riga);
  return righe.join('\n');
}

// Divide una riga di comando come farebbe bash: spazi fuori dalle virgolette separano, gli apici
// singoli sono letterali, tra virgolette doppie la barra rovesciata protegge solo " \ $ e `.
function argomenti(riga) {
  const trovati = [];
  let corrente = null;
  let dentro = null;
  for (let i = 0; i < riga.length; i++) {
    const c = riga[i];
    if (dentro === "'") {
      if (c === "'") dentro = null; else corrente += c;
    } else if (dentro === '"') {
      if (c === '"') dentro = null;
      else if (c === '\\' && '"\\$`'.includes(riga[i + 1])) corrente += riga[++i];
      else corrente += c;
    } else if (c === '"' || c === "'") {
      dentro = c;
      if (corrente === null) corrente = '';
    } else if (/\s/.test(c)) {
      if (corrente !== null) trovati.push(corrente);
      corrente = null;
    } else if (c === '\\' && i + 1 < riga.length) {
      corrente = (corrente || '') + riga[++i];
    } else {
      corrente = (corrente || '') + c;
    }
  }
  if (dentro) throw new Error(`riga di comando con una virgoletta non chiusa: ${riga}`);
  if (corrente !== null) trovati.push(corrente);
  return trovati;
}

// Ricompone gli argomenti in una riga: virgolette doppie solo dove servono.
function comando(argv) {
  return argv.map((a) => (/^[A-Za-z0-9_.,:=\/@%+-]+$/.test(a) ? a : `"${a.replace(/(["\\$`])/g, '\\$1')}"`)).join(' ');
}

module.exports = { valore, eFse, imposta, argomenti, comando };
