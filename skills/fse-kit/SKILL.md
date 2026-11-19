---
name: fse-kit
description: 'Use to design in HTML, autonomously, the telaio (header/footer) or one complete page with every block and variant it needs for a wdm-theme FSE project — "progettiamo il kit della pagina X", "kit del telaio", "nuova variante Z del blocco Y" (designed inside the page that needs it), or when a DESIGN.md row is `da progettare`. One page, one review at the end (kit + README contracts + SCSS); on the dev''s ok the skill runs `fse-build` in the same conversation. Blocks and variants are never designed on their own: they are born inside the page that needs them.'
---

# FSE Kit — design in HTML: telaio or one page with its blocks (one item, one review, then the build)

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

`DESIGN.md → Project Config → theme_family` must be `fse` (fse-foundations §0); any other value,
row missing or `DESIGN.md` missing → STOP with the §0 message for that case. Nothing else is read after the stop. Then verify the state
tables against the disk (§11) and report discrepancies in the opening line; `## Brief` missing →
flag "brief assente: tono e mappa da DESIGN.md e dai kit esistenti" (never a stop). The item's
row (Telaio/Pagine only: a Blocchi row is born `kit` at 3g, §11) stays `da progettare` until the
dev's ok (Review, below).

## Principle

**The kit is the real design, made by the agent.** It is designed inside the system (telaio,
tokens of theme.json — the existing blocks are its palette, never its boundary, §4) and inside
the brief (map, tone, sources, images); the block README is the contract `fse-build` will read
without questions. One item per gate —
the telaio, or one complete page with every block and variant it needs, however many — and **one
review at the end** (gate 2 or 3 of fse-foundations §1): the dev looks at the design of the whole
page, never at one block at a time. On the ok the skill goes on with `fse-build` in the same
conversation (§1 "The ok continues"). Decisions follow the charter (§10): texts, layout
in the system, ids, verifiable numbers are decided and logged; facts about the client, external
URLs, legal texts, missing images get a default plus `[da confermare]`; nothing is asked
mid-way. Kit markup = the future `render.php` (§4), BEM classes, tokens from theme.json, no
WordPress code. No feasibility constraint on the design: `render.php` prints any HTML; what
remains is anatomy — one root `<section>` per block, no inline `<script>`/`<style>` (JS in
`view.js`, CSS in `style.scss`), Formidable the only parity exception. **No catalogue constraint**
either (§4): every section is designed first for its content and the brief's tone, as a designer
would in free HTML, and only then mapped — an existing variant that renders it as designed is
imported, anything else is born as a new variant or a new block in Step 3. A page with zero new
blocks is not a goal: the design decides how many blocks the page needs, not the catalogue.

## Step 1 — Which item

| The dev says | Item | Output |
|---|---|---|
| header, footer, menu, template, "telaio" | **Telaio** | `src/kit/main/header|footer|form/**`, `src/scss/_telaio.scss`, `src/kit/svg-vault` |
| "pagina X", "home", "la pagina servizi" | **Page** | `src/kit/{prefix}-{page}.kit` (+ new blocks inline) |
| "variante Z di Y", "nuova variante di Y" | **Page** (the one that needs the variant) | the variant is Step 3 inside that page's kit and is reviewed with the page; `fse-block-edit` implements it at the build |

A **new block or a new variant is never an item**: "disegna il blocco Y", "una sezione che…",
"aggiungi una variante a Y" → ask which page needs it and design that page (fse-foundations §1
"Blocks are born inside pages"); the block or variant is Step 3 inside the page's session and
the dev reviews it in the page. This is the only road to a new variant: `fse-block-edit` does
not design one, it implements the one that already has its README row and kit.

**A kit already under review comes first.** A `⏳ kit {item} in revisione` line in `## Domande
aperte` whose kit is on disk means that item is waiting for the dev's ok (one gate open at a
time, §10). Whatever the request, **hand it over again** (the Review below: same URL,
screenshots, `[da confermare]` table) and never redesign it: remarks in the dev's message are
revisions of that item; if the dev names another item, say in one line that {item} is waiting
for the ok and do not start the other.

No such line and no item named → the telaio if its rows are `da progettare`, else the first
page `da progettare` in the order of `## Brief → Mappa` (or of `## Pagine`). A page that needs a block that does not exist → Step 3 before the
page kit imports it; a block that exists but needs a new variant → Step 3 (README row + kit +
CSS); the editor side is `fse-block-edit`'s, run by `fse-build` when the page needs it. A page
the dev removes from the map → its row goes `da eliminare` (kit and row stay until `fse-build`
deletes it with `confirm`).

**Demo kits of the base theme.** A page kit this project never handed over —
`src/kit/{prefix}-{page}.kit` on disk while the page has no row in `## Pagine`, or has a row
`da progettare` with no `⏳ kit … in revisione` line — is a residue of wdm-theme's demo pages,
not work to complete (`{prefix}-telaio.kit` and `{prefix}-blocks.kit` are the telaio and the
catalogue, never residues). When the map has that page, write its kit anew and replace the file (the
"read and complete, never overwrite" rule does not apply to a residue). A residue whose page is
not in the map stays where it is: never imported, never built, never given a row.

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
5. The telaio is looked at on `html/{prefix}-telaio.html`: the kit page that puts header,
   default form and footer around the samples of the base theme (a sentence of those samples
   that the redesign makes false is corrected there). `npm run dev` → the model `pw-kit.js`
   (fse-foundations §9, `nome=kit-telaio`) at 1440/768/390: no horizontal overflow, fonts, no
   console error; in a copy of the model, what only a telaio has: header heights from the
   tokens, the header after scrolling, the drawer open and closed, the dropdown when the menu
   has one. Screenshots `.playwright-mcp/shots/kit-telaio-{w}.png`.
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

**3f. Check** — `npm run dev`, `/html/{prefix}-blocks.html` at 1440/768/390 (the model
`pw-kit.js`, fse-foundations §9): no overflow, tokens applied, carousels started; fix and
re-check until clean; screenshots
`.playwright-mcp/shots/kit-{slug}-{w}.png`.

**3g. State** — `DESIGN.md → Blocchi`: row `{prefix}/{slug}` `kit`, origin page (variants and
children are in the README, the only place where they are written). A new variant of an
implemented block: the row stays `implementato`; the README `## Varianti` row carries "(kit)"
in its "kit" column until `fse-block-edit`/`fse-build` implements it.

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
   <!-- @import "main/form/_form-contacts.kit" -->
         </main>

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
   page (meta default 1, as in wdm-starter); the build sets the page option from the kit, and
   turns it off on a page whose kit does not print it — so the page kit imports
   `main/form/_form-contacts.kit` as the last element inside `<main>` unless its content has a
   `{prefix}/form` (no double form; the catalogue of the base theme imports both on purpose).
4. Each section is designed first (content, tone, rhythm, free layout — §4 "No catalogue
   constraint"), then mapped: an existing variant that renders it as designed → imported; no such
   variant → Step 3 (new variant, or new block) before the page kit imports it. Never the
   reverse: a section is not picked among the existing blocks and then filled.
5. `npm run dev` → `/html/{prefix}-{page}.html` at 1440/768/390 with the model `pw-kit.js`
   (fse-foundations §9, `nome=kit-{page}`); fix until clean; screenshots
   `.playwright-mcp/shots/kit-{page}-{w}.png`.
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

Two things the telaio handover always says, one line each: until the build the site in WordPress
shows the old header and footer with the new CSS (kit and site share `main.css`); and, when the
part of the default form has `formId` 0, that the form the kit shows does not exist yet in
WordPress — the dev creates it in Formidable and sets its id in the part, until then the section
has title and text without fields.

The message has the shape of fse-foundations §10 "The handover message": *Esito* (`⚠️ chiuso, con
attese`: a kit always waits for the ok); *Cosa è cambiato* = the item to look at (URL, screenshots,
blocks and variants born with their README) and only the decisions the dev may want to overturn;
*Cosa aspetta te* = the `[da confermare]` table and the ok itself; *Prossimo passo* = "scrivi ok
(o le osservazioni): all'ok parte la build in questa conversazione". No prompt to paste: what
follows the ok is the agent's. How the kit was built (files, checks, screenshots at three
widths) stays in the `## Log decisioni` row.

Later turns: the dev's remarks are their decisions — apply them (same files), log them as
"richiesta del dev", hand over again. The dev's explicit ok → row `kit` (Telaio: `kit`;
Blocchi rows were born `kit` at 3g), ⏳ removed, log row "kit {item} approvato" — **and in the
same turn** read `${CLAUDE_PLUGIN_ROOT}/skills/fse-build/SKILL.md` and run it from its Step 0
(whole perimeter: this item is built, the aligned rows answer "0 differenze"); the conversation
ends with the build's report, which names the next `da progettare` row and goes on with its kit
unless the dev stops. A revision the dev asks after the build follows the same steps without a
new gate. A **page** row stays as it is: every page that is not `da progettare` is in the
build's perimeter. A **Telaio** row goes back to `kit` (fse-foundations §11): `fse-build` works
the telaio only when its row is `kit`. Then `fse-build` re-applies the difference in the same
turn.

## Never

Write `block.json`, `render.php`, `edit.js`, `index.js`, `editor.scss` or touch WP (no WP-CLI
writes, no editor) **before the ok** — after the ok they are `fse-build`'s, run by this skill in
the same conversation · design a block or a variant as an item of its own, or hand over one block at a time ·
hand the dev a prompt for the build or the next kit · hardcode colours/sizes instead of tokens ·
a kit with more than one root `<section>` per block, or with inline `<script>`/`<style>` ·
Bootstrap/utility classes · `@use 'swiper/swiper'` in a block (shared handle) · fit a section
into an existing block because it exists (a new variant or block is Step 3, not a cost) · ask mid-way what
the charter decides or marks `[da confermare]` · invent a fact about the client · mark a row
`kit` before the dev's ok (only a Telaio row revised after its build goes back to `kit`, see
Review) · `git push`, or any git command beyond the fse-foundations §10 rule; commit a kit still under review.

## Completion checklist (per item)

- [ ] Guard passed, state on disk verified, brief read (or "brief assente" flagged)
- [ ] Block: README contract written (variants, attributes with control and default, children, markup, insertion markup) BEFORE the kit
- [ ] Kit per variant with parity markup; `src/style.scss` with tokens and `__inner`; `view.js` only if needed
- [ ] `_css-shared.kit` (+ `_js-shared.kit`) and `{prefix}-blocks.kit` updated
- [ ] Every section designed first, then mapped: new variants/blocks born wherever no existing variant renders the design (§4 "No catalogue constraint")
- [ ] Page kit with real content inlined (texts from the brief or in its tone, `[da confermare]` for facts), checked at 3 widths with screenshots
- [ ] Review delivered once, for the whole item (never one block at a time), in the §10 handover shape: URL, screenshots, contracts, decisions, `[da confermare]` table, "ok o osservazioni" (no prompt to paste); ⏳ `kit {item} in revisione` written; row still `da progettare`
- [ ] On the dev's ok (later turn): row `kit`, ⏳ removed, log row, commit of the approved kit (fse-foundations §10; the push is the dev's), then `fse-build` run in the same turn
