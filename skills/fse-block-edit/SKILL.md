---
name: fse-block-edit
description: Use when modifying an implemented native block for a wdm-theme FSE project — "modifica il blocco X", "aggiungi un attributo/opzione al blocco X", "nuova variante di X", "cambia lo stile/layout di X", "aggiungi il JS a X" — on a block that already has block.json, render.php and edit.js. Blocks still at `kit` state are built by `fse-build`; the kit/README of a new variant is designed with `fse-kit`.
---

# FSE Block Edit — modify an implemented block, additively

**MANDATORY first steps, in order:**
1. Read `${CLAUDE_PLUGIN_ROOT}/shared/fse-foundations.md` — §0 (guard), §3 (anatomy, README
   contract), §4 (parity), §5 (CSS/JS), §6 (build), §9 (Playwright), §10.
2. Read `DESIGN.md → ## Project Config` and apply the guard of Step 0 **before any other file**
   (`theme_family` row: `fse` → go on; any other value **or row missing** → stop).
3. Read the project `CLAUDE.md` and `DESIGN.md → ## Blocchi`.
4. Read the block as it is: `README.md`, `block.json`, `render.php`, `src/index.js`,
   `src/edit.js`, `src/style.scss`, `src/editor.scss`, `src/view.js`, `kit/*.kit`, and the
   `theme.json → styles.blocks["{prefix}/{slug}"]` entry.

All paths are relative to `{theme-root}` from `DESIGN.md → Project Config`.

## Step 0 — Guard and current state

`theme_family` = `fse` (fse-foundations §0); any other value **or row missing** → STOP with the
§0 message (wdm-starter: `dev-block-edit`). Nothing else is read after the stop. The
block must be `implementato` (`blocks/{prefix}-block-{slug}/build/index.asset.php` exists);
otherwise stop and route: no folder → `fse-kit`; kit without code → `fse-build`. Find where the
block is used: `{wp-cli} post list --post_type=page --post_status=any --fields=ID,post_title
--s='wp:{prefix}/{slug}'` — these pages are the regression set.

## The rule — saved content carries the old names

Blocks are dynamic (render.php): there is no `save()` markup to deprecate, so a change never
invalidates a page. But the attributes **saved in post_content keep their names and values**:
- **never rename or remove an attribute**; a new attribute gets a `default` that reproduces the
  current output, so every existing instance renders unchanged;
- a new variant is a new `enum` value (the existing one stays the default);
- a removed element in render.php disappears from every page: say so in the report;
- `version` in `block.json` is bumped at every edit that touches CSS/JS (cache-busting).

## Step 1 — Classify the change

| Change | Scenario | Touches |
|---|---|---|
| new attribute / control (text, image, toggle, select, number) | **A** | block.json, README, edit.js, render.php, kit (if visible), style |
| new variant | **B** | README row, kit file, block.json enum, edit.js select, render.php modifier, style, `{prefix}-blocks.kit` |
| markup/layout change of an existing element | **C** | kit (first), render.php, edit.js (parity), style, README markup |
| style only | **D** | style.scss / editor.scss (+ theme.json styles.blocks for section padding) |
| frontend JS (first JS, or a change) | **E** | src/view.js, block.json `viewScriptModule`, README dependencies |
| new child block / child attribute | **F** | child folder (A–D on it), parent `allowedBlocks`/template, context |

Several scenarios → handle in order A → B → C → D → E → F. The kit is edited **before**
render.php in B and C (kit = render.php, §4): a markup change not reflected in the kit breaks
the parity rule and the next `fse-build` of a page would read a stale design.

## Step 2 — Apply

**A. New attribute**: `block.json → attributes` (type, default), README `## Attributi` row
(control, default, note), `## Markup di inserimento` example if it is a common attribute;
`edit.js` control following the content-pattern table (RichText / MediaPlaceholder +
MediaReplaceFlow / LinkButton / SelectControl / ToggleControl / RangeControl in
`InspectorControls`); `render.php` output with escaping and omission when empty; kit updated
only if the element is visible by default.

**B. New variant**: README `## Varianti` row + kit file `kit/_{prefix}-block-{slug}-{variant}.kit`
(from `fse-kit` if the dev wants to design it first; else write it now with the dev's
indications) + `src/kit/{prefix}-blocks.kit` import; `block.json` enum; `edit.js` select option
(Italian label) and class; `render.php` modifier class; `style.scss` rules under
`&--{variant}`; a variant that changes the children (e.g. single ↔ many) follows the hero
pattern (`replaceInnerBlocks` + `help` warning, documented).

**C. Layout/markup**: edit the kit file(s) first and check in the browser (`npm run dev` →
`/html/{prefix}-blocks.html`); then render.php and edit.js to the same structure; README
`## Markup`; style.

**D. Style**: `src/style.scss` (frontend + editor) or `src/editor.scss` (editor only); default
section padding → `theme.json → styles.blocks["{prefix}/{slug}"]` then
`node ${CLAUDE_PLUGIN_ROOT}/shared/scripts/sync-theme-json-tokens.js {theme-root}`; tokens only (§5).

**E. JS**: `src/view.js` per §5 (vanilla → Interactivity API → Swiper); `block.json`
`"viewScriptModule": "file:./build/view.js"` (+ `"style": ["{prefix}-swiper", …]` and
`supports.interactivity` when relevant); `_js-shared.kit` link for the kit; README `## Dipendenze
JS / CSS`; a shared module → `src/js/view/` + the build.js watch rule (§5).

**F. Child**: own folder with the full anatomy (`parent`, `usesContext`, `supports.html false,
reusable false`), parent `allowedBlocks`/`template`, `providesContext` if the child needs the
parent's state; README of both.

## Step 3 — Build, hook, verify

1. `npm run build` → exit 0; `check-block-contract.sh` silent on the `block.json` write.
2. Smoke test of the **changed behaviour** (fse-foundations §9): insert the block with the new
   attribute/variant, `updateBlockAttributes`, save not dirty, frontend renders it; 0 console
   errors.
3. **Regression**: one existing instance (from Step 0) — `{wp-cli} post get <id>
   --field=post_content` unchanged; its frontend before/after renders the same (text, classes,
   screenshot) and the editor opens it with 0 invalid blocks and not dirty.
4. Kit parity: `html/{prefix}-blocks.html` shows the new variant/element exactly like the
   frontend (browser-sync, 1440/768/390).
5. `debug.log` empty; test pages deleted.

## Step 4 — Documentation (no confirmation asked)

README (attributes, variants, markup, insertion, dependencies, "Istanze reali" if the project
keeps them) · `block.json → version` bumped · `DESIGN.md → Blocchi` (variants) and `## Log
decisioni` (one row: block, scenario, attributes/variants added, pages affected) · project
`CLAUDE.md → Existing Blocks` if it lists variants.

## Stop conditions

Guard fails · the request needs an attribute rename/removal or a type change (explain the rule,
propose the additive path: new attribute + render fallback) · the block is not implemented · the
change contradicts the kit and the dev has not approved the new design · `npm run build` fails on
pre-existing code · a page with the block is locked by another user.

## Never

Rename/remove attributes · edit `build/` by hand · `save()` with markup · change render.php
without the kit · hardcoded colours/sizes · `@use 'swiper/swiper'` in the block · touch other
blocks' files (shared components in `src/js/editor/` only additively) · git commands.

## Completion checklist

- [ ] Guard, block implemented, usage list collected
- [ ] Scenario(s) identified and applied in order; kit before render.php for B/C
- [ ] block.json additive (new attribute with safe default / new enum value), `version` bumped
- [ ] Build exit 0, hook silent, smoke test of the change, regression on an existing instance, parity in `/html/`
- [ ] README, DESIGN.md (Blocchi, Log decisioni), CLAUDE.md updated; report with affected pages
