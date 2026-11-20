// I testi del plugin descrivono il sistema com'è oggi: nessun rimando a piani o fasi di piano,
// nessun residuo di regole superate (U30).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RADICE = path.join(__dirname, '..');

function file(cartella) {
  return fs.readdirSync(cartella, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(cartella, e.name);
    return e.isDirectory() ? file(p) : e.name === '.DS_Store' ? [] : [p];
  });
}

// Righe che il `filtro` segnala, come «file:riga: testo».
function righe(elenco, filtro) {
  return elenco.flatMap((f) => {
    const r = fs.readFileSync(f, 'utf8').split('\n');
    return r.flatMap((riga, i) => (filtro(riga, i, r) ? [`${path.relative(RADICE, f)}:${i + 1}: ${riga.trim()}`] : []));
  });
}

const SKILL_E_FONDAMENTA = [...file(path.join(RADICE, 'skills')), path.join(RADICE, 'shared', 'fse-foundations.md')];
const TESTI = [...file(path.join(RADICE, 'skills')), ...file(path.join(RADICE, 'shared')), ...file(path.join(RADICE, 'hooks')), path.join(RADICE, 'README.md')];

// Le «Phase 1–5» di fse-theme-setup sono le sue fasi di esecuzione e non rientrano nel modello.
test('skill e fondamenta non citano piani, fasi di piano o decisioni numerate', () => {
  const piano = /decision [0-9]+ of the plan|Phase [0-9]+ M[0-9]+|\bTask [0-9]+\b|docs\/superpowers\/plans|dry run Phase/;
  assert.deepEqual(righe(SKILL_E_FONDAMENTA, (riga) => piano.test(riga)), []);
});

// I testi vanno a capo a mano: le parole di un residuo possono stare su due righe. Si cerca
// quindi nel testo intero, e `ammesso` (se dato) si cerca nei 200 caratteri attorno.
function residui(elenco, modello, ammesso) {
  return elenco.flatMap((f) => {
    const testo = fs.readFileSync(f, 'utf8');
    return [...testo.matchAll(modello)]
      .filter((m) => !ammesso || !ammesso.test(testo.slice(Math.max(0, m.index - 200), m.index + m[0].length + 200)))
      .map((m) => `${path.relative(RADICE, f)}:${testo.slice(0, m.index).split('\n').length}: ${m[0].replace(/\s+/g, ' ')}`);
  });
}

test('nessun residuo del flusso a quattro gate', () => {
  assert.deepEqual(residui(TESTI, /gate[-\s]+4\b|quattro\s+gate|four\s+gates/gi), []);
});

// Una conversazione nuova serve in un caso solo: dopo un aggiornamento del plugin.
test('«conversazione nuova» solo per l\'aggiornamento del plugin', () => {
  const nuova = /new\s+conversation|conversazione\s+nuova|nuova\s+conversazione/gi;
  assert.deepEqual(residui(TESTI, nuova, /plugin\s+update|aggiornamento\s+del\s+plugin/i), []);
});

// Il login dell'agente è una sessione temporanea (D2): nessuna password in un file, nessun
// comando che la legga. Un progetto di prima può avere ancora un .env: lo si può dire, non usare.
test('nessun residuo della password dell\'utente agente', () => {
  assert.deepEqual(residui(TESTI, /AGENT_ADMIN_(USER|PASSWORD)|\{password\}|openssl|\bperl\b|\bsed -n\b|user_pass/g), []);
  assert.deepEqual(residui(TESTI, /\.env\b/g, /nothing reads it|nessuno lo legge|No `\.env`|Niente `\.env`/i), []);
});

// Il setup ha una sola attesa: il messaggio iniziale (U13). Gli altri fermi scattano solo se
// manca qualcosa che può sistemare soltanto chi usa il sistema.
test('fse-theme-setup: un solo messaggio iniziale, nessun passo manuale, nessun «fatto» finale', () => {
  const skill = fs.readFileSync(path.join(RADICE, 'skills', 'fse-theme-setup', 'SKILL.md'), 'utf8');
  assert.doesNotMatch(skill, /\[MANUAL\]/);
  assert.doesNotMatch(skill, /Quando hai finito scrivi|Quando tutto è pronto scrivi|git config --global/);
  assert.match(skill, /the only wait of the whole setup/);
  assert.match(skill, /Apri Sourcetree → Impostazioni → Generali/);
  assert.match(skill, /start `fse-brief` \*\*in the same\s+conversation\*\*/);
});

// Il contenuto di una pagina si scrive solo con wp-page.php: una ricetta che lo sostituisce con
// `wp post update` scavalcherebbe la protezione dei contenuti del cliente (U53).
test('nessuna ricetta che riscrive il contenuto di una pagina senza wp-page.php', () => {
  assert.deepEqual(righe(SKILL_E_FONDAMENTA, (riga) => /post update \$?\{?ID\}? "\{scratchpad\}|post create "?\{scratchpad\}\/page-/.test(riga)), []);
});

// La parità legge le righe di DESIGN.md: nel setup si controlla dopo che la skill le ha scritte.
test('fse-theme-setup: le tabelle di DESIGN.md si scrivono prima dei controlli che le leggono', () => {
  const skill = fs.readFileSync(path.join(RADICE, 'skills', 'fse-theme-setup', 'SKILL.md'), 'utf8');
  assert.ok(skill.indexOf('### Step 4e — DESIGN.md tables') !== -1 && skill.indexOf('### Step 4e — DESIGN.md tables') < skill.indexOf('PASS check-parita'), 'check-parita viene prima della scrittura delle tabelle');
});

// Il form di default è contenuto della pagina: sta dentro <main>, nel kit come nei template (U24).
test('nessun testo mette il form di default dopo </main>', () => {
  assert.deepEqual(residui(SKILL_E_FONDAMENTA, /after\s+`<\/main>`|<\/main>\s*(?:\n\s*)*<!-- @import "main\/form\/_form-contacts\.kit" -->/g), []);
});


// Kit e build girano in un sotto-agente (fondamenta §10 «Units of work in a sub-agent»): la
// skill riceve il messaggio del dev negli argomenti e chiude con il blocco per la conversazione
// principale, che lancia il controllo e decide che cosa segue.
test('fse-kit e fse-build: la richiesta negli argomenti e il blocco per la conversazione principale', () => {
  for (const nome of ['fse-kit', 'fse-build']) {
    const skill = fs.readFileSync(path.join(RADICE, 'skills', nome, 'SKILL.md'), 'utf8');
    assert.equal((skill.match(/\$ARGUMENTS/g) || []).length, 1, `${nome}: $ARGUMENTS una volta sola`);
    assert.match(skill, /Per la conversazione principale \(non mostrare al dev\):/, nome);
    assert.match(skill, /node "\$\{CLAUDE_PLUGIN_ROOT\}\/shared\/scripts\/controllo\.js" "\{site-root\}"/, nome);
    assert.match(skill, /Units of work in a sub-agent/, nome);
  }
});

test('le fondamenta dicono chi esegue che cosa, e che cosa restituisce un\'unità', () => {
  const fondamenta = fs.readFileSync(path.join(RADICE, 'shared', 'fse-foundations.md'), 'utf8');
  assert.match(fondamenta, /^### Units of work in a sub-agent$/m);
  assert.match(fondamenta, /Per la conversazione principale \(non mostrare al dev\):/);
  assert.match(fondamenta, /word for word/);
  assert.match(fondamenta, /never gives itself an ok/);
});

// Un'unità finisce: il kit della pagina seguente lo avvia la conversazione principale.
test('nessun testo dice a un\'unità di cominciare il kit successivo', () => {
  assert.deepEqual(residui(SKILL_E_FONDAMENTA, /start its kit in the\s+same\s+conversation|goes on with\s+its\s+kit|next `da progettare` kit started in the same conversation|goes on with its kit\s+unless/g), []);
  const build = fs.readFileSync(path.join(RADICE, 'skills', 'fse-build', 'SKILL.md'), 'utf8');
  assert.match(build, /never starts? the kit of the next page/i);
});

// Una skill che gira nella conversazione (brief, block-edit) non legge il testo di kit e build
// per eseguirlo in linea: le invoca, e girano in un sotto-agente.
test('fse-brief e fse-block-edit invocano fse-kit e fse-build, non ne leggono il testo', () => {
  for (const nome of ['fse-brief', 'fse-block-edit']) {
    const skill = fs.readFileSync(path.join(RADICE, 'skills', nome, 'SKILL.md'), 'utf8');
    assert.doesNotMatch(skill, /skills\/fse-(kit|build)\/SKILL\.md/, nome);
    assert.match(skill, /Skill tool/, nome);
  }
});

// Una cancellazione che aspetta il dev ha la sua riga, diversa da quella di una build in corso:
// il controllo distingue «aspetta te» da «si è fermata a metà».
test('la riga di un confirm in attesa ha una forma sua', () => {
  const fondamenta = fs.readFileSync(path.join(RADICE, 'shared', 'fse-foundations.md'), 'utf8');
  const build = fs.readFileSync(path.join(RADICE, 'skills', 'fse-build', 'SKILL.md'), 'utf8');
  for (const [nome, testo] of [['fondamenta', fondamenta], ['fse-build', build]]) assert.match(testo, /`⏳ confirm: /, nome);
});

// Un blocco nuovo entra nel catalogo: la riga del Catalogo torna a `kit` nello stesso passo,
// prima di ogni controllo, altrimenti la parità confronta un catalogo che WordPress non ha ancora.
test('fse-kit 3e: la riga del Catalogo torna a kit prima dei controlli', () => {
  const kit = fs.readFileSync(path.join(RADICE, 'skills', 'fse-kit', 'SKILL.md'), 'utf8');
  assert.match(kit, /in this same step, before any check/);
});
