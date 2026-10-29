---
name: fse-build
description: Use to build the whole site in WordPress from the approved kits for a wdm-theme FSE project — every `kit`/`implementata` row of DESIGN.md (telaio, pages, menus) in one run, re-runnable: it applies only the kit ↔ WP difference — "costruisci il sito", "build del sito", "monta la home in WP", "riallinea WP ai kit", "prosegui con la build", or when a DESIGN.md row is `kit` and not yet implemented. Missing native blocks are created along the way. Not for wdm-starter projects (`dev-page-build`).
---

# FSE Build — approved kits → native blocks → the WordPress site, autonomously and re-runnable

**MANDATORY first steps, in order:**
1. Read `${CLAUDE_PLUGIN_ROOT}/shared/fse-foundations.md` — all of it, in particular §0 (guard),
   §1 (gates), §3 (block anatomy), §4 (parity), §5 (CSS/JS), §6 (build), §7 (telaio), §8 (WP-CLI),
   §9 (Playwright), §10 (hygiene and the decision charter), §11 (DESIGN.md).
2. Read `DESIGN.md → ## Project Config` and apply the guard of Step 0 **before any other file**
   (`theme_family` row: `fse` → go on; any other value **or row missing** → stop).
3. Read the project `CLAUDE.md` and the rest of `DESIGN.md` (`## Brief` if present, `## Telaio`,
   `## Pagine`, `## Navigazione`, `## Blocchi`, `## Domande aperte`).
4. Read `${CLAUDE_PLUGIN_ROOT}/skills/fse-menu-build/SKILL.md` (Step 1–5 run inline at Step 3).
5. For every page of the perimeter: its kit (`src/kit/{prefix}-{page}.kit`) **and** its compiled
   `html/{prefix}-{page}.html`, plus the `README.md` of every block it uses.

All paths are relative to `{theme-root}` from `DESIGN.md → Project Config`.

## Principle

**The kit is the source of the values, WordPress never loses anything without an ok.** The
build is the fourth gate of fse-foundations §1: one run builds the whole perimeter (telaio,
every approved page, menus) and ends with one report. It is **re-runnable**: every page goes
through the diff of `scripts/wp-page.php` and receives only its difference; a second identical
run answers "0 differenze" everywhere. Deletions (a block or a page the kit no longer has, a
menu whose content differs) are shown in the report and executed only with the dev's ok **in a
later turn** (`confirm`); they never stop the rest of the run. During the run the agent asks
nothing: it decides under the charter (§10) and reports gaps at the end. Gates 2 (telaio kit)
and 3 (one per page kit) are `fse-kit`'s: a row is `kit` only after the dev's ok there, and this
run builds only rows that passed them.

## Inputs

| Input | Source |
|---|---|
| Perimeter | the `## Telaio` rows at `kit` (an `implementato` telaio is aligned by definition; a kit-only row with no part or template is named in the report and left as is) and every row of `## Pagine` whose state is **not** `da progettare`: `kit` and `implementata` go through the diff (an aligned page answers "0 differenze"; a kit revised after the gate does not demote the row: the next run applies the difference), `da eliminare` enters as a deletion (2j). Parents before children. Rows `da progettare` are skipped and named in the report. The prompt may narrow the perimeter ("solo la Home") |
| Admin credentials | username = `DESIGN.md → Project Config → {agent-admin-user}`; password from the prompt, else **one** question at the start of the run, before any write. Without it the run goes on without Playwright (2c smoke test, 2g editor check skipped) and no page reaches `implementata` (it stays `kit`, report: "verifica editor mancante"). Never written, never echoed |
| `{wp-cli}` | `DESIGN.md → Project Config → Paths`; put it in a scratchpad script for the session |

## Step 0 — Guard and preconditions (all blocking)

1. `theme_family` = `fse` (fse-foundations §0); any other value **or row missing** (wdm-starter
   projects predate it) → STOP with the §0 message — wdm-starter project (`dev-page-build`).
   Nothing else is read after the stop.
2. State on disk vs DESIGN.md (§11): update the tables to what the disk says; report. `## Brief`
   missing → flag "brief assente" (never a stop).
3. `Project Config` complete (`{prefix}`, paths, `{local-url}`, `{agent-admin-user}`, `{wp-cli}`).
4. For every page of the perimeter `src/kit/{prefix}-{page}.kit` exists, and `npm run build`
   exits 0 (regenerates `html/`). `npm run dev` may stay on (the dev switches between kit and
   build work): its transient errors while the block files are written one by one are not
   failures — the truth is this run's own `npm run build` (exit 0) after the last file, and WP on
   `{local-url}`, not the kit on :8848. If `pgrep -f 'build.js --watch'` finds it, say so in the
   report ("watch acceso: build finale rieseguita da questo run").
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
   Templates only if the kit implies a different structure (never a `front-page.html` without a
   reason — §7). Menus are **not** touched here: Step 3.
2. `_telaio.scss` comes from the kit phase; `npm run build`.
3. Verify (§9): home + one inner page at 1440/768/390 → `scrollWidth === innerWidth`, header
   height from the tokens, fixed header after `scrollTo({behavior:'instant'})` + transition wait,
   overlay opens/closes at 390, one h1 per view, `wp-admin/site-editor.php`: templates and parts
   without invalid blocks; `debug.log` empty. Screenshots `telaio-*.png`.
4. `DESIGN.md → Telaio`: `implementato`; theme README "Differenze kit ↔ WP" if new ones appear.
   Go on with the pages.

## Step 2 — Pages (repeat 2a–2j for every page of the perimeter, in order; then Step 3)

Progress line in `DESIGN.md → ## Domande aperte`: `⏳ build sito: pagina {Titolo} {M}/{N} (dal
YYYY-MM-DD)`, updated per page, removed at Step 4.

### 2a. Target sequence from the compiled kit
Parse `html/{prefix}-{page}.html` → `<main>` → top-level `section` elements with a class
`{prefix}-block-{slug}`: `K[i] = { slug, variant, values }`:
- `variant` = modifier `{prefix}-block-{slug}--{x}` → the README `## Varianti` row → attributes;
- `values` = from the README `## Markup`: `.__title` → `title` (inner HTML, `<br>`/`<strong>`
  kept), `.__text` → `text`, `a.__button` → `buttonText` (text) / `buttonUrl` (href; `#` →
  `""`, reported) / `buttonNewTab` (`target="_blank"`), `img.__img` → image (basename of `src`
  → attachment: `{wp-cli} post list --post_type=attachment --name=<basename-without-ext>
  --field=ID`; absent → `{wp-cli} media import {theme-root}/assets/img/<file> --porcelain`; then
  `imageId` + `imageUrl` (`wp_get_attachment_url`) + `imageAlt` (alt)), `style="--{prefix}-x:N"`
  / `data-*` → the attribute the README maps; `id` on the section → `anchor`; colour classes
  `has-{slug}-background-color` → `backgroundColor`, `has-{slug}-color` → `textColor`; children (`.swiper-slide`, cards) → one
  child block each with the same mapping; a core-block container → `core/heading` (`level` from
  the tag) / `core/paragraph` per `<p>` (`content` verbatim), `textAlign` from
  `has-text-align-*`.
- Post-derived content (a `card` child with only `postType`/`postId`; a `cards-carousel` query
  variant): the kit card shows a title → resolve it to a **published** post with that title
  (case/entity-insensitive, then slug), `postType` from the post found; no match → `postId: 0`
  and report ("card senza contenuto: titolo X non trovato"). Query variant: `postType`/`count`
  from `data-post-type`/`data-count` on the section when the kit has them, else the README
  defaults. A `data-*`/`style` attribute the README does not map → stop condition (unknown).
- The README `## Attributi` "Note" column may name the kit selector explicitly (e.g. `kit:
  .__eyebrow`): it wins over the BEM naming convention above.
- A top-level element of `<main>` that is not a `{prefix}-block-*` section but carries the root
  class of a theme pattern (`{prefix}-{x}` ↔ `patterns/{prefix}-{x}.php`) → the pattern's block
  markup (core blocks) with the kit's texts and extra `className`s; any other unmapped top-level
  element → stop condition (never skipped).
- Texts verbatim (entities decoded), placeholders `[da confermare]` included. Never rewritten.
  An HTML comment `<!-- {attribute} "value" [da confermare]: … -->` next to an element marks that
  value (typically a URL) as provisional: use it and report it.

### 2b. Missing blocks → scaffold (Step 5), all variants
For every distinct `slug` of K without `blocks/{prefix}-block-{slug}/block.json` → Step 5. An
implemented block whose README lists a variant/attribute the kit uses but the code lacks →
`fse-block-edit` inline, additive only (new attribute with a default, new variant); a
non-additive change → stop condition.

### 2c. Build + smoke test
`npm run build` exit 0; the hook `check-block-contract.sh` silent; registry: `{wp-cli} eval
'…WP_Block_Type_Registry…'` lists every `{prefix}/{slug}` of K. For each block created in this
run: Playwright smoke test (§9, points 1–5) → zero console errors, saved content as expected,
frontend renders render.php. A failure here is fixed in this run (it is this run's code).

### 2d. Diff kit ↔ WP — `scripts/wp-page.php`
Generate `{scratchpad}/page-{slug}.html` from K with the README `## Markup di inserimento` of
each block: `<!-- wp:{prefix}/{slug} {"attr":"value"} /-->`, children inside the parent, core
blocks with their HTML, `imageId` always with `imageUrl` (+ `imageAlt`), defaults omitted. Ids
(images, posts, forms, pages) are resolved from WP, never invented: the file is deterministic.
```bash
{wp-cli} eval-file ${CLAUDE_PLUGIN_ROOT}/skills/fse-build/scripts/wp-page.php plan {scratchpad}/page-{slug}.html page={slug}
```
The script aligns the top-level blocks of the file (G) and of the page (W) by key (block name +
variant; `page=` accepts the ID, the URL path `servizi/fisioterapia` or the slug) and compares
normalized attributes, children included. Per block: `uguale` ·
`modificato` (the kit wins; before → after in the report) · `nuovo` · `spostato` (reordered,
nothing lost) · `da cancellare` (in WP, not in the kit: a block the kit dropped **or** one added
by hand). Exit **0** no differences · **1** differences without deletions · **2** error (`pagina
assente` → 2e creates it; `non è una pagina`) · **3** at least one deletion. A hand-edited
attribute is overwritten by the kit and **reported** (the dev who wants it puts it in the kit:
same rule as the menus). Keep the output: it is the page's section of the report.

### 2e. Write the difference (WP-CLI, the only write path)
```bash
ID=$({wp-cli} post create --post_type=page --post_title="{Titolo}" --post_name={slug} --post_parent={parent-id} --post_status=publish --porcelain)   # only when plan said "pagina assente"
{wp-cli} eval-file ${CLAUDE_PLUGIN_ROOT}/skills/fse-build/scripts/wp-page.php apply {scratchpad}/page-{slug}.html page=$ID   # the ID after a create; else the slug or the URL path
{wp-cli} post meta update $ID {prefix}_show_title 0   # only if K[0] is a hero variant image and the meta differs (the h1 is in the content); else leave the default 1
{wp-cli} post meta update $ID {prefix}_show_form 0    # only if the page content has a {prefix}/form block and the meta differs (no double form); else leave the default 1
```
`apply` keeps the `uguale` blocks of WP (re-serialized, same attributes), takes
`modificato`/`nuovo`/`spostato` from the file in
the kit's order, writes only when there is a difference (exit 1 `scritto`, exit 0 `0 differenze,
nessuna scrittura`). With deletions pending it **does not write** and exits 3: the page keeps its
state, the diff goes to the report as a question, the run continues with the next page;
`apply … confirm` runs only in a later turn, after the dev's answer. Title from `DESIGN.md →
Pagine`, slug = last URL segment, parent = page of the URL prefix. Page options (fse-foundations
§7) are the kit's say: derived, written only when different, listed in the report.

### 2f. Per-block frontend check
`curl -sk {permalink}`: no `Fatal|Warning:|Notice:`; one `.{prefix}-block-{slug}` per K[i] in
order, modifier classes as derived, first text of each block = kit (normalized: whitespace,
`wptexturize` quotes/ellipsis/dashes, entities).

### 2g. Page parity + QA (Playwright, §9 "Per page")
Editor: the page opens with 0 invalid / 0 `core/missing` blocks, `isEditedPostDirty() === false`,
block count = N. Frontend at 1440/768/390: `scrollWidth === innerWidth`, exactly one h1,
`swiper-initialized` where expected, every in-page anchor target exists. Parity vs
`html/{prefix}-{page}.html`: per section (top-level of `<main>` plus the default form part after it), class set —
order free: WP and the kit print the same classes in a different order — minus the runtime
classes WP/Swiper generate (`swiper-*`, `wp-container-*`, `is-layout-*`, `has-global-padding`),
element count per tag (modulo a repeated series), normalized text, links (except the
permalinks of post-derived cards). Screenshots editor + frontend ×3 in
`.playwright-mcp/shots/`. Every difference goes in the report with block and attribute. Without
the password: frontend checks via `curl` only, editor check reported as missing.

### 2h. Documentation (no confirmation asked)
- `DESIGN.md → Pagine`: `implementata` only when 2g is green (else stays `kit`, with the reason
  in the report); `## Blocchi`: `implementato` for the blocks created, variants.
- Each block created/edited: README completed where the kit revealed a gap; the theme README
  table of blocks (if the project keeps one) and project `CLAUDE.md → Existing Blocks`.
- `version` of edited blocks bumped.

### 2j. Pages `da eliminare` and pages outside the flow
A row `da eliminare` (the map dropped the page; row and kit still there) → in the report as a
deletion: "pagina {Titolo} (id N) da cancellare: `confirm`?". Only with the dev's ok in a later
turn: `{wp-cli} post delete {ID} --force`, delete `src/kit/{prefix}-{page}.kit` (and its
`@import`s in the catalogue kit), remove the row, log. Menu items pointing to it become orphans
of `fse-menu-build` (Step 3). A page in WP without a row in `## Pagine` (e.g. "Pagina di
esempio", "Privacy Policy") is never touched: one line in the report, "fuori dal flusso".

## Step 3 — Menus (`fse-menu-build` inline)

After the pages exist: `fse-menu-build` Step 1–5 with its script (`dump` → `plan` → `apply`),
exactly as written there. `apply` exit 3 (an existing menu differs from the kit) → the diff enters
the final report as a question; `apply … confirm` runs only in a later turn, after the dev's
answer — the run does not stop for it. `DESIGN.md → ## Navigazione` is written by its Step 5.

## Step 4 — Final report and STOP (gate 4)

Per page: id, permalink, blocks created (with variants), additive edits, the `wp-page.php`
outcome (`uguale`/`modificato`/`nuovo`/`spostato` counts, deletions waiting for `confirm` with
their diff), hand-edited attributes overwritten, images imported, `[da confermare]` and `#` links
remaining, parity differences, page options set, screenshots. Menus: per menu created / updated /
0 differenze / diff waiting, orphans. Pages skipped (`da progettare`), pages `da eliminare`
waiting, pages outside the flow. `DESIGN.md`: `## Log decisioni` one row for the run, `⏳ build
sito` line removed, `## Domande aperte` with the gaps and the pending `confirm`s. Never the
password. Close the browser tab. The next run starts from zero and finds the aligned pages at 0
differenze: there is no progress state to resume. **Stop** and wait for the dev.

## Step 5 — Block scaffold (from the README, every variant)

Produce `blocks/{prefix}-block-{slug}/` exactly as fse-foundations §3, using the reference
blocks of the theme (`image-text` for RichText/image/LinkButton/toggle, `hero` + `hero-slide`
for InnerBlocks + context + variant select + Swiper, `cards-carousel` + `card` for post-picker,
query and ServerSideRender, `columns-wrapper` for free InnerBlocks) as templates to adapt — read
them, do not reinvent.
Write `block.json` **last** (after `render.php`, `src/`, README): `check-block-contract.sh`
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
   section blocks (read theme.json, add the entry). The hook `check-design-tokens.sh` will
   report the tokens as stale: this entry is **pre-authorised** by the README contract
   (fse-foundations §12) — do not ask, run
   `node ${CLAUDE_PLUGIN_ROOT}/shared/scripts/sync-theme-json-tokens.js {theme-root}`
   (DESIGN.md tokens + `wp-global-styles.css`) and log the entry in `## Log decisioni`. Then remove this block's
   kit-only padding rule from `_css-shared.kit` (fse-kit 3e), now emitted by theme.json.
6. Children: their own folder with the same steps.
7. `npm run build` → exit 0; `build/` has `index.asset.php`; hook silent; registry lists the
   block; smoke test (2c). README: add `## Markup di inserimento` if missing (and note the gap).
8. `DESIGN.md → Blocchi` row `implementato`.

## Stop conditions (the only ones)

Guard fails · `npm run build` fails on code not written in this run · kit or compiled html
missing for a row of the perimeter · a block of the kit without README/attribute table/markup · a
block instance whose markup cannot be mapped to the README (unknown element/modifier) · parent
page missing and not in the perimeter · post locked by another user · a non-additive change
needed on an implemented block (attribute rename/removal, structure change) · console errors in
a block implemented outside this run. **Deletions and menu diffs do not stop the run**: they
close it with the questions in the report, and `confirm` runs in a later turn.

## Never

`save()` with markup · rename or remove attributes of an implemented block · delete a block, a
page or a `wp_navigation` without `confirm` in a later turn · ask during the run (the charter
decides, the report collects) · rewrite kit texts · write credentials anywhere · write through
the Site Editor, Playwright or SQL (`wp-page.php` and `wp-navigation.php` are the write paths) ·
git commands · `@use 'swiper/swiper'` in a block.

## Completion checklist

- [ ] Guard passed, state on disk verified, perimeter and opening line reported
- [ ] Missing blocks scaffolded with every README variant; build exit 0; hook silent; smoke test 0 console errors
- [ ] Every page of the perimeter through `wp-page.php plan` → `apply`; deletions left to `confirm`; page options derived
- [ ] Editor: 0 invalid blocks, not dirty; frontend 3 widths: no overflow, 1 h1, parity differences reported
- [ ] Menus through `fse-menu-build` inline; diffs waiting in the report
- [ ] DESIGN.md (Pagine, Blocchi, Navigazione, ⏳ removed, Log, Domande aperte), READMEs, `version` bumps
- [ ] Final report delivered, tab closed, **stopped** for the dev's review
