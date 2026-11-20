// DESIGN.md → Project Config: lettura e scrittura delle righe `| `nome` | valore |`, e la riga
// {wp-cli} come elenco di argomenti; le tabelle di stato (## Telaio, ## Pagine). Lo usano gli
// hook, il sync dei token, il setup, la parità e il controllo.
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

// Le righe di una tabella sotto un titolo `## …`, come oggetti { colonna minuscola: valore }.
function tabella(design, titolo) {
  const righe = design.split(/\r?\n/);
  const inizio = righe.findIndex((r) => r.trim() === `## ${titolo}`);
  if (inizio === -1) return [];
  const celle = (riga) => riga.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const corpo = [];
  for (let i = inizio + 1; i < righe.length && !/^## /.test(righe[i]); i++) {
    if (righe[i].trim().startsWith('|')) corpo.push(righe[i]);
    else if (corpo.length) break;
  }
  if (corpo.length < 3) return [];
  const colonne = celle(corpo[0]).map((c) => c.toLowerCase());
  return corpo.slice(2).map((riga) => Object.fromEntries(celle(riga).map((valore, i) => [colonne[i] || `col${i}`, valore])));
}

module.exports = { valore, eFse, imposta, argomenti, comando, tabella };
