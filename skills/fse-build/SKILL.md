---
name: fse-build
description: 'Use to build the whole site in WordPress from the approved kits for a wdm-theme FSE project — every `kit`/`implementata` row of DESIGN.md (telaio, pages, menus) in one run, re-runnable: it applies only the kit ↔ WP difference — "costruisci il sito", "build del sito", "monta la home in WP", "riallinea WP ai kit", "prosegui con la build", the dev''s `confirm` of a deletion an earlier build showed, or when a DESIGN.md row is `kit` and not yet implemented. Missing native blocks are created along the way. Not for wdm-starter projects (`dev-page-build`), and not for the ok to a kit under review (that is `fse-kit`, which builds after recording it). Runs in a sub-agent that does not see the conversation: pass the dev''s message word for word as arguments, plus `anteprima=` followed by the address of the kit preview when it is on; when it returns, follow the block at the end of its result.'
context: fork
agent: general-purpose
background: false
---

# FSE Build — approved kits → native blocks → the WordPress site, autonomously and re-runnable

## The request — this skill runs in a sub-agent

You are a **unit of work** (fse-foundations §10 "Units of work in a sub-agent"): you run in a
sub-agent, you do not see the conversation and you cannot ask the dev anything. What the dev
wrote is here, word for word, as the main conversation passed it:

> $ARGUMENTS

(Reading this file from disk inside a unit that `fse-kit` started after an ok, the line above
is a literal placeholder: your request is the one that unit received, and you go on from Step 0.)

- **One run, then stop.** The whole perimeter, the report, the block for the main conversation.
  Never the kit of a page: the main conversation starts it.
- **A `confirm` is the dev's, in the request, for a diff already shown.** It is valid for a
  deletion or a menu rewrite that an earlier run reported: its `⏳` line is in `## Domande
  aperte`. A `confirm` for something this run computes now is not one: the diff goes in the
  report and waits.
- **"Il controllo non passa: …"** as the request → the rows name what is wrong (a page that
  differs from its kit, a menu, a session left open, files not committed, a build left
  half-way): this run puts it right as any run would, and the log row says what it found.
- **Preview.** `anteprima=<url>` in the request is the kit preview the main conversation keeps
  on: use that address for every check on a kit and start nothing. Without it, §10
  "Browser-sync".
- **The result** is your last message: the handover message for the dev and, under it, the block
  for the main conversation (Step 4).

**MANDATORY first steps, in order:**
1. Read `${CLAUDE_PLUGIN_ROOT}/shared/fse-foundations.md` — all of it, in particular §0 (guard),
   §1 (gates), §3 (block anatomy), §4 (parity), §5 (CSS/JS), §6 (build), §7 (telaio), §8 (WP-CLI),
   §9 (Playwright), §10 (hygiene and the decision charter), §11 (DESIGN.md).
2. Read `DESIGN.md → ## Project Config` and apply the guard of Step 0 **before any other file**
   (`theme_family` row: `fse` → go on; any other value **or row missing** → stop).
3. Read the project `CLAUDE.md` and the rest of `DESIGN.md` (`## Brief` if present, `## Telaio`,
   `## Pagine`, `## Navigazione`, `## Blocchi`, `## Domande aperte`).
4. Read `${CLAUDE_PLUGIN_ROOT}/skills/fse-menu-build/SKILL.md` (Step 1–5 run inline at Step 3).
5. For every page of the perimeter: its kit (`src/kit/{prefix}-{page}.kit`). The compiled
   `html/{prefix}-{page}.html` and the block READMEs are read by `scripts/kit-pagina.js` (2a):
   open a README only for a block to create (Step 5) or one the script names in a reason.

All paths are relative to `{theme-root}` from `DESIGN.md → Project Config`.

## Principle

**The kit is the source of the values, WordPress never loses anything without an ok, and what
the client changed by hand in WordPress stays the client's.** The
build runs right after the dev's ok to a kit, **in the unit that records the ok**, started by
`fse-kit` (fse-foundations §1 "The ok continues"), and on its own when the dev asks to realign
WP to the kits. One run builds the whole perimeter (telaio, every approved page, menus) and ends with one
report; it is not a gate: the dev's remarks on the live site come back as kit revisions. It is
**re-runnable**: every page goes through the diff of `scripts/wp-page.php` and receives only its
difference; a second identical run answers "0 differenze" everywhere. The kit's texts, images
and links are placeholders: they fill a page at its first build, and from the moment someone
edits that page by hand in WordPress its existing content is never rewritten (2d). Deletions (a
block or a page the kit no longer has, a menu that would lose an item) are shown in the report
and executed only with the dev's ok **in a later turn** (`confirm`: the request of a later
unit); they never stop the rest of the run. A page that cannot be built (an element the README does not map, a page open in the
editor) is **skipped and reported**: the run goes on with the next one.
During the run the agent asks nothing: it decides under the charter (§10) and reports gaps at
the end. Gates 2 (telaio kit) and 3 (one per page kit) are `fse-kit`'s: a row is `kit` only
after the dev's ok there, and this run builds only rows that passed them.

## Inputs

| Input | Source |
|---|---|
| Perimeter | the `## Telaio` rows at `kit` (an `implementato` telaio is aligned by definition: `fse-kit` puts the row back to `kit` when it revises the telaio after a build; a kit-only row with no part or template is named in the report and left as is) and every row of `## Pagine` whose state is **not** `da progettare`: `kit` and `implementata` go through the diff (an aligned page answers "0 differenze"; a kit revised after the gate does not demote the row: the next run applies the difference), `da eliminare` enters as a deletion (2i). Parents before children. Rows `da progettare` are skipped and named in the report. The perimeter is **always the whole site**: the prompt never narrows it (an aligned page costs one "0 differenze"). "Riapplica la differenza della Home" still runs every page: the request says where the dev expects a change, not where to look |
| Backend login | no password: a temporary session for `DESIGN.md → Project Config → {agent-admin-user}`, opened with `sessione.js apri` and closed with `sessione.js chiudi` around every Playwright run (fse-foundations §9). `apri` exits 1 (servers stopped, agent user missing) or the session has no `browser_*` tool → no question: the run goes on without the browser (2c smoke test, 2g editor check skipped), no page reaches `implementata` (it stays `kit`, report: "verifica editor mancante") and *Cosa aspetta te* says what `apri` answered |
| `{wp-cli}` | `DESIGN.md → Project Config → Paths`; put it in a scratchpad script for the session |

## Step 0 — Guard and preconditions (all blocking)

1. `theme_family` = `fse` (fse-foundations §0); any other value, row missing or
   `DESIGN.md` missing → STOP with the §0 message for that case. Nothing else is read after the
   stop.
2. State on disk vs DESIGN.md (§11): the disk can demote or flag a row, never promote it (one
   exception, the built block); report. `## Brief` missing → flag "brief assente" (never a stop).
3. `Project Config` complete (`{prefix}`, paths, `{local-url}`, `{agent-admin-user}`, `{wp-cli}`).
4. For every page of the perimeter `src/kit/{prefix}-{page}.kit` exists, and `npm run build`
   exits 0 (regenerates `html/`). `npm run dev` may stay on (the dev switches between kit and
   build work): its transient errors while the block files are written one by one are not
   failures — the truth is this run's own `npm run build` (exit 0) after the last file, and WP on
   `{local-url}`, not the kit on :8848. If `pgrep -f 'build.js --watch'` finds it, say so in the
   report ("watch acceso: build finale rieseguita da questo run"); with two projects open the
   command also finds the other project's watch, which says nothing about this one.
5. Every block in the compiled pages (`section.{prefix}-block-{slug}` inside `<main>`) has a
   `README.md` with `## Attributi` and `## Markup` — a block with neither → stop ("blocco senza
   contratto: serve fse-kit").
6. `{wp-cli} option get home` answers; every parent page (URL with a parent segment) exists in
   WP or is itself in the perimeter before its children.
7. Opening line of the report: "sito: {P} pagine nel perimetro ({K} kit, {I} implementate, {E} da
   eliminare), {B} blocchi da creare, telaio {sì/no}, brief {presente/assente}".

## Step 1 — Telaio (when a `## Telaio` row is `kit`)

1. Compare `html/{prefix}-telaio.html` (or the header/footer of any compiled page) with
   `parts/header.html` / `parts/footer.html` / `parts/form-contacts.html`: structure (groups with
   the BEM `className`), content (logo: `site-logo` + `site-title {"level":0}` or only `site-logo`
   when a logo image exists → upload it with `wp media import` and `wp option update site_logo
   <id>`), social URLs, footer texts/contacts copied verbatim from the kit, anchors, `overlayMenu:
   mobile` + overlay colours from the palette. Edit the parts (read first, keep the `ref`).
   A `navigation` block whose `<nav aria-label>` the kit no longer has leaves the part with its
   column; its `wp_navigation` post stays in WordPress and goes to the report as a menu no
   longer used (Step 3). The default form keeps the `formId` the part has: a form that does not
   exist yet in Formidable is created by the dev (the line is in `## Domande aperte` since the
   setup), and until then the section prints title and text without fields — say it in the
   report, it is the first thing a visitor sees missing.
   Templates only if the kit implies a different structure (never a `front-page.html` without a
   reason — §7). Menus are **not** touched here: Step 3.
2. `_telaio.scss` comes from the kit phase; `npm run build`.
3. Verify (§9): home + one inner page at 1440/768/390 → `scrollWidth === innerWidth`, header
   height from the tokens, fixed header after `scrollTo({behavior:'instant'})` + transition wait,
   overlay opens/closes at 390, one h1 per view, `wp-admin/site-editor.php`: templates and parts
   without invalid blocks; `debug.log` empty. Screenshots `telaio-*.png`.
4. `DESIGN.md → Telaio`: `implementato`; theme README "Differenze kit ↔ WP" if new ones appear.
   Go on with the pages.

## Step 2 — Pages (repeat 2a–2i for every page of the perimeter, in order; then Step 3)

Progress line in `DESIGN.md → ## Domande aperte`: `⏳ build sito: pagina {Titolo} {M}/{N} (dal
YYYY-MM-DD)`, updated per page, removed at Step 4.

### 2a. Target sequence and block file — `scripts/kit-pagina.js` (never by hand)
```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/fse-build/scripts/kit-pagina.js" "{site-root}" {page} "{scratchpad}/page-{slug}.html" page={slug}
```
`{page}` is the kit name without the prefix (`src/kit/{prefix}-{page}.kit`, compiled to
`html/{prefix}-{page}.html`); `page=` is the page in WordPress (ID, URL path or slug) and is
omitted on a page not built yet. The script reads the compiled kit, the README of every block it
meets, the icons of the set and the theme patterns, asks WordPress for the ids, imports the kit
images the media library lacks, and writes the file that `wp-page.php` compares (2d). It prints
the sequence `K` (one label per top-level block, `slug (variant)`), the page options the kit
implies (2e) and one `nota —` line per gap: keep the output, it goes into the log row and the
report. Same kit and same site → the same file, byte for byte.

**The block file is never written or edited by hand, and no generator is written during the
run.** Exit **0** → file written. Exit **3** → the page cannot be mapped: one line per reason
(the block, the element, what the README should say); nothing was written and WordPress was not
touched → the page is skipped (below). Exit **2** → environment (kit not compiled, WP-CLI not
answering): fix it and run again. Exit 1 is never the script's.

What the script does is the mapping contract, the same for every block, present or future
(the notation it reads in a README is in fse-foundations §3 "README.md — the contract"):
- `variant` = modifier `{prefix}-block-{slug}--{x}` → the attribute the README `## Varianti`
  row of `x` names (`` `source: "query"` ``), else `variant`;
- values: `.__{name}` → the string attribute `{name}` (inner HTML, `<br>`/`<strong>` kept; a
  Note `kit: .__eyebrow` wins over the name), the tag of `.__title` → `headingLevel` (an `<h1>` title in a block that has `headingLevel` →
  the page is skipped: the block would print `h2`),
  `a.__button` → `buttonText` / `buttonUrl` (href; on a button, i.e. a link that carries
  `wp-element-button`, `#` → `""`, reported) / `buttonNewTab` (`target="_blank"`), the second
  `.__button` → `secondaryButton*`, a text link (`a.__link` → `linkText` / `linkUrl`, without
  `wp-element-button`) keeps its href as it is, `#` included (without it the block drops the
  element that holds the link, and the page would differ from the kit in structure),
  `img.__img` → image (a file of `assets/img/`: the attachment with that name, imported when
  absent; then `imageId` + `imageUrl` + `imageAlt`), `style="--{prefix}-x:N"` / `data-*` / an
  element modifier → the attribute whose Note names it; `id` on the section → `anchor`; an `align*` class other than the default → `align`; colour
  classes `has-{slug}-background-color` → `backgroundColor`, `has-{slug}-color` → `textColor`;
  children (`.swiper-slide`, cards) → one child block each with the same mapping, when `##
  Figli` names them; in a block with free InnerBlocks, `<p>` → `core/paragraph`, `<h1>`–`<h6>` →
  `core/heading` (`level` from the tag), `pre.wp-block-code` → `core/code`, only in their form
  without attributes (a `has-text-align-*` class or any other core block → the page is skipped).
  An icon of the set arrives inlined in the compiled page: its slug is the name of the file in
  `assets/img/icons/` with the same markup. A `{prefix}/form`: `formId` is the Formidable form
  whose key is the `form_key` field of the kit's form; no such form → `formId` 0, reported
  ("form «{key}» da creare in Formidable"). Defaults are omitted.
- Post-derived content (a `card` child the kit shows **without `__text`**; a `cards-carousel`
  query variant, whose cards are not written: `## Figli` says "Solo in `manual`"): the kit card
  shows a title → a **published** post with that title, then with that slug, `postType` from
  the post found; no match → it is a card written by hand that has no text (the text is
  optional): it keeps the kit's title, image and link, and the script reports it ("nessun
  contenuto pubblicato si intitola X: scritta come card a mano"). A card whose title is the placeholder of the base theme's catalogue («Titolo del
  contenuto») is not looked up by title: it keeps the post the WordPress page already has in
  that position (`page=`) and, on a page not built yet, takes the most recent published post; a
  site with no published post → `postId: 0`, reported.
- The default form at the end of `<main>` (`.wp-block-template-part.{prefix}-form-contacts`)
  is telaio, printed by the template: it is never mapped to a block and never a reason to skip
  the page. It only decides the page option `{prefix}_show_form` (2e).
- A top-level element of `<main>` that is not a `{prefix}-block-*` section but carries the root
  class of a theme pattern (`{prefix}-{x}` ↔ `patterns/{prefix}-{x}.php`) → the pattern's block
  markup with the kit's texts in its headings and paragraphs, in order (the kit element must
  have the structure of the pattern, tag by tag: anything more, or less → the page is skipped); any other unmapped top-level element → the page is skipped.
- **Nothing is dropped.** Inside a block every project class, modifier, `data-*`, `--{prefix}-*`
  property and text is either read by a rule above or named by the block README; anything else
  is a reason of the exit 3. So is an element without a class of the block that carries something
  of its own (an `<img>`, an `<iframe>`, a form field, an `href` or a `src`, a class the README
  does not name): it is never walked through blindly. The script does not look inside the element a README declares as
  plugin output ("Parità kit ↔ render: fino a `__el` incluso").
- Texts verbatim (only the whitespace of the source formatting is collapsed), placeholders `[da confermare]` included. Never rewritten. An HTML comment
  `<!-- {attribute} "value" [da confermare]: … -->` next to an element marks that value
  (typically a URL) as provisional: the script uses the element's value and reports the comment.

**A page that cannot be mapped is skipped, not the run.** An unknown element, modifier or
attribute means the kit says something the README contract does not cover: nothing of that page
is generated or written (never a partial page), its row stays as it is (`kit` stays `kit`), the
report carries the lines the script printed, and the run goes on with the next page. The fix is
a kit or README revision (`fse-kit`), not a question in the middle and never a file composed by
hand to get past the script.

### 2b. Missing blocks → scaffold (Step 5), all variants
For every distinct `slug` of K without `blocks/{prefix}-block-{slug}/block.json` → Step 5. An
implemented block whose README lists a variant/attribute the kit uses but the code lacks →
`fse-block-edit` inline, additive only (new attribute with a default, new variant): its Steps
0–3 as written there, while the log row, the commit and the handover are this run's, not a
closing of its own; a
non-additive change (rename or removal of an attribute, a different structure) → the pages that
use that block are skipped and reported: it is a decision of the dev.

### 2c. Build + smoke test
`npm run build` exit 0; the hook `check-block-contract.js` silent; registry: `{wp-cli} eval
'…WP_Block_Type_Registry…'` lists every `{prefix}/{slug}` of K. For each block created in this
run: Playwright smoke test (§9, points 1–5: the model `pw-blocco.js`) → zero console errors,
saved content as expected, frontend renders render.php. A failure here is fixed in this run (it is this run's code).

### 2d. Diff kit ↔ WP — `scripts/wp-page.php` (never skipped)
`plan` is the only check that the page in WordPress is what the kit says: it runs for **every**
page of the perimeter, in every run, also when "nothing changed" and also when the page will not
be written. A run that skips it has verified nothing for that page, and the log row says which
pages went through it. The file is `{scratchpad}/page-{slug}.html`, written by
`kit-pagina.js` in 2a (`<!-- wp:{prefix}/{slug} {"attr":"value"} /-->`, children inside the
parent, core blocks with their HTML, `imageId` always with `imageUrl`, defaults omitted, ids
resolved from WP): never a file composed or corrected by hand.
```bash
{wp-cli} eval-file "${CLAUDE_PLUGIN_ROOT}/skills/fse-build/scripts/wp-page.php" plan "{scratchpad}/page-{slug}.html" page={slug}
```
The script first checks the generated file: a block comment whose attributes are not a JSON
object is an error (exit 2 with the block name — WordPress would read it as a block without
attributes and the page would look fine): it means the file did not come from `kit-pagina.js`
as it wrote it; generate it again (2a), never touch the verdict. Then it
aligns the top-level blocks of the file (G) and of the page (W) by key (block name + variant;
`page=` accepts the ID, the URL path `servizi/fisioterapia` or the slug) and compares normalized
attributes, children included. What happens next depends on **whose page it is**, which the
script reads from the fingerprint it saved at its last write (post meta `_fse_build`):

- **Page not touched by hand** (development): the kit wins. Per block: `uguale` · `modificato`
  (before → after in the report) · `nuovo` · `spostato` (reordered, nothing lost) · `da
  cancellare` (in WP, not in the kit).
- **Page modified by hand in WordPress** (the first line of the output says so): WordPress is
  the master and stays so. Existing blocks are left exactly as they are, order included:
  `protetto` where they differ from the kit. Only blocks **born in the kit after the last build**
  enter (`nuovo`, placed after the block that precedes them in the kit). A block the client
  removed does not come back (`tolto a mano`), one the client added stays without any
  confirmation (`aggiunto a mano`), one the kit dropped is `da cancellare` and waits for
  `confirm`. A revision of the kit's texts no longer reaches this page: that is the rule, not a
  failure, and it is never turned into a question. Two limits to say in the report when they
  apply: a block whose **variant** changed in the kit shows as `da cancellare` + `nuovo`, and
  the block to delete carries the client's texts (say so in the `confirm` question); a page
  built before the fingerprint existed and then edited by hand has no record of what the kit
  was, so a block the client added shows as `da cancellare` (it waits for `confirm`, nothing is
  lost) and one the client removed comes back as `nuovo`.

Exit **0** no differences · **2** error (`pagina assente` → 2e creates it; `non è una pagina`; a
malformed generated file) · **3** at least one deletion waiting · **5** differences to write ·
**6** nothing to write on a page modified by hand that differs from the kit. Exit **1** is never
the script's: WP-CLI or PHP failed, treat it as an error and read the output. Keep the output:
it is the page's section of the log row.

### 2e. Write the difference (WP-CLI, the only write path)
```bash
ID=$({wp-cli} post create --post_type=page --post_title="{Titolo}" --post_name={slug} --post_parent={parent-id} --post_status=publish --porcelain)   # only when plan said "pagina assente"
{wp-cli} eval-file "${CLAUDE_PLUGIN_ROOT}/skills/fse-build/scripts/wp-page.php" apply "{scratchpad}/page-{slug}.html" page=$ID   # the ID after a create; else the slug or the URL path
{wp-cli} post meta update $ID {prefix}_show_title 0   # only if 2a printed "{prefix}_show_title 0" (the kit has its own h1) and the meta differs; else leave the default 1
{wp-cli} post meta update $ID {prefix}_show_form 0    # only if 2a printed "{prefix}_show_form 0" (the kit does not print the default form at the end of <main>) and the meta differs; else leave the default 1
```
`apply` writes only when there is a difference (exit **5** `scritto`, exit **0** `0 differenze,
nessuna scrittura`, exit **6** nothing to write on a page modified by hand). On a page not
touched by hand it keeps the `uguale` blocks of WP (re-serialized, same attributes) and takes
`modificato`/`nuovo`/`spostato` from the file in the kit's order; on a page modified by hand it
only adds the `nuovo` blocks. With deletions pending it **does not write** and exits 3: the page
keeps its state, the diff goes to the report as a question, the run continues with the next
page; `apply … confirm` runs only in a later turn, after the dev's answer. A page **open in the
editor** by a user is not written (exit **4**, with the user's name): the page is skipped and
reported ("chiudi la scheda dell'editor: la riallineo al prossimo giro"), the run goes on.
`apply … forza` makes the kit win again on a page modified by hand and turns it back into a page
not touched by hand: only when the dev asks for it, for that page, in a turn after the one that
showed them what `protetto` means there. Title from `DESIGN.md →
Pagine`, slug = last URL segment, parent = page of the URL prefix. Page options (fse-foundations
§7) are the kit's say: derived, written only when different, listed in the report. The default
form follows the kit and nothing else: a page kit with its own `{prefix}/form` normally does not
import it (`fse-kit` Step 4.3), the catalogue of the base theme does, on purpose.

### 2f. Per-block frontend check
`curl -sk {permalink}`: no `Fatal|Warning:|Notice:`; one `.{prefix}-block-{slug}` per K[i] in
order, modifier classes as derived, first text of each block = kit (normalized: whitespace,
`wptexturize` quotes/ellipsis/dashes, entities).

### 2g. Page parity + QA (Playwright, §9 "Per page": the model `pw-pagina.js`)
Editor: the page opens with 0 invalid / 0 `core/missing` blocks, `isEditedPostDirty() === false`,
block count = N. Frontend at 1440/768/390: `scrollWidth === innerWidth`, exactly one h1,
as many carousels started as the page has (`caroselliAvviati` = `caroselli`), every in-page anchor target exists. Screenshots editor +
frontend ×3 in `.playwright-mcp/shots/`. On a page written from the kit in this run also the
texts must be the kit's (2f): a wrong text there is a mapping error, and the file is never the
place to fix it: correct the kit or the README note the script reads, run 2a again, `apply`
again. Kit and README right and the file wrong → a defect of the script: the page goes to the
report with the element, and its row stays `kit`.

**Structure parity** is checked by the script, for the whole site at once (fse-foundations §4):
```bash
node "${CLAUDE_PLUGIN_ROOT}/shared/scripts/parita.js" "{site-root}"
```
It looks at header, footer and every `implementata` page, so it runs after 2h has written the
rows of the pages that passed the checks above, and again at Step 4. Silent → aligned. Exit 1
on a page of this run: a difference where **WP is right and the kit is wrong** (a class
`render.php` always prints, an element the README fixes, a stale kit) is **fixed in the kit in
this run** (the files `fse-kit` would touch, texts untouched), `npm run build`, check again, one
line in the log row: never handed back to the dev, never a `## Domande aperte` item. A
difference where the kit is right is a mapping error: handle it as above (kit or README, then
2a and `apply` again; never the file). A
difference that stays (it would change the design: order, variant, a missing element on a page
modified by hand) goes in the report with the line the script printed, and the row of a page
built in this run goes back to `kit`. Exit 3 → say why in the report; the pages keep their
state. Without the browser (see Inputs): frontend checks via `curl` only, editor check reported
as missing; the parity script needs no browser.

### 2h. Documentation (no confirmation asked)
- `DESIGN.md → Pagine`: `implementata` only when 2g is green (else stays `kit`, with the reason
  in the report); a page modified by hand (exit 6, or `protetto` rows) keeps the state it has:
  its content is the client's and is not compared with the kit's. `## Blocchi`: `implementato`
  for the blocks created (block, state, origin page: nothing else).
- Each block created/edited: README completed where the kit revealed a gap. A block **created**
  gets one line in the theme README list of blocks (if the project keeps one) and in the project
  `CLAUDE.md → Existing Blocks` (folder and name, with `{prefix}`). Variants, attributes and
  children are written in the block README only: never copied into those lists or into
  `DESIGN.md` (fse-foundations §3 "README.md — the contract").
- `version` of edited blocks bumped.

### 2i. Pages `da eliminare` and pages outside the flow
A row `da eliminare` (the map dropped the page; row and kit still there) → in the report as a
deletion: "pagina {Titolo} (id N) da cancellare: `confirm`?". Only with the dev's ok in a later
turn: `{wp-cli} post delete {ID} --force`, delete `src/kit/{prefix}-{page}.kit` (and its
`@import`s in the catalogue kit), remove the row, log. Menu items pointing to it become orphans
of `fse-menu-build` (Step 3). A page in WP without a row in `## Pagine` (e.g. "Pagina di
esempio", "Privacy Policy") is never touched: one line in the report, "fuori dal flusso".

## Step 3 — Menus (`fse-menu-build` inline)

After the pages exist: `fse-menu-build` Step 1–5 with its script (`dump` → `plan` → `apply`),
exactly as written there. Additions and reorders are written at once. `apply` exit 3 (WordPress
would lose an item of the menu) → the diff enters the final report as a question; `apply …
confirm` runs only in a later turn, after the dev's answer — the run does not stop for it. Exit
4 (the menu is open in the editor) → reported like a page open in the editor. `DESIGN.md → ##
Navigazione` is written by its Step 5.

**Menus no longer used.** A `wp_navigation` post no navigation block refers to any more (the kit
dropped its column, or two blocks now share one menu because their lists are the same) is never
deleted by the run: `dump` shows it (`navigations` has an id that no `navigation_blocks` entry
carries), the report lists it in *Cosa aspetta te* ("menu «{titolo}» (id N) non più usato: lo
cancello?") and its `## Navigazione` row says "non usato". With the dev's ok in a later turn:
`{wp-cli} post delete {id} --force`, then the row is removed.

## Step 4 — Close the run, report, go on

1. **Parity, then log, not chat.** `parita.js` (2g) once more on the whole site and `npm run
   check` exit 0. `DESIGN.md → ## Log decisioni`, one row for the run with everything
   technical: per page id, blocks created (with variants) and additive edits, the `wp-page.php`
   counts (`uguale`/`modificato`/`nuovo`/`spostato`; on a page modified by hand
   `protetto`/`tolto a mano`/`aggiunto a mano`), pages skipped and why, images
   imported, page options set, parity differences, `#` and `[da confermare]` kept; per menu
   created / updated / 0 differenze / diff waiting, orphans; pages skipped (`da progettare`),
   `da eliminare` waiting, outside the flow; decisions taken under the charter; checks run and
   the screenshot folder. `⏳ build sito` removed; `## Domande aperte` with one line `⏳ confirm: …
   (dal YYYY-MM-DD)` per pending `confirm` (what gets deleted or rewritten, with its id, and what
   follows: never the `⏳ build sito` form, which means a run still in progress) and one line per
   gap with its consequence. `sessione.js chiudi` answered `sessioni attive: 0`; close the browser tab.
   Then commit the run
   (fse-foundations §10): the handover says how many commits wait for the push.
2. **Handover message** in the shape of fse-foundations §10 "The handover message":
   - *Esito*: `⚠️ chiuso, con attese` when a `confirm` or a gap is open, `✅ chiuso` otherwise;
     `❌ fermato` + reason on a stop condition.
   - *Cosa è cambiato*: pages now `implementata` with permalink, blocks born (name, variants),
     blocks edited (name, version), telaio parts touched, menus created or updated. Opening line
     of Step 0 only if it demoted or flagged a row.
   - *Cosa aspetta te*: one item per `confirm` (page: id, URL, what is deleted with it — kit,
     html, row — and the menu items that go orphan; menu: the items WordPress would lose), one
     per page skipped (what the kit or the README lacks, or who has it open in the editor), one
     per gap the visitor can hit (404 links, placeholder images), one per `[da confermare]`. A
     page modified by hand is **not** an item: one line in *Cosa è cambiato* the first time the
     run meets it ("la pagina Chi siamo è stata modificata in WordPress: da ora i suoi testi
     restano quelli di WordPress, dal kit entrano solo le sezioni nuove"), then silence.
   - *Prossimo passo*: a pending `confirm` is answered in this conversation: say what the dev
     writes for each item, by id; it is applied by the unit that receives the answer (`fse-build
     2i` / `fse-menu-build apply … confirm`); no prompt to paste. Then the next `da progettare`
     row of `## Pagine`, in one line: its kit is what comes next (point 3).
   Everything else (counts, scripts, intermediate fixes, green checks) stays in the log row.
3. **Stop, and say what follows.** The unit ends here and never starts the kit of the next page:
   under the handover message, after a `---` line, the block for the main conversation
   (fse-foundations §10 "Units of work in a sub-agent"), with real paths:
   ```
   Per la conversazione principale (non mostrare al dev):
   - Controllo: node "${CLAUDE_PLUGIN_ROOT}/shared/scripts/controllo.js" "{site-root}"
   - Anteprima: {usata <url> | accesa da me e ora spenta: accendila (npm run dev in {theme-root}) e, se l'indirizzo cambia, correggilo nel messaggio}
   - Poi: {invoca fse-kit per la pagina «{Titolo}» | aspetta il dev: confirm {che cosa} | nulla: nessuna pagina da progettare}
   ```
   "Poi" names the first `## Pagine` row `da progettare` (order of the map), unless the
   request said to stop after the build; a pending `confirm` does not hold the next kit back
   (the dev answers it whenever they want): name the page and add the confirm in the same line.
   A later run starts from zero and finds the aligned pages at 0 differenze: there is no progress
   state to resume.

## Step 5 — Block scaffold (from the README, every variant)

Produce `blocks/{prefix}-block-{slug}/` exactly as fse-foundations §3, using the reference
blocks of the theme (`image-text` for RichText/image/LinkButton/toggle, `hero` + `hero-slide`
for InnerBlocks + context + variant select + Swiper, `cards-carousel` + `card` for post-picker,
query and ServerSideRender, `columns-wrapper` for free InnerBlocks) as templates to adapt — read
them, do not reinvent.
Write `block.json` **last** (after `render.php`, `src/`, README): `check-block-contract.js`
exits 2 until every `file:` source and `render.php` exist.

1. `block.json` (written last, see above): name/version/title/category/icon/description/
   textdomain; attributes = the README table (types, defaults; `align` default `full` for
   sections); supports (`align:
   [full]`, `anchor`, `html: false`, `color`, `spacing.padding`); `parent`/`usesContext` for
   children, `providesContext` for parents; `render`, `editorScript`, `style` (array with
   `{prefix}-swiper` first for carousels), `editorStyle` iff `editor.scss`, `viewScriptModule`
   iff `view.js`.
2. `render.php` = the kit markup (§4) with attributes, `get_block_wrapper_attributes`,
   escaping, `$content` for children, `is_post_type_viewable` for post-type attributes.
3. `src/index.js` (+ `save: () => <InnerBlocks.Content />` with children), `src/edit.js`
   replicating render.php (controls per table; Italian strings in `__()`; shared components
   from `src/js/editor/`; `useDisabled` + `skipBlockSupportAttributes` around SSR previews).
4. `src/style.scss` (exists from the kit phase; else write it per §5), `src/editor.scss` for
   placeholders/static previews (`@use 'editor/link-button'` when LinkButton is used),
   `src/view.js` (from the kit phase or per §5).
5. `theme.json → styles.blocks["{prefix}/{slug}"].spacing.padding` top/bottom `section-lg` for
   section blocks (read theme.json, add the entry). The hook `check-design-tokens.js` will
   report the tokens as stale: this entry is **pre-authorised** by the README contract
   (fse-foundations §12) — do not ask, run
   `node "${CLAUDE_PLUGIN_ROOT}/shared/scripts/sync-theme-json-tokens.js" "{theme-root}"`
   (DESIGN.md tokens + `wp-global-styles.css`) and log the entry in `## Log decisioni`. Then remove this block's
   kit-only padding rule from `_css-shared.kit` (fse-kit 3e), now emitted by theme.json.
6. Children: their own folder with the same steps.
7. `npm run build` → exit 0; `build/` has `index.asset.php`; hook silent; registry lists the
   block; smoke test (2c). README: add `## Markup di inserimento` if missing (and note the gap).
8. `DESIGN.md → Blocchi` row `implementato`.

## Stop conditions (the only ones)

**The run stops** only when no page could be built correctly: guard fails · `npm run build`
fails on code not written in this run · `{wp-cli}` does not answer (Step 0.6) · a block of the
kit without README/attribute table/markup (Step 0.5).

**A page is skipped, the run goes on** (the row keeps its state, the report says why and what
unblocks it): kit or compiled html missing for that row · a block instance whose markup cannot
be mapped to the README (unknown element, modifier or attribute) · a non-additive change needed
on an implemented block the page uses · parent page missing and not in the perimeter · the page
open in the editor by a user (`apply` exit 4) · console errors in a block implemented outside
this run (the page is written, it does not reach `implementata`).

**Deletions and menu losses neither stop nor skip**: they close the run with the questions in
the report, and `confirm` runs in a later turn.

## Never

`save()` with markup · write or edit the block file of a page by hand, or write a generator for
it (2a: `kit-pagina.js` only) · rename or remove attributes of an implemented block · delete a block, a
page or a `wp_navigation` without `confirm` in a later turn · ask during the run (the charter
decides, the report collects) · skip 2d for a page, or narrow the perimeter because the prompt
names one page · drop an unmapped element to make a page pass · `apply … forza` without the
dev's explicit request for that page · rewrite a page modified by hand in any other way (`wp
post update`, the editor) · rewrite kit texts · write credentials anywhere · write through
the Site Editor, Playwright or SQL (`wp-page.php` and `wp-navigation.php` are the write paths) ·
`git push`, or any git command beyond the fse-foundations §10 rule · `@use 'swiper/swiper'` in a block.

## Completion checklist

- [ ] Guard passed, state on disk verified, perimeter and opening line reported
- [ ] Missing blocks scaffolded with every README variant; build exit 0; hook silent; smoke test 0 console errors
- [ ] Every page of the perimeter through `kit-pagina.js` (the block file never by hand) and `wp-page.php plan` → `apply` (2d never skipped); deletions left to `confirm`; pages modified by hand left to WordPress; pages skipped named with what unblocks them; page options derived
- [ ] Editor: 0 invalid blocks, not dirty; frontend 3 widths: no overflow, 1 h1; `parita.js` silent on the whole site (kit errors fixed in the kit in this run, differences that stay reported)
- [ ] Menus through `fse-menu-build` inline; diffs waiting in the report
- [ ] DESIGN.md (Pagine, Blocchi, Navigazione, ⏳ removed, Log, Domande aperte), READMEs, `version` bumps
- [ ] Log row written; commit of the verified run (fse-foundations §10: main branch, files added by name; the push is the dev's); handover message (§10: esito · cosa è cambiato · cosa aspetta te · prossimo passo, nessun prompt da incollare); tab closed; under the message the block for the main conversation (control command, preview, the next `da progettare` page or none): the kit of that page is not started here
