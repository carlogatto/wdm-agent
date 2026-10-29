# wdm-agent 1.3.0 — flusso autonomo: piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** portare il plugin `wdm-agent` da 1.2.0 a 1.3.0 con il flusso a quattro gate: skill `fse-brief` nuova, `fse-kit` senza gate intermedi, `fse-build` come build del sito rieseguibile con lo script `wp-page.php`, carta delle decisioni nelle fondamenta, test verdi, plugin reinstallato.

**Architecture:** le convenzioni cambiano una volta nelle fondamenta (§1 gate, §10 carta, §11 `## Brief` e `da eliminare`) e le skill le citano per §. La parte meccanica del diff kit ↔ WP è uno script PHP eseguito con `{wp-cli} eval-file`, gemello di `wp-navigation.php` (stessi exit code, stesso "diff, poi conferma in un turno successivo"). I test restano bash in `tests/`, con lo stesso SKIP quando WordPress non è raggiungibile.

**Tech Stack:** Markdown (SKILL.md, fondamenta), PHP 8 via WP-CLI (`parse_blocks`, `serialize_block`, `WP_Block_Type_Registry`), bash + jq per i test.

**Spec:** `docs/2026-10-30-wdm-agent-flusso-autonomo.md` (nel plugin). Il piano argomenta dalla spec: chi esegue legge entrambi.

## Global Constraints

- 2 spazi, mai tab, in ogni file; mai sovrascrivere un file esistente: leggere e completare.
- Nessun comando git (i commit sono di Carlo). I passi "Commit" del formato standard sono sostituiti da "Verifica" o omessi.
- Nessun riferimento a piani, fasi o decisioni numerate nel testo di `skills/*/SKILL.md` e `shared/fse-foundations.md` (spec §2 anti-obiettivi; test di Task 1).
- Nessun percorso assoluto del Mac di Carlo nel plugin fuori da `tests/`, `docs/`, `README.md` (`test-no-absolute-paths`).
- Dentro una SKILL.md: file della stessa skill con percorso relativo (`scripts/wp-page.php`), ogni altro file del plugin con `${CLAUDE_PLUGIN_ROOT}/…` (fondamenta §12).
- Frontmatter delle skill: solo `name` e `description`.
- Skill e fondamenta in inglese (come oggi); README, docs, test e messaggi dello script in italiano.
- Exit code dello script: 0 nessuna differenza · 1 differenze senza cancellazioni (plan) / scritto (apply) · 2 errore · 3 almeno una cancellazione in attesa di `confirm`.
- Il tema reale di wdm-theme non si tocca in questa sessione se non nei file elencati al Task 12; nessuna pagina reale viene scritta: i test usano una pagina di prova in bozza che cancellano.

## Review Focus

Input che la spec implica e che i test del Task 2 devono pinnare (ciascuno è un caso del test `test-wp-page.sh`):

1. **Contenuto libero in WP** (HTML senza commenti blocco, o blocco classico): non è nel kit, quindi `da cancellare`, mai scartato in silenzio → plan exit 3 con la riga `- (contenuto libero) da cancellare` (caso g).
2. **Differenza solo nei figli** (stesso padre, slide o card con testo diverso): il padre è `modificato`, il markup del padre viene da G per intero (caso f).
3. **File generato vuoto** con pagina piena: tutto `da cancellare`, exit 3, nessuna scrittura; `confirm` scrive la pagina vuota solo perché esplicitamente confermato (caso h).
4. **`page=` che non è una pagina** (slug inesistente, o id di un post di altro tipo): exit 2 con il messaggio `pagina assente` / `non è una pagina`, nessuna scrittura (caso e).
5. **Secondo run identico**: exit 0, `post_modified` invariato (nessuna `wp_update_post`) (caso a, seconda metà).

---

### Task 1: Fondamenta 1.3.0 e test dei riferimenti a piani

**Files:**
- Modify: `shared/fse-foundations.md` (§1, §4, §7 riga "h1 debt", §10, §11)
- Create: `tests/test-no-plan-refs.sh`
- Modify: `tests/test-foundations.sh`

**Interfaces:**
- Produces: i titoli e le stringhe che le skill citano: `## 1. Six moments, four gates`, `## 10. Session hygiene and the decision charter`, lo stato `da eliminare`, la sezione `## Brief` del template §11 con la riga `Stato: bozza | approvato YYYY-MM-DD`, i due formati ⏳ `⏳ kit {item} in revisione (dal YYYY-MM-DD)` e `⏳ build sito: pagina {Titolo} {M}/{N} (dal YYYY-MM-DD)`.

- [ ] **Step 1: scrivere il test dei riferimenti a piani**

`tests/test-no-plan-refs.sh` (stesso scheletro di `test-foundations.sh`): su `skills/*/SKILL.md` e `shared/fse-foundations.md`
```bash
pattern='decision [0-9]+ of the plan|Phase [0-9]+ M[0-9]+|\bTask [0-9]+\b|docs/superpowers/plans|dry run Phase'
hits="$(grep -rnE "$pattern" "$PLUGIN_ROOT/skills" "$PLUGIN_ROOT/shared/fse-foundations.md" || true)"
[ -z "$hits" ] || { echo "FAIL $name: riferimenti a piani/fasi:"; echo "$hits"; exit 1; }
```
Le "Phase 1–5" di `fse-theme-setup` sono le sue fasi di esecuzione e non entrano nel pattern.

- [ ] **Step 2: eseguirlo e vederlo fallire**

Run: `bash tests/test-no-plan-refs.sh` — Expected: FAIL con almeno `fse-build/SKILL.md:28` ("decision 14 of the plan") e `fse-foundations.md:501` ("Phase 4 M5").

- [ ] **Step 3: §1 — da "Two phases, promoted to sessions" a "Six moments, four gates"**

Sostituire la tabella e il paragrafo con: tabella `Moment | Who decides | Skill | Gate (deliverable) | Session` a sei righe (setup · brief · kit telaio · kit pagina ×N · build sito · manutenzione; gate 1–4 come spec §1), un paragrafo sulla chiusura del gate (osservazioni → revisione; ok esplicito in un turno successivo; fra i gate nessuna domanda: carta §10, `[da confermare]`), un paragrafo sul confine di sessione (kit = item; build = sito, rieseguibile) e la frase sugli stati (Telaio/Pagine `da progettare` → `kit` → `implementato|implementata`, Pagine anche `da eliminare`; Blocchi `kit` → `implementato`). Resta la deroga "kit e build nella stessa conversazione su richiesta esplicita".

- [ ] **Step 4: §10 — la carta**

Sostituire il punto "Every question the agent feels like asking during a build is a gap…" con la sottosezione `### The decision charter` = tabella a tre classi di spec §4 (Decide and log · Default + `[da confermare]` · Stop) e le quattro regole di contorno. Aggiornare il punto ⏳ con i due formati nuovi oltre a quello della build di pagina.

- [ ] **Step 5: §11 — template e verifica**

Nel template: sezione `## Brief` fra `## Design Tokens` e `## Telaio` (riga `Stato: bozza | approvato YYYY-MM-DD · Fonte: \`docs/brief/\` (N file letti, M non letti: …)`, `### Mappa` con colonne `Pagina | URL | Menu | Contenuto | Fonti`, `### Tono`, `### Plugin` con `Esigenza | Plugin | Decisione`, `### Immagini` con `File (\`assets/img/\`) | Uso | Origine | Nota`). Negli stati: Pagine `da eliminare`. Nella verifica su disco: `## Brief` assente → flag "brief assente", mai stop; `Stato: approvato` scritto solo da `fse-brief`; riga `da eliminare` con pagina assente in WP e kit assente → la riga si toglie (unico caso in cui il disco chiude una riga).

- [ ] **Step 6: §4 e §7**

§4: la frase sul kit "producibile da un render.php" resta solo come regola di anatomia (una `<section>` radice, niente `<script>`/`<style>` inline); aggiungere "no feasibility constraint: render.php prints any HTML; Formidable is the only parity exception". §7: riga "h1 debt to remember (Phase 4 M5)" → "h1 debt to remember".

- [ ] **Step 7: aggiornare `test-foundations.sh`**

Versione attesa `1.3.0` (fallirà fino al Task 9: atteso); stringhe aggiunte al ciclo: `Six moments, four gates`, `The decision charter`, `[da confermare]`, `da eliminare`, `## Brief`, `kit {item} in revisione`, `build sito: pagina`.

- [ ] **Step 8: verifica**

Run: `bash tests/test-no-plan-refs.sh` — Expected: `PASS test-no-plan-refs`. Run: `bash tests/test-foundations.sh` — Expected: FAIL solo sulla versione (1.2.0 ≠ 1.3.0).

---

### Task 2: `wp-page.php` — diff e scrittura della pagina (TDD)

**Files:**
- Create: `skills/fse-build/scripts/wp-page.php`
- Create: `tests/test-wp-page.sh`

**Interfaces:**
- Produces (citato da `fse-build` al Task 3):
  ```
  {wp-cli} eval-file ${CLAUDE_PLUGIN_ROOT}/skills/fse-build/scripts/wp-page.php plan  <file.html> page=<slug|ID>
  {wp-cli} eval-file ${CLAUDE_PLUGIN_ROOT}/skills/fse-build/scripts/wp-page.php apply <file.html> page=<slug|ID> [confirm]
  ```
  stdout: riga di sintesi `{slug} (id {ID}): {n} uguale · {n} modificato · {n} nuovo · {n} spostato · {n} da cancellare`, poi una riga per blocco nell'ordine di G (`=`/`~`/`+`/`>`/`-`, `{blockName} ({variant})`, per `~` gli attributi diversi `attr "prima" → "dopo"`, per `>` `posizione {j} → {i}`), poi per `-` i blocchi di W in coda; `apply` termina con `scritto` o `0 differenze, nessuna scrittura`. stderr: errori `wp-page: …`. Exit code: Global Constraints.
- Funzioni PHP (prefisso `fpg_`): `fpg_top_blocks(string $content): array` (blocchi di primo livello; un blocco con `blockName` null e `innerHTML` non vuoto dopo `trim` resta come blocco "contenuto libero", quelli di solo whitespace cadono) · `fpg_key(array $b): string` (`blockName|variant`, `variant` = `attrs['variant'] ?? ''`; contenuto libero → `(contenuto libero)`) · `fpg_norm(array $b): array` (attrs senza i default del tipo registrato, senza `metadata`, senza `imageUrl` quando `imageId` è presente; stringhe `html_entity_decode` + spazi collassati + `trim`; `children` = lista ricorsiva di `[key, attrs, children]`; contenuto libero → `['html' => trim(innerHTML)]`) · `fpg_align(array $g, array $w): array` (LCS sulle chiavi; coppie → `uguale`/`modificato` per `fpg_norm`; non accoppiati con stessa chiave fra G e W → `spostato`; resto G → `nuovo`, resto W → `da cancellare`; ritorna ops `['op','g','w']` nell'ordine di G più le cancellazioni in coda) · `fpg_merge(array $ops, array $g, array $w): string` (`uguale` → `serialize_block($w[j])`, altrimenti `serialize_block($g[i])`, cancellazioni omesse, `implode("\n\n")`) · `fpg_find_page(string $ref): ?WP_Post` (numerico → `get_post` con `post_type === 'page'`; altrimenti `get_page_by_path($ref, OBJECT, 'page')`).

- [ ] **Step 1: scrivere `tests/test-wp-page.sh`**

Scheletro di `test-sync-marker.sh`. `{wp-cli}` dal `DESIGN.md` reale: `WP="$(grep -F '| `{wp-cli}` |' "$SITE_ROOT/DESIGN.md" | awk -F'|' '{print $3}' | xargs)"`, `SITE_ROOT="${WDM_SITE:-/Users/macbookpro16m1/Sites/wdm-theme}"`; `$WP option get home >/dev/null 2>&1 || { echo "SKIP…"; echo "PASS $name"; exit 0; }`. Pagina di prova: `ID=$($WP post create --post_type=page --post_status=draft --post_title="wdm-agent test $$" --post_name="wdm-agent-test-$$" --porcelain)`; `trap '$WP post delete $ID --force >/dev/null 2>&1' EXIT`. Helper `run <args…>` → `$out`, `$rc` (stdout+stderr). File G in `tests/tmp/`. Casi, ognuno con asserzioni su `$rc` e `grep -F` sulla riga di sintesi:

- (a) G = `<!-- wp:wdm/cta {"variant":"split","title":"Uno"} /-->` + `\n\n` + `<!-- wp:core/paragraph --><p>Due</p><!-- /wp:core/paragraph -->` su pagina vuota → `plan` rc 1, `0 uguale · 0 modificato · 2 nuovo`; `apply` rc 1, `scritto`; `plan` rc 0, `2 uguale`; `MOD1=$($WP post get $ID --field=post_modified)`, `apply` rc 0 e `0 differenze`, `post_modified` = `MOD1`.
- (b) G con `"title":"Uno bis"` → `plan` rc 1, `1 uguale · 1 modificato`, riga `~ wdm/cta (split)` con `title "Uno" → "Uno bis"`; `apply` rc 1; `post get --field=post_content` contiene `Uno bis`.
- (c) `$WP post update $ID --post_content="$(…contenuto attuale…)\n\n<!-- wp:core/heading --><h2>Extra</h2><!-- /wp:core/heading -->"` con G di (b) → `plan` rc 3, `1 da cancellare`, riga `- core/heading`; `apply` rc 3 e contenuto ancora con `Extra`; `apply … confirm` rc 1 e contenuto senza `Extra`.
- (d) G di (b) con i due blocchi invertiti → `plan` rc 1, `2 spostato`; `apply`; `post_content` inizia con `<!-- wp:core/paragraph`.
- (e) `plan … page=slug-che-non-esiste-$$` → rc 2, stderr `pagina assente`; `plan … page=1` (post, non pagina) → rc 2, `non è una pagina`.
- (f) G = hero con una slide: `<!-- wp:wdm/hero {"variant":"image"} --><!-- wp:wdm/hero-slide {"title":"A"} /--><!-- /wp:wdm/hero -->`; `apply`; poi G con `"title":"B"` → `plan` rc 1, `1 modificato`, riga `~ wdm/hero (image)`.
- (g) `$WP post update $ID --post_content='<p>libero</p>'` e G di (f) → `plan` rc 3, riga `- (contenuto libero)`.
- (h) G file vuoto (0 byte) con pagina di (f) → `plan` rc 3, `0 uguale · … · 1 da cancellare`, `apply` rc 3 e contenuto intatto; `apply … confirm` rc 1 e `post_content` vuoto.

- [ ] **Step 2: eseguirlo e vederlo fallire**

Run: `bash tests/test-wp-page.sh` — Expected: FAIL al primo `run` (script assente: `eval-file` esce ≠ 0).

- [ ] **Step 3: scrivere `skills/fse-build/scripts/wp-page.php`**

Testa come `wp-navigation.php` (commento d'uso con i tre comandi e gli exit code, guardia `ABSPATH`, `$args`, `fpg_halt`, `fpg_err`), le funzioni dell'Interfaces, dispatch `plan`/`apply`. `apply`: se ci sono `da cancellare` e non `confirm` → stampa il report e il messaggio "Nessuna scrittura: mostra il diff al dev e, solo dopo la sua conferma in un turno successivo, rilancia con `confirm`." ed esce 3; se nessuna differenza → `0 differenze, nessuna scrittura`, exit 0; altrimenti `wp_update_post(['ID'=>…, 'post_content'=>fpg_merge(…)], true)`, `scritto`, exit 1. Default degli attributi: `WP_Block_Type_Registry::get_instance()->get_registered($name)?->attributes[$k]['default'] ?? null` (tipo non registrato → nessun default tolto). Contenuto libero: `blockName` null con `innerHTML` non vuoto; `serialize_block` lo restituisce com'è.

- [ ] **Step 4: verifica**

Run: `bash tests/test-wp-page.sh` — Expected: `PASS test-wp-page`; `$WP post list --post_type=page --post_status=draft --name=wdm-agent-test-*` → nessuna pagina residua.

- [ ] **Step 5: prova generale sul kit Home (criterio 5 della spec, sola lettura)**

Generare a mano in `{scratchpad}/page-home.html` il markup dei 10 blocchi del kit Home secondo i README (come farà `fse-build` 2e; `imageId` dell'hero quello già in WP), poi `plan … page=home`. Expected: rc 1, `0 uguale · 1 modificato · 9 nuovo · 0 spostato · 0 da cancellare`. Poi `plan` con il contenuto attuale di Contatti rigenerato dal suo kit → rc 0 o solo `modificato`. Nessun `apply`.

---

### Task 3: `fse-build` — la build del sito

**Files:**
- Modify: `skills/fse-build/SKILL.md` (riscrittura: description, Principle, Inputs, Step 0, Step 1, Step 2, Stop conditions, Never, checklist)

**Interfaces:**
- Consumes: `wp-page.php` (Task 2), fondamenta §1/§10/§11 (Task 1), `fse-menu-build` Step 1–5 invariati.

- [ ] **Step 1: description e Principle**

Description: "Use to build the whole site in WordPress from the approved kits for a wdm-theme FSE project — every `kit`/`implementata` row of DESIGN.md (telaio, pages, menus) in one run, re-runnable: it applies only the kit ↔ WP difference — "costruisci il sito", "build del sito", "monta la home in WP", "riallinea WP ai kit". Missing native blocks are created along the way. Not for wdm-starter projects (`dev-page-build`)." Principle: kit fonte dei valori; WP non perde nulla senza un ok in un turno successivo; nessuna domanda in corsa (carta §10); una review alla fine (gate 4); via "(decision 14 of the plan)" e "One item per session".

- [ ] **Step 2: Inputs e Step 0**

Inputs: `Item` → `Perimetro`: tutte le righe non `da progettare` di `## Telaio` e `## Pagine` (genitori prima dei figli), `da eliminare` incluse come cancellazioni, poi i menu; `Admin credentials`: password dal prompt, altrimenti **una** domanda all'avvio prima di ogni scrittura; assente → run senza Playwright, nessuna riga arriva a `implementata`; riga `Mode` eliminata. Step 0.7 riga di apertura: "sito: {P} pagine nel perimetro ({K} kit, {I} implementate, {E} da eliminare), {B} blocchi da creare, telaio {sì/no}, brief {presente/assente}".

- [ ] **Step 3: Step 1 telaio e Step 2 pagine**

Step 1: punto 2 (menu) rimosso con rimando allo Step 3 nuovo; "Stop." finale rimosso (si prosegue con le pagine). Step 2: 2d riscritto su `wp-page.php plan` (gli esiti, exit 3 → la pagina resta `kit`, il diff va nel report, si passa alla pagina successiva); 2e: `apply` (pagina assente: `post create` come oggi, poi `apply`), page options scritte solo se diverse; nuovo 2j "Pagine `da eliminare`": nel report come cancellazione (`post delete --force` + file kit + riga + log solo con l'ok in un turno successivo); pagine in WP senza riga → una riga "fuori dal flusso" nel report. Ciclo esplicito: "ripeti 2a–2h per ogni pagina del perimetro, poi Step 3".

- [ ] **Step 4: Step 3 menu, Step 4 report, Step 5 scaffold**

Step 3 nuovo "Menu": `fse-menu-build` Step 1–5 inline; exit 3 → il diff entra nel report come domanda, `apply … confirm` solo in un turno successivo. Lo scaffold di blocco (oggi Step 3) diventa Step 5, testo invariato. Step 4 "Final report and STOP" = spec §6.4 (per pagina, menu, saltate, fuori dal flusso, ⏳ `build sito` rimossa, una riga di log per il run).

- [ ] **Step 5: Stop conditions, Never, checklist**

Stop conditions = spec §6.5 (via Mode B, via "page in WP with blocks not in the kit", via "fse-menu-build diff waiting"), con la frase "deletions and menu diffs do not stop the run: they close it with the questions in the report". Never: via "build two pages in one session"; aggiungere "delete a block, a page or a `wp_navigation` without `confirm` in a later turn · ask during the run". Checklist aggiornata (perimetro, diff per pagina, menu, report).

- [ ] **Step 6: verifica**

Run: `grep -c 'wp-page.php' skills/fse-build/SKILL.md` → ≥ 3; `grep -n 'Mode B\|one page per session\|of the plan' skills/fse-build/SKILL.md` → vuoto; `bash tests/test-no-plan-refs.sh` → PASS.

---

### Task 4: `fse-kit` — un item, una review

**Files:**
- Modify: `skills/fse-kit/SKILL.md` (description, Step 0, Principle, Step 2.6, Step 3a, 3f, Step 4.2/4.5/4.6, Never, checklist)

- [ ] **Step 1: description e Principle**

Description: "Use to design in HTML, autonomously, the telaio (header/footer) or one complete page with its blocks and variants for a wdm-theme FSE project — "progettiamo il kit della pagina X", "disegna il blocco Y", "kit del telaio", "aggiungi la variante Z al blocco Y", or when a DESIGN.md row is `da progettare`. One item per session, one review at the end (kit + README contract + SCSS); WordPress code is written later by `fse-build`." Principle: via "the only phase where asking is the job"; il kit è il design vero fatto dall'agente nel sistema e nel brief; decisioni secondo la carta (§10), `[da confermare]` per i fatti; nessun vincolo di fattibilità (anatomia: una radice, niente script/style inline).

- [ ] **Step 2: brief, testi, ordine**

Step 0: leggere `## Brief` (mappa, tono, fonti, immagini); assente → flag "brief assente" nella riga di apertura. Step 1: item = quello chiesto, altrimenti telaio se `da progettare`, altrimenti la prima pagina `da progettare` nell'ordine della mappa. Step 4.2: testi dal brief verbatim quando li dà, scritti nel tono quando dà appunti, `[da confermare]` per i fatti (mai in `href`/`src`: default + commento); immagini da `assets/img/` del brief, placeholder + `[da confermare]` se mancano. Pagina tolta dalla mappa su richiesta del designer → riga `da eliminare` (il kit e la riga restano fino alla build).

- [ ] **Step 3: niente gate intermedi**

3a: "write … and agree it with the dev before any HTML" → "write it; it is part of the deliverable". 3f e 4.5: "iterate with the dev" → controllo con Playwright a 1440/768/390, screenshot `.playwright-mcp/shots/kit-{item}-{w}.png`. Step 2.6 / 3g / 4.6 (stato): la riga resta `da progettare` con `⏳ kit {item} in revisione (dal YYYY-MM-DD)` in `## Domande aperte` fino all'ok del designer in un turno successivo → `kit`, ⏳ via, riga di log; nuova sezione `## Review (the gate)`: contenuto del messaggio finale (URL su `:8848`, screenshot, blocchi/varianti nuovi con contratto, decisioni prese, tabella `[da confermare]` con default) e il ciclo revisioni → ok; revisioni dopo la build: riga resta `kit`, `fse-build` riapplica.

- [ ] **Step 4: verifica**

Run: `grep -n 'agree it with the dev\|iterate with the dev\|only phase where asking' skills/fse-kit/SKILL.md` → vuoto; `grep -c '\[da confermare\]' skills/fse-kit/SKILL.md` → ≥ 3; `grep -c 'in revisione' skills/fse-kit/SKILL.md` → ≥ 2.

---

### Task 5: `fse-brief` — skill nuova

**Files:**
- Create: `skills/fse-brief/SKILL.md`

**Interfaces:**
- Consumes: fondamenta §0, §10 (carta), §11 (`## Brief`), §12 (sync pre-autorizzato); `${CLAUDE_PLUGIN_ROOT}/shared/scripts/sync-theme-json-tokens.js`.

- [ ] **Step 1: scrivere la skill**

Frontmatter `name: fse-brief`, description: "Use to turn the designer's brief into the site contract for a wdm-theme FSE project — reads every file in `docs/brief/` (site root) and delivers, for one review, the site map, the tokens applied to theme.json, the tone, the plugins and the images, writing `DESIGN.md → ## Brief`, `## Pagine` and `## Telaio` — "leggi il brief", "partiamo dal brief", "prepara il brief del progetto", `/fse-brief`, or when `## Pagine` has only the Home created by the setup. Runs after `fse-theme-setup`, before `fse-kit`." Sezioni: MANDATORY first steps (fondamenta §0, §10, §11, §12; `DESIGN.md → Project Config` + guard; `CLAUDE.md`; `docs/brief/`) · Principle (spec §3) · Step 0 Guard and preconditions (guard; `DESIGN.md` assente → `fse-theme-setup`; `## Brief` `approvato` → stop salvo "rivediamo il brief"; `docs/brief/` assente o vuota → stop con il paragrafo "cosa depositare" di spec §3.2, testo in italiano) · Step 1 Read the brief (ogni file; `README.md` per primo; PDF/immagini con Read; `.docx` con la skill `docx` se c'è; non letti elencati) · Step 2 Derive (mappa, tono, token, plugin, immagini: regole di spec §3.3 e carta) · Step 3 Write (`## Brief` dal template §11, `## Pagine` righe `da progettare`, `## Telaio` → `da progettare`, `theme.json` + `node ${CLAUDE_PLUGIN_ROOT}/shared/scripts/sync-theme-json-tokens.js {theme-root}` + `npm run build`, immagini in `assets/img/`, font in `assets/fonts/`) · Step 4 Review (gate 1: contenuto del messaggio, URL del catalogo, tabella `[da confermare]`, fine del turno) · Step 5 Approval (turno successivo: revisioni → Step 2–4; ok → `Stato: approvato YYYY-MM-DD`, `{wp-cli} plugin install {slug} --activate` per i plugin approvati, riga di log, ⏳ nessuna) · Stop conditions (spec §3.4) · Never (installare plugin prima dell'ok · scrivere pagine o kit · inventare fatti sul cliente · toccare `docs/brief/` · git) · checklist.

- [ ] **Step 2: lettura cieca**

Un sottoagente legge solo `skills/fse-brief/SKILL.md` e descrive in 10 righe cosa fa la skill e quando si ferma. Expected: cita `docs/brief/`, `## Brief`, il catalogo su `:8848`, la tabella `[da confermare]`, l'ok in un turno successivo, i plugin dopo l'ok.

---

### Task 6: `fse-menu-build` e `fse-theme-setup` — ritocchi

**Files:**
- Modify: `skills/fse-menu-build/SKILL.md` (description, tabella delle razionalizzazioni, Principle)
- Modify: `skills/fse-theme-setup/SKILL.md` (Step 5b, "Next session")

- [ ] **Step 1: menu-build**

Description: aggiungere "runs inline as the last step of the `fse-build` site build and stays available on its own for maintenance". Tabella: riga `"fse-build is autonomous, it must not stop" | The telaio session stops at the diff like any other: that is its deliverable for the turn` → `… | The site build closes its run with the diff in the final report, like a deletion: the dev answers, `confirm` runs in a later turn`. Red flags e Never invariati.

- [ ] **Step 2: theme-setup**

Step 5b, ultima frase "Next session: `fse-kit` (telaio and pages of the project)" → "Next session: `fse-brief` (the designer deposits the brief in `{site-root}/docs/brief/`), then `fse-kit`". Nella Phase 5a, `## Pagine`: aggiungere "`fse-brief` rewrites these rows from the map".

- [ ] **Step 3: verifica**

Run: `grep -c 'fse-brief' skills/fse-theme-setup/SKILL.md` → ≥ 1; `grep -n 'telaio session stops' skills/fse-menu-build/SKILL.md` → vuoto.

---

### Task 7: test della struttura a 6 skill

**Files:**
- Modify: `tests/test-skill-refs.sh`, `tests/test-no-duplicates.sh`, `tests/test-readme.sh`

- [ ] **Step 1: test-skill-refs**

Ciclo a 6 skill (`fse-brief` aggiunta). Aggiungere: `at_least 'eval-file ${CLAUDE_PLUGIN_ROOT}/skills/fse-build/scripts/wp-page.php' "$S/fse-build/SKILL.md" 2`, `at_least "$SYNC" "$S/fse-brief/SKILL.md" 1`, `at_least '${CLAUDE_PLUGIN_ROOT}/skills/fse-menu-build/SKILL.md' "$S/fse-build/SKILL.md" 1`, `[ -f "$S/fse-build/scripts/wp-page.php" ]`.

- [ ] **Step 2: test-no-duplicates e test-readme**

`test-no-duplicates`: `fse-brief` nel ciclo delle `~/.claude/skills`. `test-readme`: sezione `## Il flusso` nel ciclo delle sezioni; stringhe `fse-brief` e `wdm-agent:fse-brief` fra quelle obbligatorie.

- [ ] **Step 3: verifica**

Run: `bash tests/test-skill-refs.sh` → PASS (Task 3 e 5 già fatti); `bash tests/test-readme.sh` → FAIL su `## Il flusso` (atteso fino al Task 8).

---

### Task 8: README del plugin

**Files:**
- Modify: `README.md` (tabella "Cosa contiene", sezione nuova `## Il flusso`, "Verifica dell'installazione")

- [ ] **Step 1: scrivere**

Tabella: riga `fse-brief` prima di `fse-kit` ("brief del designer in `docs/brief/` → mappa, token, tono, plugin per la review (\"leggi il brief\")"), righe `fse-kit` ("un item per sessione, una review alla fine") e `fse-build` ("build del sito dai kit approvati, rieseguibile, menu inclusi (\"costruisci il sito\")") riscritte. Sezione `## Il flusso` dopo "Cosa contiene": i quattro gate in una tabella di 4 righe (gate · cosa guarda il designer · skill), un paragrafo su revisioni e ok in un turno successivo, un paragrafo su `[da confermare]`. "Verifica dell'installazione": le 6 skill, `wdm-agent:fse-brief` nell'elenco. Elenco dei file: `wp-page.php` accanto a `wp-navigation.php`.

- [ ] **Step 2: verifica**

Run: `bash tests/test-readme.sh` → PASS.

---

### Task 9: versione 1.3.0, ACCEPTANCE, docs del plugin

**Files:**
- Modify: `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` (version `1.3.0`, description con "brief")
- Modify: `tests/ACCEPTANCE.md` (sezione `# Accettazione wdm-agent 1.3.0 — 2026-10-30` in testa, criteri di spec §10 con esito e evidenza; i punti 3 e 4 restano "da verificare nella conversazione nuova")
- Modify: `docs/2026-10-26-wdm-agent-plugin-design.md` (§4: albero con `fse-brief/SKILL.md` e `fse-build/scripts/wp-page.php`; paragrafo finale "Aggiornamento 2026-10-30: flusso a quattro gate, vedi `2026-10-30-wdm-agent-flusso-autonomo.md`")

- [ ] **Step 1: scrivere**

- [ ] **Step 2: verifica completa**

Run: `bash tests/run.sh` → `ALL GREEN` con 11 test (`test-wp-page` eseguito, non SKIP). Run: `claude plugin validate .` → ok (se il sottocomando esiste).

---

### Task 10: progetto wdm-theme — CLAUDE.md e spec prodotto

**Files:**
- Modify: `/Users/macbookpro16m1/Sites/wdm-theme/CLAUDE.md` ("First: read DESIGN.md" punto 2; tabella di routing; "Session-phased workflow")
- Modify: `/Users/macbookpro16m1/Sites/wdm-theme/docs/superpowers/specs/2026-10-26-wdm-theme-product-design.md` (§1 paragrafo "come si lavora", §11 fase 5)
- Modify: `/Users/macbookpro16m1/Sites/wdm-theme/docs/superpowers/specs/2026-10-26-wdm-agent-plugin-design.md` (stesso paragrafo "Aggiornamento 2026-10-30" del Task 9)

- [ ] **Step 1: CLAUDE.md**

Punto 2: `## Brief` (se presente) fra le sezioni da leggere. Tabella: riga nuova `leggere il brief del designer ("leggi il brief", "partiamo dal brief") | fse-brief | —`; riga `fse-kit` ("disegna il telaio o una pagina completa, una review a fine item"); riga `fse-build` ("costruisci il sito dai kit approvati, rieseguibile: "costruisci il sito", "monta la home" | fse-build | never dev-page-build"). "Session-phased workflow" riscritto in 6 righe: sei momenti, quattro gate (fondamenta §1), carta (§10), stati (incluso `da eliminare`), ⏳ nei tre formati, README = contratto invariato. Nessun placeholder risolto (il file viaggia nei progetti cliente).

- [ ] **Step 2: spec prodotto**

§1: "come si lavora (kit → README → build → WordPress)" → "(brief → kit → README → build → WordPress)". §11 fase 5: "Pagine, una per sessione: kit con `fse-kit` e build con `fse-build`…; Menu con `fse-menu-build` dopo la Home" → "Kit di pagina con `fse-kit`, una pagina per sessione con una review a fine kit (Home, Il metodo, Sistema agentico, Catalogo blocchi, Contatti); build del sito con `fse-build` 1.3.0, rieseguita a ogni kit approvato (la Home è il primo run), menu dentro la build; Servizi `da eliminare`, cancellata al primo `confirm`". Spec plugin: paragrafo di aggiornamento.

- [ ] **Step 3: verifica**

Run: `grep -c 'fse-brief' /Users/macbookpro16m1/Sites/wdm-theme/CLAUDE.md` → ≥ 2; `grep -n 'one page per session\|una pagina per sessione' /Users/macbookpro16m1/Sites/wdm-theme/CLAUDE.md` → vuoto.

---

### Task 11: DESIGN.md di wdm-theme

**Files:**
- Modify: `/Users/macbookpro16m1/Sites/wdm-theme/DESIGN.md` (`## Pagine` riga Servizi; `## Log decisioni`)

- [ ] **Step 1: scrivere**

Servizi: Stato `implementata` → `da eliminare`, Note + "(spec prodotto §8: cancellazione con `confirm` nel primo run di `fse-build` 1.3.0)". Log: riga `2026-10-30 | Plugin wdm-agent 1.3.0 (spec docs/2026-10-30-wdm-agent-flusso-autonomo.md e piano …-plan.md nel plugin): flusso a quattro gate (brief, telaio, kit di pagina, sito costruito), skill fse-brief nuova, fse-kit un item per sessione con una review, fse-build build del sito rieseguibile con wp-page.php (kit vince sui valori, cancellazioni solo con confirm in un turno successivo), menu dentro la build, carta delle decisioni in fondamenta §10, stato da eliminare; Servizi → da eliminare; CLAUDE.md e spec prodotto §1/§11 aggiornati; prossimo passo: build del sito (Home) con il flusso nuovo in una conversazione nuova`.

- [ ] **Step 2: verifica**

Run: `grep -c 'da eliminare' /Users/macbookpro16m1/Sites/wdm-theme/DESIGN.md` → ≥ 2; `node "$(jq -r '.plugins["wdm-agent@wdm-agent"][0].installPath' ~/.claude/plugins/installed_plugins.json)/shared/scripts/sync-theme-json-tokens.js" /Users/macbookpro16m1/Sites/wdm-theme/wp-content/themes/wdm-theme --check` → exit 0 (DESIGN.md toccato solo fuori dai token).

---

### Task 12: reinstallazione e revisione finale

**Files:** nessuno nuovo.

- [ ] **Step 1: reinstallare**

Run: `claude plugin uninstall wdm-agent@wdm-agent && claude plugin install wdm-agent@wdm-agent && claude plugin list | grep wdm-agent` → `wdm-agent` presente, versione 1.3.0 in `~/.claude/plugins/installed_plugins.json` (`jq -r '.plugins["wdm-agent@wdm-agent"][0].version'`).

- [ ] **Step 2: test dalla copia installata**

Run: `bash "$(jq -r '.plugins["wdm-agent@wdm-agent"][0].installPath' ~/.claude/plugins/installed_plugins.json)/tests/run.sh"` → ALL GREEN.

- [ ] **Step 3: revisione con revisore fresco**

Sottoagente sul modello più capace: legge spec + piano + i file modificati del plugin e di wdm-theme, verifica coerenza fra skill e fondamenta (titoli dei §, stati, formati ⏳, exit code dello script), i criteri di spec §10, i Global Constraints; riporta i problemi per gravità. Correggere e rieseguire `bash tests/run.sh`.

- [ ] **Step 4: fermarsi**

Report finale a Carlo: cosa è cambiato, test, cosa resta da verificare nella conversazione nuova (spec §10 punti 3 e 4), nessun commit fatto.
