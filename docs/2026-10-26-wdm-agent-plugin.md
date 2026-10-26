# wdm-agent Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Impacchettare le 5 skill `fse-*`, le fondamenta, lo script dei token e i due hook fse come plugin Claude Code `wdm-agent` in `~/Documents/Development/wdm-agent`, installarlo sul Mac di Carlo e togliere i doppioni da `~/.claude`.

**Architecture:** Un repo = un plugin = un marketplace (`.claude-plugin/plugin.json` + `.claude-plugin/marketplace.json` con `source: "./"`). Le skill citano ogni file fuori dalla propria cartella con `${CLAUDE_PLUGIN_ROOT}/…` (espanso da Claude Code nel corpo delle SKILL.md e nei comandi di `hooks.json`, esportato come variabile d'ambiente ai processi hook); i file della stessa skill con percorso relativo (`scripts/x`). Sviluppo: marketplace aggiunto da percorso locale (letto in place, nessuna copia); studente: marketplace da GitHub privato `carlogatto/wdm-agent`.

**Tech Stack:** Markdown (SKILL.md), bash (hook, setup.sh), node ≥ 18 (sync script), jq, PHP via WP-CLI (`wp-navigation.php`), Claude Code CLI `claude plugin …`.

**Spec:** `docs/superpowers/specs/2026-10-26-wdm-agent-plugin-design.md` (wdm-theme repo; copiato in `docs/` del plugin al Task 7).

## Global Constraints

- Mai comandi git: Carlo crea il repo e committa in Sourcetree. Ogni task termina con un checkpoint che gli dice cosa committare.
- Mai sovrascrivere: i file di `~/.claude` si **copiano** nel plugin (`cp`), si modificano nella copia; la rimozione da `~/.claude` è solo al Task 6, dopo conferma.
- 2 spazi, mai tab, in ogni file.
- Zero occorrenze di `~/.claude`, `$HOME/.claude`, `/Users/macbookpro16m1` dentro `~/Documents/Development/wdm-agent/` (esclusa la cartella `tests/` dove i percorsi del Mac di Carlo servono come fixture, e una nota storica nel README).
- Regola unica di riferimento ai file (spec §5, da scrivere in `fse-foundations.md §12`): stessa skill → relativo alla cartella della skill; altro file del plugin → `${CLAUDE_PLUGIN_ROOT}/…`.
- Nome plugin e marketplace: `wdm-agent`; installazione `wdm-agent@wdm-agent`; versione iniziale `1.0.0`.
- Le skill non cambiano di contenuto oltre ai percorsi, al template inlinato (fse-theme-setup Step 2b) e alle righe elencate nella spec §5.
- `settings.json` di Carlo: il piano produce il diff, Carlo lo applica o lo conferma esplicitamente.

## Review Focus

1. DESIGN.md di un progetto con il **marker vecchio** e token allineati: `--check` deve uscire 0 con avviso, non 1 → test al Task 3.
2. Hook dei token su `theme.json` di un progetto **wdm-starter** (DESIGN.md senza `theme_family: fse`): il ramo del plugin deve uscire 0 in silenzio → test al Task 4.
3. `CLAUDE_PLUGIN_ROOT` con **spazi** nel percorso (uno studente con la cartella in `~/Documents/Corso WDM/`): comandi di `hooks.json` e script con doppi apici → test al Task 4.
4. Hook registrati **due volte** (plugin + `settings.json`): `check-block-contract.sh` deve sparire da `settings.json` → verifica al Task 6.
5. **`jq` o `node` assenti** sul Mac dello studente: gli hook falliscono in silenzio o con errore criptico → prerequisiti nel README (Task 5) e controllo esplicito in testa agli hook con messaggio chiaro (Task 4).

---

### Task 1: Scaffold del plugin e harness di test

**Files:**
- Create: `~/Documents/Development/wdm-agent/.claude-plugin/plugin.json`
- Create: `~/Documents/Development/wdm-agent/.claude-plugin/marketplace.json`
- Create: `~/Documents/Development/wdm-agent/.gitignore`
- Create: `~/Documents/Development/wdm-agent/tests/run.sh`
- Create: `~/Documents/Development/wdm-agent/tests/test-manifest.sh`

**Interfaces:**
- Produces: `tests/run.sh` esegue ogni `tests/test-*.sh` e termina con `ALL GREEN` / exit 0, oppure elenca i falliti ed esce 1. Ogni test è uno script bash con `set -euo pipefail` che stampa `PASS <nome>` o `FAIL <nome>: <motivo>`. `PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"` disponibile in ogni test.

- [ ] **Step 1: Scrivi il test del manifest**

`tests/test-manifest.sh` asserisce: `jq -e '.name == "wdm-agent" and .version == "1.0.0" and (.author.name | length > 0) and (.repository | test("github.com/carlogatto/wdm-agent"))' .claude-plugin/plugin.json`; `jq -e '.name == "wdm-agent" and .owner.name != null and (.plugins | length == 1) and .plugins[0].name == "wdm-agent" and .plugins[0].source == "./"' .claude-plugin/marketplace.json`; `claude plugin validate "$PLUGIN_ROOT"` esce 0 (se questa versione della CLI non ha il sottocomando `validate`, il test stampa `SKIP validate` e passa sulle sole asserzioni jq).

- [ ] **Step 2: Esegui `bash tests/run.sh` e verifica che fallisca** (file assenti → `FAIL test-manifest`).

- [ ] **Step 3: Scrivi `plugin.json`** con `name "wdm-agent"`, `version "1.0.0"`, `description "Sistema agentico wdm-theme: skill fse-* (theme-setup, kit, build, block-edit, menu-build), fondamenta, hook e script dei token per block theme FSE"`, `author { name: "Carlo Gatto", email: "carlo@carlogatto.com" }`, `repository "https://github.com/carlogatto/wdm-agent"`, `license "proprietary"`, `keywords ["wordpress","fse","block-theme","gutenberg","wdm-theme"]`.

- [ ] **Step 4: Scrivi `marketplace.json`** con `name "wdm-agent"`, `owner { name: "Carlo Gatto" }`, `plugins: [{ name: "wdm-agent", source: "./", description: <stessa di plugin.json>, version: "1.0.0" }]`.

- [ ] **Step 5: Scrivi `.gitignore`** (`.DS_Store`, `node_modules/`, `tests/tmp/`) e `tests/run.sh`.

- [ ] **Step 6: Esegui `bash tests/run.sh`** → `PASS test-manifest`, `ALL GREEN`.

- [ ] **Step 7: Checkpoint Carlo** — creare il repo locale in `~/Documents/Development/wdm-agent` (Sourcetree, `git init`) e committare "chore: scaffold plugin wdm-agent".

---

### Task 2: Skill `fse-*` copiate e ripulite dai percorsi assoluti

**Files:**
- Create (copia da `~/.claude/skills/`): `skills/fse-theme-setup/{SKILL.md,scripts/setup.sh}`, `skills/fse-kit/SKILL.md`, `skills/fse-build/SKILL.md`, `skills/fse-block-edit/SKILL.md`, `skills/fse-menu-build/{SKILL.md,scripts/wp-navigation.php}`
- Create: `tests/test-no-absolute-paths.sh`, `tests/test-skill-refs.sh`

**Interfaces:**
- Consumes: `tests/run.sh` (Task 1).
- Produces: ogni SKILL.md al punto 1 dei "MANDATORY first steps" legge `${CLAUDE_PLUGIN_ROOT}/shared/fse-foundations.md`; lo script dei token è `node ${CLAUDE_PLUGIN_ROOT}/shared/scripts/sync-theme-json-tokens.js`; lo script dei menu è `{wp-cli} eval-file ${CLAUDE_PLUGIN_ROOT}/skills/fse-menu-build/scripts/wp-navigation.php`; `setup.sh` è `bash ${CLAUDE_PLUGIN_ROOT}/skills/fse-theme-setup/scripts/setup.sh`. Questi quattro percorsi sono il contratto usato da Task 3, 4, 5, 7.

- [ ] **Step 1: Scrivi `tests/test-no-absolute-paths.sh`**: `grep -rnE '~/\.claude|\$HOME/\.claude|/Users/macbookpro16m1' "$PLUGIN_ROOT" --exclude-dir=tests --exclude-dir=.git --exclude=README.md` deve non trovare nulla (exit 1 di grep = PASS).

- [ ] **Step 2: Scrivi `tests/test-skill-refs.sh`**: per ognuna delle 5 skill, `grep -c '\${CLAUDE_PLUGIN_ROOT}/shared/fse-foundations.md' skills/<n>/SKILL.md` ≥ 1; `grep -c 'eval-file \${CLAUDE_PLUGIN_ROOT}/skills/fse-menu-build/scripts/wp-navigation.php'` ≥ 4 in fse-menu-build e ≥ 2 in fse-theme-setup; `grep -c 'node \${CLAUDE_PLUGIN_ROOT}/shared/scripts/sync-theme-json-tokens.js'` ≥ 1 in fse-build, fse-block-edit, e ≥ 2 in fse-theme-setup; `grep -c 'bash \${CLAUDE_PLUGIN_ROOT}/skills/fse-theme-setup/scripts/setup.sh'` = 1; fse-theme-setup non contiene `new-project-setup` Step 2a come rimando (`grep -c 'Template of .new-project-setup'` = 0); frontmatter di ogni SKILL.md ha solo `name` e `description` (`sed -n '2,/^---$/p' | grep -vE '^(name|description):|^---$'` vuoto).

- [ ] **Step 3: Esegui `bash tests/run.sh`** → entrambi FAIL (cartella `skills/` assente).

- [ ] **Step 4: Copia** `cp -R ~/.claude/skills/fse-{theme-setup,kit,build,block-edit,menu-build} skills/` (rimuovi eventuali `.DS_Store`).

- [ ] **Step 5: Riscrivi i percorsi** nelle righe elencate nella spec §5 con `sed`/Edit, secondo il contratto sopra: `fse-block-edit/SKILL.md` :9 :76 · `fse-build/SKILL.md` :9 :217 · `fse-kit/SKILL.md` :9 · `fse-menu-build/SKILL.md` :9 :48 :56 :82 :120 · `wp-navigation.php` :6-8 · `fse-theme-setup/SKILL.md` :9 :15 (→ `${CLAUDE_PLUGIN_ROOT}/skills/fse-menu-build/SKILL.md`) :157 :191 :192 :206 :207 · `setup.sh` :14 (commento: "Hooks ship with the wdm-agent plugin (hooks/hooks.json)").

- [ ] **Step 6: Inlinea il template wp-config in `fse-theme-setup/SKILL.md` Step 2b**: sostituisci la frase "Template of `new-project-setup` Step 2a (…) **plus**, after the debug block:" con il blocco PHP completo copiato da `~/.claude/skills/new-project-setup/SKILL.md:225-266` (DB `{slug}-db`, `$table_prefix = '{prefix}_'`, `{SALT_KEYS_FROM_CURL}`, `WP_DEBUG` true / `WP_DEBUG_DISPLAY` false / `WP_DEBUG_LOG` true, `WP_MEMORY_LIMIT`, `AUTOMATIC_UPDATER_DISABLED`) con la riga `define( 'WP_DEVELOPMENT_MODE', 'theme' );` inserita dopo `WP_DEBUG_LOG`, e il comando `curl -s https://api.wordpress.org/secret-key/1.1/salt/` prima del blocco. Le frasi "Without it WP caches…" e "Never overwrite an existing wp-config.php" restano.

- [ ] **Step 7: Esegui `bash tests/run.sh`** → `PASS test-no-absolute-paths`, `PASS test-skill-refs`, `ALL GREEN`.

- [ ] **Step 8: Checkpoint Carlo** — commit "feat: skill fse-* nel plugin, percorsi via CLAUDE_PLUGIN_ROOT".

---

### Task 3: `shared/`: fondamenta e script dei token con marker senza percorsi

**Files:**
- Create (copia): `shared/fse-foundations.md` (da `~/.claude/skills/_shared/fse-foundations.md`), `shared/scripts/sync-theme-json-tokens.js` (da `~/.claude/skills/_shared/scripts/`)
- Create: `tests/test-sync-marker.sh`, `tests/fixtures/design-old-marker.md`, `tests/fixtures/design-foreign-marker.md`

**Interfaces:**
- Consumes: contratto dei percorsi (Task 2).
- Produces: `BEGIN_MARKER = '<!-- AUTO-GENERATED:design-tokens da theme.json — non editare. Rigenera con lo script sync-theme-json-tokens.js del plugin wdm-agent -->'`; costante `LEGACY_BEGIN_MARKER` = marker attuale (`…Rigenera con: node ~/.claude/skills/_shared/scripts/sync-theme-json-tokens.js {theme-root} -->`); `extractCurrentBlock()` invariata (cerca il prefisso `<!-- AUTO-GENERATED:design-tokens`); in `--check`, se il blocco corrente equivale a `newBlock` **a meno della riga del marker** (vecchio vs nuovo) → stampa `OK (marker da aggiornare: rigenera senza --check)` ed esce 0; marker né nuovo né legacy ma che inizia con `da theme.json` → stesso trattamento del legacy; marker non `da theme.json` → `fail` come oggi. `GLOBAL_STYLES_HEADER` :34 senza percorso ("Rigenera con lo script sync-theme-json-tokens.js del plugin wdm-agent (legge {wp-cli} da DESIGN.md)").

- [ ] **Step 1: Scrivi le fixture**: `tests/fixtures/design-old-marker.md` = copia di `/Users/macbookpro16m1/Sites/wdm-theme/DESIGN.md` (marker vecchio, token allineati a theme.json di wdm-theme); `design-foreign-marker.md` = la stessa con il marker sostituito da `<!-- AUTO-GENERATED:design-tokens da _variables.scss -->`.

- [ ] **Step 2: Scrivi `tests/test-sync-marker.sh`**. Prepara `tests/tmp/site/wp-content/themes/wdm-theme` come **symlink** a `/Users/macbookpro16m1/Sites/wdm-theme/wp-content/themes/wdm-theme` e copia la fixture in `tests/tmp/site/DESIGN.md`. Asserzioni, con `S="node $PLUGIN_ROOT/shared/scripts/sync-theme-json-tokens.js tests/tmp/site/wp-content/themes/wdm-theme"`:
  (a) marker vecchio: `$S --check` esce 0 e l'output contiene `marker da aggiornare`;
  (b) `$S` (rigenera) esce 0, `grep -c 'plugin wdm-agent' tests/tmp/site/DESIGN.md` = 1, `grep -c '~/.claude' tests/tmp/site/DESIGN.md` = 0, e `wp-global-styles.css` del tema **non** è cambiato (`md5` prima/dopo; lo script conserva l'header esistente);
  (c) dopo (b), `$S --check` esce 0 e l'output contiene `OK: Design Tokens` senza `marker da aggiornare`;
  (d) fixture foreign: `$S --check` esce 2 e stderr contiene `altra fonte`;
  (e) `grep -c '~/.claude' shared/scripts/sync-theme-json-tokens.js` = 0.
  Nota: (b) richiede `{wp-cli}` funzionante (MAMP acceso); il test stampa `SKIP (b)(c)` se `wp-cli.phar` del sito non risponde, e PASS solo su (a)(d)(e).

- [ ] **Step 3: Esegui `bash tests/run.sh`** → `FAIL test-sync-marker` (cartella `shared/` assente).

- [ ] **Step 4: Copia** `mkdir -p shared/scripts && cp ~/.claude/skills/_shared/fse-foundations.md shared/ && cp ~/.claude/skills/_shared/scripts/sync-theme-json-tokens.js shared/scripts/`.

- [ ] **Step 5: Implementa in `sync-theme-json-tokens.js`**: costanti `BEGIN_MARKER` (nuovo) e `LEGACY_BEGIN_MARKER`; funzione `normalizeMarker(block: string): string` che sostituisce la prima riga del blocco con `BEGIN_MARKER`; nel ramo `--check` confronta `normalizeMarker(currentBlock) === newBlock` e, se il marker corrente ≠ `BEGIN_MARKER`, stampa l'avviso `OK (marker da aggiornare: rigenera senza --check)`; `GLOBAL_STYLES_HEADER` e il commento d'uso :17-21 senza percorsi. Nessun'altra logica cambia.

- [ ] **Step 6: Aggiorna `shared/fse-foundations.md`**: :26-27 ("coexist in the same `~/.claude/skills`" → "coexist on the same machine: the `fse-*` family ships in the `wdm-agent` plugin, the starter family in `~/.claude/skills`"); :445 → `{wp-cli} eval-file ${CLAUDE_PLUGIN_ROOT}/skills/fse-menu-build/scripts/wp-navigation.php dump`; §12 titolo → "## 12. Hooks (plugin `wdm-agent`, `hooks/hooks.json`, PostToolUse on Write|Edit)", :613 → `node ${CLAUDE_PLUGIN_ROOT}/shared/scripts/sync-theme-json-tokens.js {theme-root}`, riga `check-build-registration.sh` rimossa, e in coda a §12 il paragrafo "File references inside the plugin": la regola unica dei Global Constraints più la frase "`${CLAUDE_PLUGIN_ROOT}` is expanded by Claude Code in SKILL.md bodies and `hooks.json` commands and exported to hook processes; it is **not** set in the session shell, so never type it in a Bash command you compose yourself: copy the already-expanded path from the skill text."

- [ ] **Step 7: Esegui `bash tests/run.sh`** → `PASS test-sync-marker` (con (b)(c) eseguiti, MAMP acceso), `PASS test-no-absolute-paths` ancora verde, `ALL GREEN`. Poi ripristina il DESIGN.md di wdm-theme se il test lo ha toccato (il test lavora solo su `tests/tmp/`: verificare con `grep -c 'plugin wdm-agent' /Users/macbookpro16m1/Sites/wdm-theme/DESIGN.md` = 0 a questo punto).

- [ ] **Step 8: Checkpoint Carlo** — commit "feat: shared/ fondamenta e sync token con marker portabile".

---

### Task 4: Hook del plugin

**Files:**
- Create: `hooks/hooks.json`
- Create (copia + modifica): `hooks/check-block-contract.sh` (da `~/.claude/hooks/`), `hooks/check-design-tokens.sh` (da `~/.claude/hooks/`, solo ramo fse)
- Create: `tests/test-hooks.sh`, `tests/fixtures/starter-site/DESIGN.md` (DESIGN.md minimo **senza** `theme_family`), `tests/fixtures/starter-site/wp-content/themes/x/theme.json` (`{}`)

**Interfaces:**
- Consumes: `shared/scripts/sync-theme-json-tokens.js` (Task 3).
- Produces: `hooks.json` = `{ "hooks": { "PostToolUse": [ { "matcher": "Write|Edit", "hooks": [ { "type": "command", "command": "\"${CLAUDE_PLUGIN_ROOT}/hooks/check-block-contract.sh\"", "timeout": 10 }, { "type": "command", "command": "\"${CLAUDE_PLUGIN_ROOT}/hooks/check-design-tokens.sh\"", "timeout": 30 } ] } ] } }`. Entrambi gli script leggono `CLAUDE_PLUGIN_ROOT` dall'ambiente; se manca o manca `jq`/`node`, stampano su stderr `wdm-agent hook: <cosa manca>` ed escono 0 (mai bloccare una Write per un problema d'ambiente).

- [ ] **Step 1: Scrivi `tests/test-hooks.sh`**. Helper `run_hook <script> <file_path>` = `printf '{"tool_input":{"file_path":"%s"}}' "$f" | CLAUDE_PLUGIN_ROOT="$ROOT" bash "$ROOT/hooks/<script>"`. Asserzioni:
  (a) `check-design-tokens.sh` su `/Users/macbookpro16m1/Sites/wdm-theme/wp-content/themes/wdm-theme/theme.json` → exit 0 e stdout vuoto (token allineati; con MAMP spento accetta anche stdout contenente `wp eval fallito`);
  (b) stesso hook su `tests/fixtures/starter-site/wp-content/themes/x/theme.json` → exit 0, stdout vuoto (Review Focus 2);
  (c) stesso hook su `…/src/scss/bs5/_variables.scss` → exit 0, stdout vuoto (il ramo starter non esiste nel plugin);
  (d) `check-block-contract.sh` su una copia temporanea di `blocks/wdm-block-cta/block.json` in `tests/tmp/blocks/wdm-block-cta/` **senza** `README.md` → exit 2 e stderr contiene `README.md`;
  (e) stesso hook sul `block.json` reale di `wdm-block-cta` → exit 0;
  (f) Review Focus 3: copia il plugin in `tests/tmp/dir con spazi/` e ripeti (e) con `CLAUDE_PLUGIN_ROOT` = quel percorso → exit 0; ripeti (a) → exit 0;
  (g) `CLAUDE_PLUGIN_ROOT= run_hook check-design-tokens.sh <theme.json wdm-theme>` → exit 0, stderr contiene `wdm-agent hook`;
  (h) `jq -e '.hooks.PostToolUse[0].hooks | length == 2' hooks/hooks.json`.

- [ ] **Step 2: Esegui `bash tests/run.sh`** → `FAIL test-hooks`.

- [ ] **Step 3: Copia e adatta `check-block-contract.sh`**: `cp ~/.claude/hooks/check-block-contract.sh hooks/`; :19 commento → "Shipped by the wdm-agent plugin (hooks/hooks.json)"; in testa, dopo `set -euo pipefail`, il controllo `command -v jq >/dev/null || { echo "wdm-agent hook: jq non trovato (brew install jq)" >&2; exit 0; }`.

- [ ] **Step 4: Scrivi `hooks/check-design-tokens.sh`** partendo dalla copia di `~/.claude/hooks/check-design-tokens.sh`: rimuovi il ramo `_variables.scss` (:28-31) e il `source_label` relativo; `sync_script="$CLAUDE_PLUGIN_ROOT/shared/scripts/sync-theme-json-tokens.js"`; controlli in testa per `CLAUDE_PLUGIN_ROOT`, `jq`, `node` con il messaggio `wdm-agent hook: …` ed exit 0; intestazione del commento riscritta (plugin, solo FSE); il messaggio `additionalContext` cita `node "$sync_script" "$theme_root"` con il percorso espanso (già così).

- [ ] **Step 5: Scrivi `hooks/hooks.json`** come nell'Interfaces.

- [ ] **Step 6: Esegui `bash tests/run.sh`** → `PASS test-hooks`, `ALL GREEN`.

- [ ] **Step 7: Checkpoint Carlo** — commit "feat: hook check-block-contract e check-design-tokens (solo fse) nel plugin".

---

### Task 5: README del plugin

**Files:**
- Create: `README.md`
- Create: `tests/test-readme.sh`

**Interfaces:**
- Consumes: nomi e comandi dei Task 1–4.
- Produces: README in italiano con le sezioni, in quest'ordine: "Cos'è" · "Cosa contiene" (tabella skill → quando si invoca, 5 righe; fondamenta; hook; script token) · "Prerequisiti" (Claude Code aggiornato; `node` ≥ 18; `jq`; git con credenziali per GitHub privato: SSH in `ssh-agent` o `gh auth setup-git`; accesso al repo concesso da Carlo; MAMP + WP-CLI phar li gestisce `fse-theme-setup`) · "Installazione" (`claude plugin marketplace add carlogatto/wdm-agent` · `claude plugin install wdm-agent@wdm-agent` · verifica `claude plugin list`) · "Aggiornamento" (`claude plugin marketplace update wdm-agent` + `claude plugin update wdm-agent@wdm-agent`) · "Verifica dell'installazione" (nuova sessione in un progetto wdm-theme: le skill compaiono come `wdm-agent:fse-*`; `/wdm-agent:fse-kit` risponde con il guard §0) · "Disinstallazione" (`claude plugin uninstall wdm-agent@wdm-agent`) · "Sviluppo" (solo Carlo: `claude plugin marketplace add ~/Documents/Development/wdm-agent` legge i file in place; modifiche visibili alla sessione successiva o con `/reload-plugins`; bump di `version` in `plugin.json` **e** `marketplace.json` a ogni release; `bash tests/run.sh` verde prima di ogni commit) · "Come sono scritti i percorsi" (la regola unica, due righe) · "Storia" (una riga: nato il 2026-10-26 dalle skill globali di `~/.claude`, spec in `docs/`).

- [ ] **Step 1: Scrivi `tests/test-readme.sh`**: `grep -c` ≥ 1 per ciascuna stringa: `claude plugin marketplace add carlogatto/wdm-agent`, `claude plugin install wdm-agent@wdm-agent`, `claude plugin update wdm-agent@wdm-agent`, `claude plugin uninstall wdm-agent@wdm-agent`, `claude plugin marketplace add ~/Documents/Development/wdm-agent`, `/reload-plugins`, `brew install jq`, `gh auth setup-git`, `bash tests/run.sh`; e ognuno dei 9 titoli di sezione `## ` elencati sopra.

- [ ] **Step 2: Esegui `bash tests/run.sh`** → `FAIL test-readme`.

- [ ] **Step 3: Scrivi `README.md`** secondo l'Interfaces. Lingua: italiano, frasi brevi, un comando per riga in blocchi ```bash```.

- [ ] **Step 4: Esegui `bash tests/run.sh`** → `ALL GREEN` (test-no-absolute-paths esclude README.md; verifica a mano che l'unico `~/.claude` nel README sia nella sezione "Storia").

- [ ] **Step 5: Checkpoint Carlo** — commit "docs: README di installazione e sviluppo".

---

### Task 6: Installazione sul Mac di Carlo e rimozione dei doppioni da `~/.claude`

**Files:**
- Modify: `~/.claude/hooks/check-design-tokens.sh` (solo ramo starter)
- Delete (dopo conferma): `~/.claude/skills/fse-theme-setup/`, `fse-kit/`, `fse-build/`, `fse-block-edit/`, `fse-menu-build/`, `~/.claude/skills/_shared/fse-foundations.md`, `~/.claude/skills/_shared/scripts/sync-theme-json-tokens.js`, `~/.claude/hooks/check-block-contract.sh`
- Diff proposto (Carlo applica): `~/.claude/settings.json`
- Create: `~/Documents/Development/wdm-agent/tests/test-no-duplicates.sh` (test del Mac di Carlo: cerca i file sopra e verifica `settings.json`; PASS anche se i percorsi del Mac non esistono, così sul Mac dello studente il test è neutro)

**Interfaces:**
- Consumes: plugin completo (Task 1–5).
- Produces: `claude plugin list` contiene `wdm-agent`; `~/.claude/settings.json` hooks = `check-build-registration.sh` + `check-design-tokens.sh` (2 righe); `permissions.additionalDirectories` contiene anche `/Users/macbookpro16m1/Documents/Development/wdm-agent`.

- [ ] **Step 1: Scrivi `tests/test-no-duplicates.sh`**: se `~/.claude/skills` esiste, asserisce che nessuna cartella `fse-*` vi esista, che `_shared/fse-foundations.md` e `_shared/scripts/sync-theme-json-tokens.js` non esistano, che `~/.claude/hooks/check-block-contract.sh` non esista, che `~/.claude/settings.json` non contenga `check-block-contract.sh` e che `~/.claude/hooks/check-design-tokens.sh` (se esiste) non contenga `theme\.json`; `claude plugin list` contiene `wdm-agent`.

- [ ] **Step 2: Esegui `bash tests/run.sh`** → `FAIL test-no-duplicates`.

- [ ] **Step 3: Installa dal checkout locale**: `claude plugin marketplace add /Users/macbookpro16m1/Documents/Development/wdm-agent` poi `claude plugin install wdm-agent@wdm-agent`; `claude plugin list` → contiene `wdm-agent`. Se `claude plugin install` chiede conferma interattiva, chiedi a Carlo di eseguirlo lui in terminale.

- [ ] **Step 4: Riduci `~/.claude/hooks/check-design-tokens.sh` al ramo starter**: rimuovi il ramo `elif … theme\.json` (:32-40) e la riga 8 del commento; `set -euo pipefail` e il resto invariati. Verifica: `printf '{"tool_input":{"file_path":"/x/wp-content/themes/t/theme.json"}}' | bash ~/.claude/hooks/check-design-tokens.sh` → exit 0, stdout vuoto.

- [ ] **Step 5: Proponi a Carlo il diff di `~/.claude/settings.json`** (rimuovere l'oggetto `check-block-contract.sh` da `hooks.PostToolUse[0].hooks`; aggiungere `"/Users/macbookpro16m1/Documents/Development/wdm-agent"` a `permissions.additionalDirectories`) e **attendi la conferma**; applica con `jq` solo dopo il suo ok, conservando l'ordine delle chiavi (`jq --indent 2`, poi `diff` per mostrare che è cambiato solo quanto previsto).

- [ ] **Step 6: Elenca a Carlo i file da eliminare da `~/.claude` e attendi la conferma**; poi `rm -r` dei file elencati nella sezione Files. `~/.claude` è il repo `claude-global`: le cancellazioni le committa lui.

- [ ] **Step 7: Esegui `bash tests/run.sh`** → `PASS test-no-duplicates`, `ALL GREEN`.

- [ ] **Step 8: Checkpoint Carlo** — commit nel plugin "test: controllo doppioni sul Mac di sviluppo"; commit in `claude-global` "chore: skill fse-* e hook migrati nel plugin wdm-agent"; **nuova sessione** per far ricaricare i plugin.

---

### Task 7: wdm-theme allineato al plugin (CLAUDE.md, README del tema, DESIGN.md, spec)

**Files:**
- Modify: `/Users/macbookpro16m1/Sites/wdm-theme/CLAUDE.md` :4-7, :13-17, :47, :53-56, :118-125
- Modify: `/Users/macbookpro16m1/Sites/wdm-theme/wp-content/themes/wdm-theme/README.md` :220, :253-258
- Modify: `/Users/macbookpro16m1/Sites/wdm-theme/DESIGN.md` (rigenera i token con lo script del plugin → marker nuovo; riga nel log decisioni)
- Create: `~/Documents/Development/wdm-agent/docs/2026-10-26-wdm-agent-plugin-design.md` (copia della spec) e `~/Documents/Development/wdm-agent/docs/2026-10-26-wdm-agent-plugin.md` (copia di questo piano)
- Modify: `/Users/macbookpro16m1/Sites/wdm-theme/docs/superpowers/specs/2026-10-26-wdm-agent-plugin-design.md` (nota in testa: "copia di riferimento; la versione viva è in `docs/` del plugin")

**Interfaces:**
- Consumes: percorsi del Task 2; marker del Task 3.

- [ ] **Step 1: Verifica di partenza**: `grep -nE '~/\.claude' /Users/macbookpro16m1/Sites/wdm-theme/CLAUDE.md /Users/macbookpro16m1/Sites/wdm-theme/wp-content/themes/wdm-theme/README.md` → elenca le righe attese (CLAUDE.md 7 occorrenze, README 2).

- [ ] **Step 2: Riscrivi `CLAUDE.md`**: :4-5 "The agentic system is the `wdm-agent` Claude Code plugin (skill family `fse-*`)"; :7 "every convention lives in the plugin's `shared/fse-foundations.md` (cited by §)"; tabella :13-17 → tre righe: "Global — Claude Code (all projects) | `~/.claude/CLAUDE.md`", "Plugin `wdm-agent` — FSE skills, `shared/fse-foundations.md`, `shared/scripts/sync-theme-json-tokens.js`, `hooks/` | repo `carlogatto/wdm-agent` (install: see its README)", le righe "This project — …" invariate; :47 → `node ${CLAUDE_PLUGIN_ROOT}/shared/scripts/sync-theme-json-tokens.js {theme-root} --check` con la nota "(path as printed by the plugin's skills)"; :53-56 "Two skill families may coexist on a machine: `fse-*` (plugin `wdm-agent`) and `dev-*`/`design-*` (wdm-starter, `~/.claude/skills`). **This project uses only `fse-*`.**" e il resto del paragrafo invariato; sezione Hooks :118-125 → titolo "## Hooks (plugin `wdm-agent`, PostToolUse on Write|Edit — fse-foundations §12)", le due voci fse invariate, la voce `check-build-registration.sh` rimossa.

- [ ] **Step 3: Riscrivi il README del tema** :220 → "con lo script `sync-theme-json-tokens.js` del plugin `wdm-agent` (mai a mano)"; :253-258 → "Sistema agentico: plugin Claude Code `wdm-agent` (repo `carlogatto/wdm-agent`): `shared/fse-foundations.md`, skill `fse-theme-setup`, `fse-kit`, `fse-build`, `fse-block-edit`, `fse-menu-build`, hook `check-block-contract.sh` e `check-design-tokens.sh`, script dei token".

- [ ] **Step 4: Rigenera i token di wdm-theme con lo script del plugin** (`node /Users/macbookpro16m1/Documents/Development/wdm-agent/shared/scripts/sync-theme-json-tokens.js /Users/macbookpro16m1/Sites/wdm-theme/wp-content/themes/wdm-theme`): DESIGN.md riceve il marker nuovo, `wp-global-styles.css` invariato (`git status` lo dice a Carlo); poi `--check` → exit 0 senza avviso.

- [ ] **Step 5: Log decisioni in DESIGN.md**: riga `| 2026-MM-DD | Plugin wdm-agent installato (checkout ~/Documents/Development/wdm-agent, marketplace locale; studenti da GitHub carlogatto/wdm-agent): skill fse-*, fondamenta, script token e hook fse rimossi da ~/.claude; CLAUDE.md e README del tema aggiornati; marker Design Tokens rigenerato senza percorsi |`.

- [ ] **Step 6: Copia spec e piano in `~/Documents/Development/wdm-agent/docs/`** e aggiungi in testa alla spec in wdm-theme la nota di rimando.

- [ ] **Step 7: Verifica**: `grep -cE '~/\.claude' CLAUDE.md` = 1 (solo la riga `~/.claude/CLAUDE.md` della tabella), README del tema = 0; `bash ~/Documents/Development/wdm-agent/tests/run.sh` → `ALL GREEN`.

- [ ] **Step 8: Checkpoint Carlo** — commit in wdm-theme "docs: sistema agentico come plugin wdm-agent"; commit nel plugin "docs: spec e piano".

---

### Task 8: Accettazione (criteri 1–6 della spec)

**Files:**
- Create: `~/Documents/Development/wdm-agent/tests/ACCEPTANCE.md` (checklist compilata con data ed esiti)

- [ ] **Step 1: Criterio 1 (installazione)** — in una **nuova sessione** Claude Code in `/Users/macbookpro16m1/Sites/wdm-theme`: la lista delle skill disponibili contiene `wdm-agent:fse-theme-setup`, `wdm-agent:fse-kit`, `wdm-agent:fse-build`, `wdm-agent:fse-block-edit`, `wdm-agent:fse-menu-build` e **nessuna** `fse-*` senza namespace. Esito in ACCEPTANCE.md.

- [ ] **Step 2: Criterio 2 (comportamento identico)** — nella stessa sessione invoca `wdm-agent:fse-menu-build` fino allo Step 1 (dump): esegue `eval-file` dal percorso `/Users/macbookpro16m1/Documents/Development/wdm-agent/skills/fse-menu-build/scripts/wp-navigation.php` e il JSON ha `parts.header.ref = 4` e tre ref footer 69/70/71; fermati prima del plan (nessuna modifica). Il punto 1 della skill mostra il percorso delle fondamenta espanso (`/Users/macbookpro16m1/Documents/Development/wdm-agent/shared/fse-foundations.md`).

- [ ] **Step 3: Criterio 3 (hook una volta sola)** — nella sessione: `Edit` che aggiunge e poi toglie uno spazio in `blocks/wdm-block-cta/block.json` → nessun output di hook; `Write` di un `block.json` di prova in `blocks/wdm-block-zzz/` con `file:./build/view.js` senza `src/view.js` → **un solo** messaggio di errore (exit 2), poi cancella la cartella di prova; `Edit` di `theme.json` che cambia `settings.custom.radius.sm` da `4px` a `5px` → **un solo** avviso del sync con il diff, poi ripristina `4px` e verifica che il `--check` esca 0.

- [ ] **Step 4: Criterio 4** — `bash tests/run.sh` → `ALL GREEN` (include `test-no-absolute-paths`).

- [ ] **Step 5: Criterio 5 (README seguito alla lettera)** — quando Carlo ha creato il remoto GitHub e pushato: un sottoagente con **solo** il README come input esegue la sezione "Installazione" e "Verifica dell'installazione" (in un `--plugin-dir` o, se Carlo preferisce, su un secondo utente macOS) e riporta ogni punto in cui ha dovuto indovinare; correggi il README finché il report è vuoto.

- [ ] **Step 6: Criterio 6 (guard)** — nella sessione, su una copia temporanea di DESIGN.md con `theme_family | starter`, invoca `wdm-agent:fse-kit`: si ferma con il messaggio §0; ripristina.

- [ ] **Step 7: Compila `tests/ACCEPTANCE.md`** con data, versione Claude Code (`claude --version`), esiti 1–6, e chiudi il task. Checkpoint Carlo — commit "test: accettazione 1.0.0" e tag `v1.0.0` (Sourcetree).
