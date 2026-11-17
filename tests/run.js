#!/usr/bin/env node
// Esegue le prove del plugin e dà il verdetto. Dalla radice del plugin:
//
//   node tests/run.js                       tutte le prove
//   node tests/run.js --senza claude,sito   senza i gruppi nominati
//
// Le prove sono i file *.test.js di tests/ (chiedono solo Node) e delle sue sottocartelle, una
// per requisito: bash/ (bash e jq), claude/ (la CLI di Claude Code con il plugin installato),
// sito/ (il sito di prova, tests/sito.example.json).
//
// Verdetto: «TUTTO VERDE» solo se ogni prova è stata eseguita ed è passata. Con un gruppo
// escluso da --senza è «VERDE IN PARTE», e il gruppo è nominato. Una prova fallita, saltata o
// da fare dà «NON VERDE» ed exit 1: una prova saltata non vale una prova passata. Lo stesso un
// file che non riporta le sue prove (nessuna prova dentro, o processo uscito prima della fine).
//
// --radice <cartella> sostituisce tests/: serve alla prova dell'esecutore (esecutore.test.js).

const { run } = require('node:test');
const { spec } = require('node:test/reporters');
const fs = require('node:fs');
const path = require('node:path');

function errore(messaggio) {
  console.error(`run: ${messaggio}\nUso: node tests/run.js [--senza gruppo[,gruppo]]`);
  process.exit(2);
}

// Un argomento non riconosciuto è un errore: «--senza=sito» ignorato lancerebbe proprio quel gruppo.
const opzioni = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 2) {
  const nome = argv[i];
  if (!['--senza', '--radice'].includes(nome) || nome in opzioni || !argv[i + 1]) {
    errore(`argomento non valido: ${argv.slice(i, i + 2).join(' ')}`);
  }
  opzioni[nome] = argv[i + 1];
}

const radice = path.resolve(opzioni['--radice'] || __dirname);
const senza = (opzioni['--senza'] || '').split(',').filter(Boolean);
const PROVA = /\.test\.[cm]?js$/;

function prove(cartella) {
  return fs.readdirSync(cartella).filter((f) => f.endsWith('.test.js')).sort().map((f) => path.join(cartella, f));
}

const gruppi = fs.readdirSync(radice, { withFileTypes: true })
  .filter((e) => e.isDirectory() && prove(path.join(radice, e.name)).length > 0)
  .map((e) => e.name)
  .sort();

const ignoti = senza.filter((g) => !gruppi.includes(g));
if (ignoti.length) {
  errore(`gruppo sconosciuto in --senza: ${ignoti.join(', ')}. Gruppi presenti: ${gruppi.join(', ') || 'nessuno'}.`);
}

// Una prova dove l'esecutore non guarda (più in profondità, o con un'altra estensione) non
// girerebbe mai, in silenzio. Le cartelle fixtures/ non contengono prove del plugin.
function tutteLeProve(cartella) {
  return fs.readdirSync(cartella, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(cartella, e.name);
    if (e.isDirectory()) return ['fixtures', 'node_modules'].includes(e.name) ? [] : tutteLeProve(p);
    return PROVA.test(e.name) ? [p] : [];
  });
}

const note = [...prove(radice), ...gruppi.flatMap((g) => prove(path.join(radice, g)))];
const fuoriPosto = tutteLeProve(radice).filter((f) => !note.includes(f));
if (fuoriPosto.length) {
  errore(`prove che non verrebbero eseguite: ${fuoriPosto.map((f) => path.relative(radice, f)).join(', ')}. Le prove stanno in tests/ o in una sua sottocartella diretta, con estensione .test.js.`);
}

const files = [...prove(radice), ...gruppi.filter((g) => !senza.includes(g)).flatMap((g) => prove(path.join(radice, g)))];

let passate = 0;
const fallite = [];
const saltate = [];
// Per file: prove annunciate e prove concluse. Devono coincidere, e non essere zero.
const conti = new Map(files.map((f) => [f, { accodate: 0, concluse: 0 }]));

function voce(d) {
  return `${path.relative(radice, d.file || '')} › ${d.name}`;
}

// Node riporta come una prova riuscita il file che esce con 0 senza aver riportato le sue.
function delFile(d) {
  return d.name === d.file;
}

function verdetto() {
  for (const [file, c] of conti) {
    const nome = path.relative(radice, file);
    if (c.concluse === 0) {
      fallite.push(`${nome}: nessuna prova riportata (file senza prove, o processo uscito prima della fine)`);
    } else if (c.accodate !== c.concluse) {
      fallite.push(`${nome}: ${c.accodate} prove annunciate, ${c.concluse} concluse (processo uscito prima della fine?)`);
    }
  }
  const n = `${passate} ${passate === 1 ? 'prova passata' : 'prove passate'}`;
  if (files.length === 0) {
    console.log('NON VERDE: nessuna prova eseguita.');
    return 1;
  }
  if (fallite.length || saltate.length) {
    console.log(`NON VERDE: ${fallite.length} fallite, ${saltate.length} saltate (${n}).`);
    for (const f of fallite) console.log(`  fallita  ${f}`);
    for (const s of saltate) console.log(`  saltata  ${s}`);
    return 1;
  }
  if (senza.length) {
    console.log(`VERDE IN PARTE: ${n}; gruppi non eseguiti per scelta (--senza): ${senza.join(', ')}.`);
    return 0;
  }
  console.log(`TUTTO VERDE: ${n}, nessuna saltata.`);
  return 0;
}

if (files.length === 0) {
  process.exit(verdetto());
}

// Un file alla volta: le prove del gruppo sito azzerano lo stesso sito di prova.
const eventi = run({ files, concurrency: 1 });

eventi.on('test:enqueue', (d) => {
  if (conti.has(d.file) && !delFile(d)) conti.get(d.file).accodate++;
});

eventi.on('test:pass', (d) => {
  if (delFile(d)) return;
  if (conti.has(d.file)) conti.get(d.file).concluse++;
  // Il riepilogo di node --test non conta un gruppo (describe) saltato: qui si conta tutto.
  const motivo = d.skip !== undefined ? d.skip : d.todo;
  if (motivo !== undefined) {
    saltate.push(`${voce(d)}: ${typeof motivo === 'string' && motivo ? motivo : 'senza motivo'}`);
  } else if (!d.details || d.details.type !== 'suite') {
    passate++;
  }
});

eventi.on('test:fail', (d) => {
  if (conti.has(d.file) && !delFile(d)) conti.get(d.file).concluse++;
  const dettaglio = d.details && d.details.error;
  // Il genitore di una prova fallita fallisce a sua volta: si conta solo la prova.
  if (dettaglio && dettaglio.failureType === 'subtestsFailed') return;
  if (d.todo !== undefined) {
    saltate.push(`${voce(d)}: ${typeof d.todo === 'string' && d.todo ? d.todo : 'da fare'}`);
  } else {
    fallite.push(voce(d));
  }
});

const uscita = eventi.compose(new spec());
uscita.pipe(process.stdout, { end: false });
uscita.on('end', () => {
  process.exitCode = verdetto();
});
