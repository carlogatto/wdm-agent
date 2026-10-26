---
name: fse-build
description: Use to build autonomously, in WordPress, the next item whose kit is ready for a wdm-theme FSE project — the telaio first, then one page per session — "costruisci la pagina X", "monta la home in WP", "implementa il telaio", "prosegui con la build", or when a DESIGN.md row is `kit` and not yet implemented. Missing native blocks are created along the way. Not for wdm-starter projects (`dev-page-build`).
---

# FSE Build — kit → native blocks → WordPress page, autonomously

**MANDATORY first steps, in order:**
1. Read `${CLAUDE_PLUGIN_ROOT}/shared/fse-foundations.md` — all of it, in particular §0 (guard),
   §3 (block anatomy), §4 (parity), §5 (CSS/JS), §6 (build), §7 (telaio), §8 (WP-CLI), §9
   (Playwright), §10, §11 (DESIGN.md).
2. Read `DESIGN.md → ## Project Config` and apply the guard of Step 0 **before any other file**
   (`theme_family` row: `fse` → go on; any other value **or row missing** → stop).
3. Read the project `CLAUDE.md` and the rest of `DESIGN.md` (`## Telaio`, `## Pagine`,
   `## Navigazione`, `## Blocchi`, `## Domande aperte`).
4. Read the item's kit (`src/kit/{prefix}-{page}.kit`) **and** its compiled
   `html/{prefix}-{page}.html`, plus the `README.md` of every block it uses.

All paths are relative to `{theme-root}` from `DESIGN.md → Project Config`.

## Principle

**The kit is the single source of truth**: sequence of blocks, variant of each instance,
texts, images, links. If the kit phase was done well (README contract, kit per variant, page
kit with real content), there is nothing to ask: every question you feel like asking is a gap in
the kit or the README — report it at the end, do not ask in chat, unless it is one of the stop
conditions. One item per session; at the end the agent **stops** and waits for the dev's ok
(decision 14 of the plan).

## Inputs

| Input | Source |
|---|---|
| Item | the prompt names it; else the first row with state `kit` in this order: `## Telaio` (any row), then `## Pagine` in table order (parent pages before children) |
| Admin credentials | username = `DESIGN.md → Project Config → {agent-admin-user}`; password from the prompt, else **ask once** before the Playwright smoke test (needed only for that). Never written, never echoed |
| `{wp-cli}` | `DESIGN.md → Project Config → Paths`; put it in a scratchpad script for the session |
| Mode | `A` (default) fully autonomous · `B`: the dev asked for a stop before each new block scaffold |

## Step 0 — Guard and preconditions (all blocking)

1. `theme_family` = `fse` (fse-foundations §0); any other value **or row missing** (wdm-starter
   projects predate it) → STOP with the §0 message — wdm-starter project (`dev-page-build`).
   Nothing else is read after the stop.
2. State on disk vs DESIGN.md (§11): update the tables to what the disk says; report.
3. `Project Config` complete (`{prefix}`, paths, `{local-url}`, `{agent-admin-user}`, `{wp-cli}`).
4. `src/kit/{prefix}-{page}.kit` exists and `npm run build` exits 0 (regenerates
   `html/{prefix}-{page}.html`). `npm run dev` may stay on (the dev switches between kit and
   build work): its transient errors while the block files are written one by one are not
   failures — the truth is this run's own `npm run build` (exit 0) after the last file, and WP on
   `{local-url}`, not the kit on :8848. If `pgrep -f 'build.js --watch'` finds it, say so in the
   report ("watch acceso: build finale rieseguita da questo run").
5. Every block in the compiled page (`section.{prefix}-block-{slug}` inside `<main>`) has a
   `README.md` with `## Attributi` and `## Markup` — a block with neither → stop ("blocco senza
   contratto: serve fse-kit").
6. `{wp-cli} option get home` answers; the parent page (URL with a parent segment) exists in WP.
7. Opening line of the report: "item {X}: kit {N} blocchi, {M} da creare, in WP {K} già presenti".

## Step 1 — Telaio (when the item is the telaio)

1. Compare `html/{prefix}-home.html` header/footer with `parts/header.html` /
   `parts/footer.html`: structure (groups with the BEM `className`), content (logo: `site-logo`
   + `site-title {"level":0}` or only `site-logo` when a logo image exists → upload it with `wp
   media import` and `wp option update site_logo <id>`), social URLs, footer texts/contacts
   copied verbatim from the kit, `overlayMenu: mobile` + overlay colours from the palette.
   Edit the parts (read first, keep the `ref`). Templates only if the kit implies a different
   structure (never a `front-page.html` without a reason — §7).
2. Menu: run `fse-menu-build` (its script `plan` → `apply`) so `wp_navigation` = kit `<ul>` and
   `ref` is written in **both** parts.
3. `_telaio.scss` comes from the kit phase; `npm run build`.
4. Verify (§9): home + one inner page at 1440/768/390 → `scrollWidth === innerWidth`, header
   height from the tokens, sticky after `scrollTo({behavior:'instant'})` + transition wait,
   overlay opens/closes at 390, one h1 per view, `wp-admin/site-editor.php`: templates and parts
   without invalid blocks; `debug.log` empty. Screenshots `telaio-*.png`.
5. `DESIGN.md → Telaio`: `implementato`; Log decisioni; theme README "Differenze kit ↔ WP" if
   new ones appear. **Stop.**

## Step 2 — Page

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

### 2b. Missing blocks → scaffold (Step 3), all variants
For every distinct `slug` of K without `blocks/{prefix}-block-{slug}/block.json` → Step 3
(Mode B: stop and hand over first). An implemented block whose README lists a variant/attribute
the kit uses but the code lacks → `fse-block-edit` inline, additive only (new attribute with a
default, new variant); a non-additive change → stop condition.

### 2c. Build + smoke test
`npm run build` exit 0; the hook `check-block-contract.sh` silent; registry: `{wp-cli} eval
'…WP_Block_Type_Registry…'` lists every `{prefix}/{slug}` of K. For each block created in this
run: Playwright smoke test (§9, points 1–5) → zero console errors, saved content as expected,
frontend renders render.php. A failure here is fixed in this run (it is this run's code).

### 2d. Derived state — WordPress is the state
```bash
{wp-cli} post list --post_type=page --name={slug} --post_status=any --fields=ID,post_status,post_parent
{wp-cli} post get {ID} --field=post_content
```
Parse the top-level `<!-- wp:{prefix}/… -->` of the saved content (name + first text attribute
as fingerprint) and compare with K:
- page absent, or content empty → write the whole page (2e);
- WP blocks = a prefix of K (partial build) → keep the saved content byte for byte and append
  only the missing blocks (`post update` with saved content + new markup): an existing instance
  is never regenerated — the kit cannot carry everything WP holds (the `postId` of manual cards,
  attributes edited by hand);
- WP has blocks not in K, or in another order → **stop**: "pagina modificata a mano", show the
  diff (never delete or move the dev's blocks).
Idempotent: a complete page ends with "0 blocchi mancanti" without writing.
Progress line in `DESIGN.md → ## Domande aperte`: `⏳ pagina {Titolo} in costruzione: {M}/{N}
blocchi (dal YYYY-MM-DD)`, removed when the page passes 2g.

### 2e. Write the page (WP-CLI, the only write path)
Generate `{scratchpad}/page-{slug}.html` from K with the README `## Markup di inserimento` of
each block: `<!-- wp:{prefix}/{slug} {"attr":"value"} /-->`, children inside the parent,
core blocks with their HTML, `imageId` always with `imageUrl` (+ `imageAlt`), defaults omitted.
```bash
ID=$({wp-cli} post create {scratchpad}/page-{slug}.html --post_type=page --post_title="{Titolo}" --post_name={slug} --post_parent={parent-id} --post_status=publish --porcelain)
{wp-cli} post update $ID {scratchpad}/page-{slug}.html      # existing page
{wp-cli} post meta update $ID {prefix}_show_title 0   # only if K[0] is a hero variant image (the h1 is in the content); else leave the default 1
{wp-cli} post meta update $ID {prefix}_show_form 0    # only if the page content already has a {prefix}/form block (no double form); else leave the default 1
```
Page options (fse-foundations §7): the two meta are the kit's say on the template title and the
default form part; never ask, derive them from the kit and list them in the report.
Title from `DESIGN.md → Pagine`, slug = last URL segment, parent = page of the URL prefix.

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
`.playwright-mcp/shots/`. Every difference goes in the report with block and attribute.

### 2h. Documentation (no confirmation asked)
- `DESIGN.md → Pagine`: `implementata` only when 2g is green (else stays `kit` with the ⏳
  line); `## Blocchi`: `implementato` for the blocks created, variants; `## Log decisioni`: one
  row (blocks created, additive edits, images imported, discrepancies); `## Domande aperte`:
  gaps found (placeholders left, `#` links, README gaps).
- Each block created/edited: README completed where the kit revealed a gap; the theme README
  table of blocks (if the project keeps one) and project `CLAUDE.md → Existing Blocks`.
- `version` of edited blocks bumped.

### 2i. Final report and STOP
Blocks created (with variants) · additive edits · page id/permalink · images imported ·
placeholders and `#` links remaining · parity differences · screenshots · open questions ·
orphan menu items this page resolves: an orphan recorded by `fse-menu-build` Step 5 (`DESIGN.md
→ Navigazione` `orfane` > 0 / `## Domande aperte` line) whose label matches this page's title →
"orfane risolvibili → `fse-menu-build`"; none → "orfane risolvibili: nessuna". Never the
password. Close the browser tab.
**Do not start the next page**: new session.

## Step 3 — Block scaffold (from the README, every variant)

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
missing · a block of the kit without README/attribute table/markup · a block instance whose
markup cannot be mapped to the README (unknown element/modifier) · page in WP with blocks not
in the kit or out of order · parent page missing · post locked by another user · a non-additive
change needed on an implemented block (attribute rename/removal, structure change) ·
console errors in a block implemented outside this run · Mode B checkpoints ·
`fse-menu-build` diff waiting for the dev (exit 3: the telaio session ends at the diff).

## Never

`save()` with markup · rename or remove attributes of an implemented block · delete, reorder or
rewrite blocks the dev added · rewrite kit texts · touch header, footer, menus outside the
telaio session (menus: `fse-menu-build`) · write credentials anywhere · build two pages in one
session · git commands · `@use 'swiper/swiper'` in a block.

## Completion checklist

- [ ] Guard passed, state on disk verified, opening report line
- [ ] Missing blocks scaffolded with every README variant; build exit 0; hook silent; smoke test 0 console errors
- [ ] Derived state read from WP; page created/updated via WP-CLI from the generated markup; page options set (2e)
- [ ] Editor: 0 invalid blocks, not dirty; frontend 3 widths: no overflow, 1 h1, parity differences reported
- [ ] DESIGN.md (Pagine, Blocchi, ⏳ removed, Log, Domande aperte), READMEs, `version` bumps
- [ ] Final report delivered, tab closed, **stopped** for the dev's review
