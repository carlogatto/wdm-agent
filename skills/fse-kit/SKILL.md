---
name: fse-kit
description: Use to design in HTML, autonomously, the telaio (header/footer) or one complete page with its blocks and variants for a wdm-theme FSE project — "progettiamo il kit della pagina X", "disegna il blocco Y", "kit del telaio", "aggiungi la variante Z al blocco Y", or when a DESIGN.md row is `da progettare`. One item per session, one review at the end (kit + README contract + SCSS); WordPress code is written later by `fse-build`.
---

# FSE Kit — design in HTML: telaio, pages, blocks (one item, one review)

**MANDATORY first steps, in order:**
1. Read `${CLAUDE_PLUGIN_ROOT}/shared/fse-foundations.md` — §0 (guard), §1 (gates), §2
   (structure), §3 (README contract, content pattern → attribute), §4 (kit = render.php),
   §5 (CSS/JS), §10 (hygiene and the decision charter), §11 (DESIGN.md).
2. Read `DESIGN.md → ## Project Config` and apply the guard of Step 0 **before any other file**
   (`theme_family` row: `fse` → go on; any other value **or row missing** → stop).
3. Read the project `CLAUDE.md` and the rest of `DESIGN.md` (`## Brief` if present: map, tone,
   plugins, images; `## Telaio`, `## Pagine`, `## Blocchi`, `## Domande aperte`).
4. For a block that already exists: its `README.md`, `kit/*.kit`, `src/style.scss`.

All paths are relative to `{theme-root}` from `DESIGN.md → Project Config`.

## Step 0 — Guard and state

`DESIGN.md → Project Config → theme_family` must be `fse` (fse-foundations §0); any other value
**or row missing** (wdm-starter projects predate it) → STOP with the §0 message (wdm-starter
project: `design-*`/`dev-*` skills). Nothing else is read after the stop. Then verify the state
tables against the disk (§11) and report discrepancies in the opening line; `## Brief` missing →
flag "brief assente: tono e mappa da DESIGN.md e dai kit esistenti" (never a stop). The item's
row (Telaio/Pagine only: a Blocchi row is born `kit` at 3g, §11) stays `da progettare` until the
dev's ok (Review, below).

## Principle

**The kit is the real design, made by the agent.** It is designed inside the system (telaio,
existing blocks, tokens of theme.json) and inside the brief (map, tone, sources, images); the
block README is the contract `fse-build` will read without questions. One item per session —
the telaio, or one complete page with every block and variant it needs — and **one review at
the end** (gate 2 or 3 of fse-foundations §1). Decisions follow the charter (§10): texts, layout
in the system, ids, verifiable numbers are decided and logged; facts about the client, external
URLs, legal texts, missing images get a default plus `[da confermare]`; nothing is asked
mid-way. Kit markup = the future `render.php` (§4), BEM classes, tokens from theme.json, no
WordPress code. No feasibility constraint on the design: `render.php` prints any HTML; what
remains is anatomy — one root `<section>` per block, no inline `<script>`/`<style>` (JS in
`view.js`, CSS in `style.scss`), Formidable the only parity exception.

## Step 1 — Which item

| The dev says | Item | Output |
|---|---|---|
| header, footer, menu, template, "telaio" | **Telaio** | `src/kit/main/header|footer|form/**`, `src/scss/_telaio.scss`, `src/kit/svg-vault` |
| "pagina X", "home", "la pagina servizi" | **Page** | `src/kit/{prefix}-{page}.kit` (+ new blocks inline) |
| "blocco Y", "variante Z di Y", "una sezione che…" | **Block** | `blocks/{prefix}-block-{slug}/README.md`, `kit/`, `src/style.scss` (+ `src/view.js`) |

No item named → the telaio if its rows are `da progettare`, else the first page `da progettare`
in the order of `## Brief → Mappa` (or of `## Pagine`). A page that needs a block that does not
exist → the block is designed inside the same session (Step 3) before the page kit imports it. A
new variant of an implemented block → Step 3 (README row + kit + CSS); the editor side is
`fse-block-edit`'s, run by `fse-build` when the page needs it. A page the dev removes from the
map → its row goes `da eliminare` (kit and row stay until `fse-build` deletes it with `confirm`).

## Step 2 — Telaio

1. `src/kit/main/header/header-parts/_header-content.kit` and
   `src/kit/main/footer/footer-parts/_footer-content.kit`: logo (text or `<img>`), `<nav
   aria-label="Menu principale"><ul>` with the real page labels of the map (one `<li><a>` per
   item, nested `<ul>` for submenus — `fse-menu-build` reads exactly this), social `<ul>` with
   svg-vault icons, footer columns (`{prefix}-footer__col`: description, contacts, menu + social),
   `{prefix}-footer__bottom`.
2. Keep the **BEM classes** (`{prefix}-header`, `__inner|__logo|__nav|__social`,
   `{prefix}-footer`, `__inner|__columns|__col|__nav|__social|__bottom`, `{prefix}-main`): they
   are the `className` the parts give to the core blocks — the only bridge between kit and WP.
   New element → new BEM class, to be added to the part by the build.
3. `src/scss/_telaio.scss`: the shared CSS (fixed header with
   `--wp--custom--header-height--*`, nav, footer grid `repeat(auto-fill, minmax(min(16rem,
   100%), 1fr))`, gaps), knowing that the inner markup in WP is core's (`.wp-block-navigation`,
   `.wp-block-site-logo`, `.wp-block-social-links`): style the BEM wrappers, override core
   classes only where needed. Overlay threshold = `xl` (fse-foundations §7: isolated override of core's 600px; the kit drawer runs on the kit-only script of `_js-shared.kit` and shares the CSS with WP through the `drawer-panel` mixin).
4. Site data (address, phone, social URLs, form IDs) are **content** of the parts/patterns: the
   real ones from the brief go in the kit, the build copies them; missing ones → `[da
   confermare]` (text) or default + comment (URL), charter §10.
   Behaviours are kit-first too (fse-foundations §4): dropdown trigger, drawer, accordion,
   scrolled header live in the kit (theme JS in `main.js`, or kit-only scripts in
   `_js-shared.kit` for what core will do in WP) and `fse-build` reproduces them with the same
   trigger and classes; never leave an interaction "to be seen in WP".
5. `npm run dev` → check at 1440/768/390 with Playwright (fse-foundations §9): no horizontal
   overflow, header heights from the tokens, drawer and dropdown working; screenshots
   `.playwright-mcp/shots/kit-telaio-{w}.png`.
6. Review (below). Differences expected between kit and WP (core markup) are not a problem: the
   theme README lists them.

## Step 3 — Block (new, or new variant)

**3a. Contract first** — write/update `blocks/{prefix}-block-{slug}/README.md` (fse-foundations
§3 "README") before any HTML; it is part of the deliverable the dev reviews with the page:
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
tokens applied, carousel initialised; fix and re-check until clean; screenshots
`.playwright-mcp/shots/kit-{slug}-{w}.png`.

**3g. State** — `DESIGN.md → Blocchi`: row `{prefix}/{slug}` `kit`, variants, children, origin
page; a new variant of an implemented block stays `implementato` with the new variant marked
"(kit)" until `fse-block-edit`/`fse-build` implements it.

## Step 4 — Page

1. `DESIGN.md → Pagine`: row with title, URL (parent included: `/servizi/fisioterapia`), from
   the map; `da progettare` until the review's ok.
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
   modifier class, its attribute values from the BEM elements. **Texts**: from the brief verbatim
   when the brief gives them (spelling corrected), written by the agent in the brief's tone when
   it gives notes, `[da confermare]` worded as the question for the facts the brief lacks (charter
   §10). `[da confermare]` never inside an `href`, a `src` or a number: a plausible value plus an
   adjacent comment `<!-- buttonUrl "/contatti/" [da confermare]: … -->` (a placeholder inside
   `href` is a broken link). Images from `assets/img/` (the brief's, listed in `## Brief →
   Immagini`); missing → placeholder + `[da confermare]`. Without a brief: texts by the agent in
   the tone the existing kits already use. Derived content (`cards-carousel` query, `card`): the
   kit inlines the real titles of the posts the query returns today (text parity); the build
   reads only the section's attributes, links `#`.
3. A page that opens with a hero variant image has its h1 there (the build sets
   `{prefix}_show_title 0`); a page without a hero keeps the template title (meta default 1).
   The default form part (`main/form/_form-contacts.kit`, fse-foundations §7) is shown on every
   page (meta default 1, as in wdm-starter); the build turns it off only on a page whose content
   already has a `{prefix}/form` block — so the page kit imports `main/form/_form-contacts.kit`
   after `</main>` unless its content has a `{prefix}/form`.
4. Blocks used by the page that do not exist → Step 3 first; blocks that exist but need a new
   variant → Step 3 (variant).
5. `npm run dev` → `/html/{prefix}-{page}.html` at 1440/768/390 with Playwright; fix until clean;
   screenshots `.playwright-mcp/shots/kit-{page}-{w}.png`.
6. `DESIGN.md → Pagine`: ordered block list (`hero (image), image-text (right), cta`) in the
   row, state still `da progettare`; `## Blocchi`: new rows `kit` with origin = this page.
   Then the Review.

## Review (the gate)

The last message of the session hands over the item (gate 2 for the telaio, gate 3 for a page):
URL on `https://localhost:8848/html/…`, the screenshots, the blocks and variants created with
their README contract, the decisions taken (one `## Log decisioni` row with the non-obvious ones
and why), the **table of `[da confermare]`** with the default chosen for each ("Niente da
confermare" when empty). `DESIGN.md → ## Domande aperte` gets `⏳ kit {item} in revisione (dal
YYYY-MM-DD)`; the row stays `da progettare`. Then the turn ends.

Later turns: the dev's remarks are their decisions — apply them (same files), log them as
"richiesta del dev", hand over again. The dev's explicit ok → row `kit` (Telaio: `kit`;
Blocchi rows were born `kit` at 3g), ⏳ removed, log row "kit {item} approvato". A revision the
dev asks after the site build (gate 4) follows the same steps without a new gate: the row stays
`kit`, `fse-build` re-applies the difference at its next run.

## Never

Write `block.json`, `render.php`, `edit.js`, `index.js`, `editor.scss` (build phase) · touch WP
(no WP-CLI writes, no editor) · hardcode colours/sizes instead of tokens · a kit with more than
one root `<section>` per block, or with inline `<script>`/`<style>` · Bootstrap/utility classes
· `@use 'swiper/swiper'` in a block (shared handle) · ask mid-way what the charter decides or
marks `[da confermare]` · invent a fact about the client · mark a row `kit` before the dev's ok ·
git commands.

## Completion checklist (per item)

- [ ] Guard passed, state on disk verified, brief read (or "brief assente" flagged)
- [ ] Block: README contract written (variants, attributes with control and default, children, markup, insertion markup) BEFORE the kit
- [ ] Kit per variant with parity markup; `src/style.scss` with tokens and `__inner`; `view.js` only if needed
- [ ] `_css-shared.kit` (+ `_js-shared.kit`) and `{prefix}-blocks.kit` updated
- [ ] Page kit with real content inlined (texts from the brief or in its tone, `[da confermare]` for facts), checked at 3 widths with screenshots
- [ ] Review delivered: URL, screenshots, contracts, decisions, `[da confermare]` table; ⏳ `kit {item} in revisione` written; row still `da progettare`
- [ ] On the dev's ok (later turn): row `kit`, ⏳ removed, log row
