# wdm-agent — il sistema agentico come plugin di Claude Code (design, 2026-10-26)

> Esito del brainstorming del 2026-10-26. Sostituisce la decisione 8 della spec
> `2026-10-10-wdm-theme-design.md` ("skill globali in `~/.claude/skills`"): le skill `fse-*`
> restano globali per chi le usa, ma viaggiano come **plugin** installabile, non come cartelle
> copiate in `~/.claude`. Questo documento vive qui finché il repo del plugin non esiste; alla
> creazione del repo si sposta in `docs/` del plugin e qui resta un rimando.

## 1. Intento e perché

wdm-theme è il tema base personale di Carlo e il materiale di un corso di web design: lo
studente riceve il tema **e** il sistema agentico che lo fa funzionare (skill `fse-*`,
fondamenta, hook, script dei token). Oggi quel sistema è un insieme di cartelle in
`~/.claude/` del Mac di Carlo, mescolato alla famiglia `dev-*`/`design-*` di wdm-starter: non
è consegnabile, non è aggiornabile, e "copia questa cartella" non è un metodo da insegnare.

Il plugin risolve tre cose: **consegna** (un comando per installare), **aggiornamento** (un
comando per aggiornare, versione dichiarata), **separazione** (lo studente riceve solo la
famiglia `fse-*`; la famiglia starter resta sul Mac di Carlo e non viene impacchettata).

## 2. Obiettivi, non obiettivi, anti-obiettivi

**Obiettivi**
- Un repo git `wdm-agent` che è un plugin di Claude Code completo: le 5 skill `fse-*`, le
  fondamenta, lo script dei token, i due hook fse, un README di installazione per lo studente.
- Installabile e aggiornabile con i comandi standard di Claude Code (`claude plugin ...`).
- Comportamento identico a oggi su wdm-theme e sui progetti cliente già esistenti: stessi
  trigger, stesso protocollo, stessi hook, DESIGN.md esistenti ancora validi.
- Il Mac di Carlo dopo la migrazione non ha doppioni: le `fse-*` esistono solo nel plugin, gli
  hook fse scattano una volta sola.

**Non obiettivi**
- Impacchettare `dev-*`, `design-*`, `new-project-setup`, `new-design`, `dev-foundations.md`,
  `figma-foundations.md`, `acf-json-authoring.md`, `sync-design-tokens.js`,
  `check-build-registration.sh`: restano in `~/.claude` come sono, nessuna modifica oltre
  quelle elencate al §5 (hook condiviso).
- Riscrivere o migliorare il contenuto delle skill. Si sposta e si adattano i percorsi; le
  convenzioni cambiano solo nel progetto tema + sito (spec gemella), e in quella sede.
- Pubblicare il plugin su un marketplace pubblico. Il repo è su GitHub (pubblico dal 2026-10-26, vedi §9).

**Anti-obiettivi** (il progetto fallisce anche se "funziona")
- Una skill che funziona solo sul Mac di Carlo perché un percorso `~/.claude/...` è rimasto.
- Un hook che gira due volte (plugin + `settings.json`) o zero volte (ramo fse dell'hook
  condiviso che esce in silenzio perché non trova più lo script).
- Un DESIGN.md di un progetto esistente che smette di passare `--check` dopo l'installazione.

## 3. Vincoli

- Formato plugin di Claude Code: `.claude-plugin/plugin.json` alla root, `skills/<nome>/SKILL.md`,
  `hooks/hooks.json`. Riferimento concreto già installato: `impeccable` (PostToolUse con
  `node "${CLAUDE_PLUGIN_ROOT}/…"`) e `superpowers` (script richiamati con percorsi relativi
  alla cartella della skill).
- Le skill nel plugin assumono il namespace `wdm-agent:fse-build` ecc. Le frasi di trigger nelle
  description e la tabella di routing nel `CLAUDE.md` di wdm-theme continuano a funzionare
  perché il routing è per descrizione, non per percorso.
- Git è del dev (Sourcetree): la build crea i file, Carlo crea il repo remoto e committa.
- `~/.claude` è a sua volta un repo git (Bitbucket `claude-global`): la rimozione delle `fse-*`
  da lì è un commit di Carlo.

## 4. Struttura del plugin (decisa)

```
wdm-agent/
  .claude-plugin/plugin.json      name "wdm-agent", version 1.0.0, description, author, repository
  README.md                       per lo studente: cos'è, requisiti, install, update, verifica, disinstallazione
  skills/
    fse-theme-setup/  SKILL.md  scripts/setup.sh
    fse-brief/        SKILL.md                      (1.3.0)
    fse-kit/          SKILL.md
    fse-build/        SKILL.md  scripts/wp-page.php (1.3.0)
    fse-block-edit/   SKILL.md
    fse-menu-build/   SKILL.md  scripts/wp-navigation.php
  shared/
    fse-foundations.md
    scripts/sync-theme-json-tokens.js
  hooks/
    hooks.json                    PostToolUse Write|Edit → i due script sotto, via ${CLAUDE_PLUGIN_ROOT}
    check-block-contract.sh
    check-design-tokens.sh        solo il ramo theme.json / theme_family fse
  docs/
    2026-10-26-wdm-agent-plugin-design.md   (questo file, spostato)
```

Scelte fatte qui, da non riaprire:
- **`shared/` sta alla root del plugin**, non dentro `skills/`: una cartella senza `SKILL.md`
  dentro `skills/` è un caso ambiguo per la discovery, e le fondamenta non sono una skill.
- **Nome del plugin `wdm-agent`** (scelto da Carlo: agnostico rispetto alla famiglia di skill,
  regge anche se un giorno `fse-*` viene sostituita). Le skill mantengono i nomi `fse-*` (nessun
  rinominamento, i trigger e il `CLAUDE.md` dei progetti li citano); si invocano come
  `wdm-agent:fse-build`.
- **Marketplace = lo stesso repo.** Il repo contiene anche `.claude-plugin/marketplace.json`
  che elenca il solo plugin `wdm-agent` con `source` relativa, così lo studente fa
  `claude plugin marketplace add <url-repo>` e poi `claude plugin install wdm-agent@wdm-agent`
  (il costruttore verifica la sintassi esatta sulla documentazione corrente e la scrive nel
  README; se il repo-marketplace singolo non è supportato, la via di ripiego è un secondo
  repo-marketplace minimale, e la scelta va nel README e nel log decisioni).

## 5. Cosa cambia nei file (inventario dalla ricognizione del 2026-10-26)

**Percorsi assoluti da riscrivere** (tutti verificati con grep; il costruttore ri-esegue il
grep su `~/.claude` e `/Users/macbookpro16m1` a fine lavoro e deve trovare zero occorrenze
dentro il plugin):
- `fse-block-edit/SKILL.md` :9 :76 · `fse-build/SKILL.md` :9 :217 · `fse-kit/SKILL.md` :9 ·
  `fse-menu-build/SKILL.md` :9 :48 :56 :82 :120 · `fse-menu-build/scripts/wp-navigation.php`
  :6-8 (commento d'uso) · `fse-theme-setup/SKILL.md` :9 :15 :157 :191 :192 :206 :207 ·
  `fse-theme-setup/scripts/setup.sh` :14 (commento) · `_shared/fse-foundations.md` :26-27
  :445 :605 :613 · `sync-theme-json-tokens.js` :30 (marker) :34 (commento).
- Regola di riscrittura: dentro una SKILL.md un file **della stessa skill** si cita con
  percorso relativo alla cartella della skill (`scripts/setup.sh`, come già fa `:21`); un file
  **di un'altra parte del plugin** (`shared/…`, un'altra skill) si cita relativo alla root del
  plugin, con una riga in testa alla skill che dice come risolverla (Claude Code annuncia la
  cartella base della skill quando la invoca: la root del plugin è due livelli sopra). Il
  costruttore verifica sulla documentazione se `${CLAUDE_PLUGIN_ROOT}` è disponibile anche ai
  comandi bash lanciati dalle skill e, se sì, lo usa al posto della risalita relativa; la
  scelta è una sola per tutto il plugin e sta scritta in `fse-foundations.md §12`.
- `hooks/hooks.json`: `${CLAUDE_PLUGIN_ROOT}/hooks/…` come in `impeccable`.

**Hook condiviso `check-design-tokens.sh`** (oggi un file, due rami):
- nel plugin resta solo il ramo `themes/*/theme.json` + `theme_family: fse`, con
  `sync_script` relativo a `${CLAUDE_PLUGIN_ROOT}/shared/scripts/…`;
- in `~/.claude/hooks/check-design-tokens.sh` resta solo il ramo `src/scss/bs5/_variables.scss`
  (starter). È l'unica modifica a un file della famiglia starter.
- `~/.claude/settings.json`: la riga `check-design-tokens.sh` resta (ramo starter); la riga
  `check-block-contract.sh` si toglie e il file si cancella da `~/.claude/hooks/`. Questa
  modifica a `settings.json` la fa Carlo a mano o la conferma esplicitamente: è
  configurazione dell'utente, il costruttore la propone come diff.

**Marker dei token in DESIGN.md.** `sync-theme-json-tokens.js:30` scrive nel DESIGN.md di
ogni progetto un marker che contiene il comando con il percorso `~/.claude/...`. Decisione:
il nuovo marker non contiene percorsi (`<!-- AUTO-GENERATED:design-tokens da theme.json — non
editare. Rigenera con lo script sync-theme-json-tokens.js del plugin wdm-agent -->`); lo script
riconosce **entrambi** i marker in lettura (vecchio e nuovo) e scrive sempre il nuovo;
`--check` su un DESIGN.md con il marker vecchio e token allineati esce 0 segnalando a video
"marker da aggiornare: rigenera". Così nessun progetto esistente si rompe e la migrazione
avviene alla prima rigenerazione.

**`CLAUDE.md` di wdm-theme** (viaggia col repo del tema, non è toccato da `fse-theme-setup`):
le righe :7 :13-17 :47 :53 :118-125 citano `~/.claude/...`. Vanno riscritte in termini di
plugin ("il plugin `wdm-agent`", "le fondamenta del plugin") senza percorsi assoluti; la
sezione Hooks elenca i due hook del plugin e non più `check-build-registration` (che non
riguarda questo progetto). Questa modifica fa parte di questo progetto perché senza di essa
lo studente legge istruzioni che puntano a file che non ha.

**`fse-theme-setup/SKILL.md:132`** rimanda a un template di `new-project-setup` (famiglia
starter). Nel plugin quel rimando non può esistere: il contenuto del template si copia dentro
`fse-theme-setup` (file proprio della skill) e il rimando sparisce.

**Frontmatter**: le 5 SKILL.md hanno solo `name` e `description`; restano così. Nessuna
`allowed-tools`.

**Progetti cliente esistenti.** Oggi non esiste nessun progetto cliente nato da wdm-theme:
l'unico DESIGN.md con `theme_family: fse` è quello di wdm-theme. Quindi il `CLAUDE.md` da
migrare è uno solo (quello del tema, che poi viaggia nei progetti futuri) e il criterio 2
sul marker vecchio si prova su wdm-theme. I progetti wdm-starter non sono toccati.

**Ciclo di sviluppo sul Mac di Carlo** (dove il progetto gemello modifica
`fse-foundations.md` a ogni sessione e deve collaudarlo subito). Vincolo: una modifica nel
checkout locale del plugin deve essere visibile nella sessione successiva **senza** commit,
push o aggiornamento dal remoto. Via scelta (verificata il 2026-10-26 su Claude Code
2.1.286): marketplace aggiunto da percorso locale; l'installazione copia il checkout in
`~/.claude/plugins/cache/` e `claude plugin update` non ricopia a versione uguale, quindi dopo
una modifica si rilancia `uninstall` + `install` (documentato nel README, sezione "Sviluppo");
`--plugin-dir` non è disponibile nell'estensione VS Code. Lo studente installa sempre dal remoto. "Nessun
doppione" al §2 significa: nessuna copia di `fse-*` in `~/.claude/skills` e nessun hook fse
in `settings.json`; checkout e cache del plugin sono la stessa cosa in due stati e non
contano come doppione. Il criterio 1 si prova dal checkout locale prima che il remoto esista
e si ripete dal remoto appena Carlo lo crea.

## 6. Verifica (criteri di accettazione)

1. `claude plugin install` da un clone del repo su un Mac dove `~/.claude/skills/fse-*` non
   esiste più: le 5 skill compaiono nel catalogo con il namespace `wdm-agent:`; `/fse-theme-setup`
   si invoca.
2. Su wdm-theme: una sessione che apre `fse-kit` legge le fondamenta dal plugin (la skill lo
   annuncia nelle prime righe), `fse-menu-build` esegue `wp-navigation.php dump` dal percorso
   del plugin e produce lo stesso JSON di prima, `node shared/scripts/sync-theme-json-tokens.js
   {theme-root} --check` esce 0 sul DESIGN.md esistente (marker vecchio) e lo stesso dopo una
   rigenerazione (marker nuovo).
3. Hook: una `Write` su `blocks/x/block.json` con un `file:` inesistente viene bloccata
   (exit 2) **una sola volta**; una `Write` su `theme.json` che cambia un token mostra il diff
   del sync **una sola volta**; su un progetto wdm-starter l'hook dei token continua a
   funzionare sul ramo bs5 e `check-block-contract` non interviene.
4. `grep -rn "~/.claude\|\$HOME/.claude\|/Users/macbookpro16m1" wdm-agent/` → zero righe
   (esclusa, se presente, una nota storica nel README).
5. Il README del plugin, seguito alla lettera da una persona che non ha mai visto il
   progetto, porta a (1). Prova: Carlo o un sottoagente eseguono solo i comandi del README.
6. Il guard `theme_family` (fse-foundations §0) resta e si comporta come oggi.

## 7. Lasciato al costruttore

- Sintassi esatta dei comandi `claude plugin …` e del `marketplace.json` (documentazione
  corrente di Claude Code; usare l'agente `claude-code-guide`).
- Se e come `${CLAUDE_PLUGIN_ROOT}` è utilizzabile dentro le SKILL.md (vedi §5); in caso
  negativo, la risalita relativa dalla cartella base della skill.
- Numero di versione e changelog iniziale del plugin; `.gitignore`; eventuale
  `CHANGELOG.md`.
- Ordine delle operazioni sul Mac di Carlo (prima installare il plugin e verificare, poi
  rimuovere le `fse-*` da `~/.claude`), purché a fine lavoro non esistano doppioni.
- Aggiornare `fse-foundations.md §12` (hook: "del plugin" invece di "globali") e il
  `README.md` del tema dove descrive il sistema agentico.

## 8. Collegamento con il progetto tema + sito

Questo progetto viene **prima**: ogni sessione di kit e build del progetto gemello
(`2026-10-26-wdm-theme-product-design.md`) gira con le skill installate dal plugin e le
collauda. Le convenzioni nuove che il progetto gemello introduce (nomi delle varianti, regole
di accessibilità e performance, token) si scrivono in `fse-foundations.md` **nel plugin**, e
il plugin viene versionato di conseguenza.

## 9. Decisioni di Carlo (2026-10-26) e approvazione

- **Remoto**: GitHub privato `carlogatto/wdm-agent`. Comando di installazione nella forma breve
  `owner/repo`; gli studenti sono invitati come collaboratori in sola lettura e devono avere
  le credenziali git configurate (prerequisito nel README). `repository` in `plugin.json` e
  `owner` in `marketplace.json` di conseguenza.
- **Checkout locale** (deciso da Carlo): `~/Documents/Development/wdm-agent`, la cartella dei suoi
  repo che non richiedono MAMP (`~/Sites` è solo per i siti). Le sessioni del progetto gemello che
  scrivono le fondamenta devono poter accedere a quella cartella: va aggiunta a
  `permissions.additionalDirectories` di `~/.claude/settings.json` (oggi contiene solo
  `~/.claude`), modifica che Carlo conferma insieme a quella dell'hook (§5).

Approvato da Carlo il 2026-10-26. Prossimo passo: `writing-plans`.

**Aggiornamento 2026-10-26 sera.** Il repo è **pubblico**: con il repo privato l'installazione da GitHub
fallisce su un Mac senza credenziali git non interattive (Claude Code scarica in silenzio e non può
chiederle; Sourcetree tiene le sue), cioè sul Mac di quasi ogni studente. Pubblico = leggibile da
tutti, scrivibile solo da Carlo; il valore del pacchetto resta nel tema e nel corso. Criterio 5
verificato: installazione da `carlogatto/wdm-agent` riuscita, contenuto identico al checkout.

**Aggiornamento 2026-10-30 (1.3.0).** Flusso a quattro gate (brief, telaio, kit di pagina, sito
costruito): skill `fse-brief` nuova, `fse-kit` un item per sessione con una review, `fse-build`
build del sito rieseguibile con `skills/fse-build/scripts/wp-page.php`, carta delle decisioni in
fondamenta §10. Spec in `docs/2026-10-30-wdm-agent-flusso-autonomo.md`, piano in
`docs/2026-10-30-wdm-agent-flusso-autonomo-plan.md`.
