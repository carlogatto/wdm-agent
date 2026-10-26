---
name: fse-kit
description: Use when designing in HTML, together with the dev, the telaio (header/footer), a page or a block with all its variants for a wdm-theme FSE project — "progettiamo il kit della pagina X", "disegna il blocco Y", "kit dell'header", "aggiungi la variante Z al blocco Y", or when a DESIGN.md row is `da progettare`. This is the dialogic design phase (kit + README contract + SCSS); WordPress code is written later by `fse-build`.
---

# FSE Kit — design in HTML: telaio, pages, blocks (dialogic phase)

**MANDATORY first steps, in order:**
1. Read `${CLAUDE_PLUGIN_ROOT}/shared/fse-foundations.md` — §0 (guard), §1 (phases), §2
   (structure), §3 (README contract, content pattern → attribute), §4 (kit = render.php),
   §5 (CSS/JS), §10, §11 (DESIGN.md).
2. Read `DESIGN.md → ## Project Config` and apply the guard of Step 0 **before any other file**
   (`theme_family` row: `fse` → go on; any other value **or row missing** → stop).
3. Read the project `CLAUDE.md` and the rest of `DESIGN.md` (`## Telaio`, `## Pagine`,
   `## Blocchi`, `## Domande aperte`).
4. For a block that already exists: its `README.md`, `kit/*.kit`, `src/style.scss`.

All paths are relative to `{theme-root}` from `DESIGN.md → Project Config`.

## Step 0 — Guard and state

`DESIGN.md → Project Config → theme_family` must be `fse` (fse-foundations §0); any other value
**or row missing** (wdm-starter projects predate it) → STOP with the §0 message (wdm-starter
project: `design-*`/`dev-*` skills). Nothing else is read after the stop. Then verify the state tables against the disk
(§11) and report discrepancies in the opening line. Set the item's row (Telaio/Pagine only: a
Blocchi row is born `kit` at 3g, §11) to `da progettare` → work in progress is visible through
the row itself; no ⏳ line is needed in this phase.

## Principle

This is the **only phase where asking is the job**: the dev designs, the agent proposes markup,
CSS and the block contract, and iterates in the browser (`npm run dev` →
`https://localhost:8848/html/`, never `file://`). Everything decided here is written down in
the kit files and the README so that `fse-build` runs **without questions**: an attribute, a
variant or a text that is not in the kit/README does not exist for the build. Kit markup = the
future `render.php` (§4), classes BEM, tokens from theme.json, no WordPress code.

## Step 1 — Which item

| The dev says | Item | Output |
|---|---|---|
| header, footer, menu, template, "telaio" | **Telaio** | `src/kit/main/header|footer/**`, `src/scss/_telaio.scss`, `src/kit/svg-vault` |
| "pagina X", "home", "la pagina servizi" | **Page** | `src/kit/{prefix}-{page}.kit` (+ new blocks inline) |
| "blocco Y", "variante Z di Y", "una sezione che…" | **Block** | `blocks/{prefix}-block-{slug}/README.md`, `kit/`, `src/style.scss` (+ `src/view.js`) |

A page that needs a block that does not exist → the block is designed inside the same session
(Step 3) before the page kit imports it. A new variant of an implemented block → Step 3 (README
row + kit + CSS); the editor side is `fse-block-edit`'s, run by `fse-build` when the page needs it.

## Step 2 — Telaio

1. `src/kit/main/header/header-parts/_header-content.kit` and
   `src/kit/main/footer/footer-parts/_footer-content.kit`: logo (text or `<img>`), `<nav
   aria-label="Menu principale"><ul>` with the real page labels (one `<li><a>` per item, nested
   `<ul>` for submenus — `fse-menu-build` reads exactly this), social `<ul>` with svg-vault
   icons, footer columns (`{prefix}-footer__col`: description, contacts, menu + social),
   `{prefix}-footer__bottom`.
2. Keep the **BEM classes** (`{prefix}-header`, `__inner|__logo|__nav|__social`,
   `{prefix}-footer`, `__inner|__columns|__col|__nav|__social|__bottom`, `{prefix}-main`): they
   are the `className` the parts give to the core blocks — the only bridge between kit and WP.
   New element → new BEM class, to be added to the part by the build.
3. `src/scss/_telaio.scss`: the shared CSS (sticky header with
   `--wp--custom--header-height--*`, nav, footer grid `repeat(auto-fill, minmax(min(16rem,
   100%), 1fr))`, gaps), knowing that the inner markup in WP is core's (`.wp-block-navigation`,
   `.wp-block-site-logo`, `.wp-block-social-links`): style the BEM wrappers, override core
   classes only where needed. Overlay threshold = `xl` (fse-foundations §7: isolated override of core's 600px; the kit drawer runs on the kit-only script of `_js-shared.kit` and shares the CSS with WP through the `drawer-panel` mixin).
4. Site data (address, phone, social URLs, form IDs) are **content** of the parts/patterns: put
   the real ones in the kit, the build copies them.
   Behaviours are kit-first too (fse-foundations §4): dropdown trigger, drawer, accordion,
   scrolled header live in the kit (theme JS in `main.js`, or kit-only scripts in
   `_js-shared.kit` for what core will do in WP) and `fse-build` reproduces them with the same
   trigger and classes; never leave an interaction "to be seen in WP".
5. `npm run dev` → check at 1440/768/390: no horizontal overflow, header heights from the tokens.
6. `DESIGN.md → Telaio`: `kit`. Differences expected between kit and WP (core markup) are not a
   problem: the theme README lists them.

## Step 3 — Block (new, or new variant)

**3a. Contract first** — write/update `blocks/{prefix}-block-{slug}/README.md` (fse-foundations
§3 "README") and agree it with the dev before any HTML:
- `## Scopo` (one paragraph), `## Varianti` (every visual/functional variant: attributes,
  modifier class, children, kit file), `## Attributi` (name camelCase, type, control, default,
  note — chosen with the "content pattern → attribute + control" table: text → RichText, image →
  `imageId`/`imageUrl`/`imageAlt`, link → LinkButton, choice → SelectControl + `variant`, on/off
  → ToggleControl, repeated → child block, content → PostPicker, list → query), `## Figli`,
  `## Markup (render.php = kit)`, `## Markup di inserimento`, `## Dipendenze JS / CSS`,
  `## Componenti condivisi`.
- Say which supports the block gets (`anchor`, `color.background/text`, `spacing.padding`):
  colours and padding of the section are **not** attributes.
- A repeater becomes a child block `{prefix}/{child}` with its own folder and README.

**3b. Kit per variant** — `kit/_{prefix}-block-{slug}-{variant}.kit`: the exact markup of the
future render.php (§4): `<section class="wp-block-{prefix}-{slug} alignfull {prefix}-block-{slug}
[{prefix}-block-{slug}--{variant}]">`, `<div class="{prefix}-block-{slug}__inner">`, BEM
elements that map 1:1 to the attributes (`__title` ↔ `title`, `__text` ↔ `text`,
`a.wp-element-button.__button` ↔ button*, `img.__img` ↔ image*), placeholder texts, images from
`../assets/img/placeholder-*.jpg` (check they exist), children repeated 3 times for carousels.
Core-block containers (columns-wrapper) hold plain `<h2>`/`<p>` markup.

**3c. CSS** — `src/style.scss`: `@use 'breakpoints' as *;`, `.{prefix}-block-{slug}` BEM,
`__inner` rule (`box-sizing: content-box; max-width: var(--wp--style--global--wide-size);
margin-inline: auto; padding-inline: var(--wp--preset--spacing--xs)`), every value from
`--wp--preset--*`/`--wp--custom--*`, `bp-up()` media queries, `clamp()`/grid/flex. No vertical
padding of the section (theme.json gives it). `build.js` compiles a folder with only
`src/style.scss` (no `block.json` yet) to `build/style-index.css` and watches it.

**3d. JS only if the design needs it to be seen** (a carousel): `src/view.js` as in
fse-foundations §5 (Swiper, Italian a11y, breakpoints from the CSS variables) — it is already
the final view.js; the kit loads it from `_js-shared.kit`. Anything else (dialog, toggles) waits
for the build.

**3e. Wire the kit** — `src/kit/main/header/header-parts/_css-shared.kit`: one
`<link rel="stylesheet" href="../blocks/{prefix}-block-{slug}/build/style-index.css">`;
`_js-shared.kit`: `<script type="module" src="../blocks/{prefix}-block-{slug}/build/view.js">`
if 3d; `src/kit/{prefix}-blocks.kit`: one `@import` per variant (the catalogue page is the
screenshot reference of the build) — and the `Catalogo blocchi` row of `DESIGN.md → Pagine`
goes back to `kit` with the new list (the build appends the new variants). A section block
also gets, until `fse-build` writes its `theme.json → styles.blocks` entry (WP emits that CSS
only for registered blocks), a kit-only rule in `_css-shared.kit`: `<style>/* kit-only:
fse-build la rimuove */ .wp-block-{prefix}-{slug} { padding-block:
var(--wp--preset--spacing--section-lg) }</style>`.

**3f. Check** — `npm run dev`, `/html/{prefix}-blocks.html` at 1440/768/390 (Playwright on
`https://localhost:8848`: context with `ignoreHTTPSErrors: true`, fse-foundations §9): no overflow,
tokens applied, carousel initialised; iterate with the dev.

**3g. State** — `DESIGN.md → Blocchi`: row `{prefix}/{slug}` `kit`, variants, children, origin
page; a new variant of an implemented block stays `implementato` with the new variant marked
"(kit)" until `fse-block-edit`/`fse-build` implements it.

## Step 4 — Page

1. `DESIGN.md → Pagine`: row with title, URL (parent included: `/servizi/fisioterapia`),
   `da progettare` → `kit` at the end.
2. `src/kit/{prefix}-{page}.kit`:
   ```html
   <!-- $title = Titolo pagina -->
   <!-- @import "main/header/_header.kit" -->

         <main class="{prefix}-main">
           <!-- @import "../../blocks/{prefix}-block-hero/kit/_{prefix}-block-hero-image.kit" -->
           <section class="wp-block-{prefix}-image-text alignfull {prefix}-block-image-text"> … real texts … </section>
         </main>

   <!-- @import "main/form/_form-contacts.kit" -->
   <!-- @import "main/footer/_footer.kit" -->
   ```
   Each block instance is either an `@import` of a variant kit (placeholder content, early
   iteration) or the **inlined markup of that variant with the real content** (copy of the kit
   file, texts/links/images replaced — structure and classes untouched). The compiled
   `html/{prefix}-{page}.html` is what `fse-build` reads: an instance's variant comes from its
   modifier class, its attribute values from the BEM elements. Texts real where known, otherwise
   `[da confermare]` placeholders (kept verbatim by the build and reported). A provisional value
   that is not text (a URL) gets a plausible value plus an adjacent comment `<!-- buttonUrl
   "/contatti/" [da confermare]: … -->` (a placeholder inside `href` is a broken link). Derived
   content (`cards-carousel` query, `card`): the kit inlines the real titles of the posts the
   query returns today (text parity); the build reads only the section's attributes, links `#`.
3. A page that opens with a hero variant image has its h1 there (the build sets
   `{prefix}_show_title 0`); a page without a hero keeps the template title (meta default 1).
   The default form part (`main/form/_form-contacts.kit`, fse-foundations §7) is shown on every
   page (meta default 1, as in wdm-starter); the build turns it off only on a page whose content
   already has a `{prefix}/form` block — so the page kit imports `main/form/_form-contacts.kit`
   after `</main>` unless its content has a `{prefix}/form`.
4. Blocks used by the page that do not exist → Step 3 first; blocks that exist but need a new
   variant → Step 3 (variant).
5. `npm run dev` → `/html/{prefix}-{page}.html` at 1440/768/390.
6. `DESIGN.md → Pagine`: `kit` + ordered block list (`hero (image), image-text (right), cta`);
   `## Blocchi`: new rows `kit` with origin = this page.

## Never

Write `block.json`, `render.php`, `edit.js`, `index.js`, `editor.scss` (build phase) · touch WP
(no WP-CLI writes, no editor) · hardcode colours/sizes instead of tokens · a kit whose markup
could not be produced by a `render.php` (one root `<section>`, no scripts, no `<style>`) ·
Bootstrap/utility classes · `@use 'swiper/swiper'` in a block (shared handle) · git commands.

## Completion checklist (per item)

- [ ] Guard passed, state on disk verified, row updated
- [ ] Block: README contract agreed (variants, attributes with control and default, children, markup, insertion markup) BEFORE the kit
- [ ] Kit per variant with parity markup; `src/style.scss` with tokens and `__inner`; `view.js` only if needed
- [ ] `_css-shared.kit` (+ `_js-shared.kit`) and `{prefix}-blocks.kit` updated
- [ ] Page kit with real content inlined (or `@import` placeholders, declared), checked at 3 widths via browser-sync
- [ ] `DESIGN.md` rows `kit`, open questions written, nothing left in chat only
