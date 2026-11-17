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
// da fare dà «NON VERDE» ed exit 1: una prova saltata non vale una prova passata.
//
// --radice <cartella> sostituisce tests/: serve alla prova dell'esecutore (esecutore.test.js).

const { run } = require('node:test');
const { spec } = require('node:test/reporters');
const fs = require('node:fs');
const path = require('node:path');

const argv = process.argv.slice(2);
function opzione(nome) {
  const i = argv.indexOf(nome);
  return i === -1 ? null : argv[i + 1] || '';
}

const radice = path.resolve(opzione('--radice') || __dirname);
const senza = (opzione('--senza') || '').split(',').filter(Boolean);

function prove(cartella) {
  return fs.readdirSync(cartella).filter((f) => f.endsWith('.test.js')).sort().map((f) => path.join(cartella, f));
}

const gruppi = fs.readdirSync(radice, { withFileTypes: true })
  .filter((e) => e.isDirectory() && prove(path.join(radice, e.name)).length > 0)
  .map((e) => e.name)
  .sort();

const ignoti = senza.filter((g) => !gruppi.includes(g));
if (ignoti.length) {
  console.error(`run: gruppo sconosciuto in --senza: ${ignoti.join(', ')}. Gruppi presenti: ${gruppi.join(', ') || 'nessuno'}.`);
  process.exit(2);
}

const files = [...prove(radice), ...gruppi.filter((g) => !senza.includes(g)).flatMap((g) => prove(path.join(radice, g)))];

let passate = 0;
const fallite = [];
const saltate = [];

function voce(d) {
  return `${path.relative(radice, d.file || '')} › ${d.name}`;
}

function verdetto() {
  const n = `${passate} ${passate === 1 ? 'prova passata' : 'prove passate'}`;
  if (fallite.length || saltate.length) {
    console.log(`NON VERDE: ${fallite.length} fallite, ${saltate.length} saltate (${n}).`);
    for (const f of fallite) console.log(`  fallita  ${f}`);
    for (const s of saltate) console.log(`  saltata  ${s}`);
    return 1;
  }
  if (passate === 0) {
    console.log('NON VERDE: nessuna prova eseguita.');
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

eventi.on('test:pass', (d) => {
  // Il riepilogo di node --test non conta un gruppo (describe) saltato: qui si conta tutto.
  const motivo = d.skip !== undefined ? d.skip : d.todo;
  if (motivo !== undefined) {
    saltate.push(`${voce(d)}: ${typeof motivo === 'string' && motivo ? motivo : 'senza motivo'}`);
  } else if (d.details && d.details.type === 'test') {
    passate++;
  }
});

eventi.on('test:fail', (d) => {
  const errore = d.details && d.details.error;
  // Il genitore di una prova fallita fallisce a sua volta: si conta solo la prova.
  if (errore && errore.failureType === 'subtestsFailed') return;
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
