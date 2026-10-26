# FSE Foundations — conventions shared by every `fse-*` skill

Single file of conventions for the **wdm-theme** family: native block themes (Full Site
Editing) with dynamic Gutenberg blocks, one folder per block, modern CSS without framework,
`build.js` on sass + esbuild. Every `fse-*` skill reads this file first and never re-derives
what is written here. The twin of `dev-foundations.md` (wdm-starter: PHP + Bootstrap + ACF);
the two families never mix — see §0.

Placeholders: `{prefix}` (e.g. `wdm`), `{slug}` (block slug; page slug in the §8 page recipes and fse-build 2d/2e), `{theme-root}`, `{site-root}`,
`{local-url}`, `{agent-admin-user}`, `{wp-cli}` — all resolved from `DESIGN.md → Project
Config` (§11). `{theme-root}` = `{site-root}/wp-content/themes/{theme-folder}`.

---

## 0. The guard — `theme_family`

`DESIGN.md → ## Project Config → ### Identity` has the row `` | `theme_family` | fse | ``.
Every `fse-*` skill reads it at **Step 0**, before anything else:

- value `fse` → proceed;
- value `starter`, any other value, **or row missing** (every wdm-starter project predates it)
  → **STOP**: "Questo progetto è della famiglia wdm-starter (theme_family ≠ fse): usa le skill
  `dev-*`/`design-*`, non `fse-*`." No file is read or written after the stop.

A `DESIGN.md` that does not exist at all → stop too, unless the skill is `fse-theme-setup`
(which creates it). The guard is what makes the two skill families coexist on the same machine (the `fse-*`
family ships in the `wdm-agent` plugin, the starter family lives in the user-level skills folder); the
project `CLAUDE.md` routing table is the second layer, the SKILL.md description ("for a
wdm-theme FSE project") the third.

## 1. Two phases, promoted to sessions

| Moment | Who drives | Skill | Sessions |
|---|---|---|---|
| Setup | agent | `fse-theme-setup` | 1 |
| **Kit**: telaio, pages, blocks with every variant — in dialogue with the dev | dev | `fse-kit` | N, until every item is `kit` |
| **Build**: telaio first, then one page per session, autonomous | agent | `fse-build` | 1 per page (+1 for the telaio) |
| Maintenance | agent | `fse-block-edit`, `fse-menu-build` | 1 per intervention |

Kit phase = design in HTML: the dev designs the whole site as kit files (per block, with all
variants; per page) before any WP code; the block README is the contract. Build phase = the
agent reads the kit, creates the missing blocks (all variants of the README), inserts them in
the page with the kit's contents, stops at the end of the page for the dev's review. Never mix:
no `render.php` for a block whose kit is not approved; no page built from a kit still `da
progettare`. The session boundary of the build is the **page**. On the dev's explicit request kit
and build may run in the same conversation (`fse-kit`, then `fse-build`, in order): the row still
goes `kit` → `implementata`, WP writes (plugins, forms, pages) happen only in the `fse-build`
part, and `## Log decisioni` records the deviation.

States live in `DESIGN.md` (§11) and follow the **pages**: Telaio/Pagine `da progettare` →
`kit` → `implementato|implementata`; Blocchi `kit` → `implementato`, born on demand from the
page build. State is verified on disk at every session start (§11).

## 2. Theme structure

```
{theme-root}/
  style.css  theme.json  functions.php  screenshot.png  README.md
  templates/   index, page, single, archive, search, 404 (.html) — no front-page.html (§7)
  parts/       header.html  footer.html  form-contacts.html (default form, §7)
  patterns/    {prefix}-*.php   (Categories: {prefix}; core blocks only)
  blocks/
    blocks.php                      ← discovery: registers every blocks/*/block.json + block category {prefix}
    {prefix}-block-{slug}/
      block.json  render.php  README.md
      kit/   _{prefix}-block-{slug}-{variant}.kit
      src/   index.js  edit.js  style.scss  [editor.scss]  [view.js]
      build/ index.js  index.asset.php  style-index.css  [index.css]  [view.js  view.asset.php]   (generated, committed)
  src/
    scss/   main.scss, _reset, _type, _telaio, _wp-blocks, _buttons, _forms, fonts.scss, swiper.scss,
            _breakpoints.scss (the only SCSS import shared by blocks), editor/_*.scss (shared editor components)
    js/     main.js, _dialog.js (theme JS, concat), page-options.js (editor panel, §7), editor/ (shared edit.js components), view/ (shared view.js modules, when the first one is born)
    kit/    {prefix}-home.kit, {prefix}-{page}.kit, {prefix}-blocks.kit (catalogue), main/header|footer, svg-vault
  html/      compiled kit (committed) — view via browser-sync, never file:// (§10)
  assets/    css/main.css fonts.css swiper.css wp-global-styles.css · js/main.js page-options.js · fonts/ · img/placeholder-*.jpg
  library/   custom.php (theme support, enqueue, shared style handles, pattern category)  admin.php  thumbnails.php
             page-options.php (page options meta + render filters, §7)
  build.js  package.json  (package.json WITHOUT "type": "module" — §6)
```

Block folder = `{prefix}-block-{slug}` = root CSS class; `block.json` `name` = `{prefix}/{slug}`;
block category `{prefix}` (title = project name, `blocks/blocks.php`); pattern category
`{prefix}` (same slug, different registry, `library/custom.php`). The telaio is made of core
blocks; `{prefix}/*` blocks are page content.

## 3. Anatomy of a block

### block.json
```json
{
  "$schema": "https://schemas.wp.org/trunk/block.json",
  "apiVersion": 3,
  "name": "{prefix}/{slug}",
  "version": "1.0.0",
  "title": "Titolo italiano",
  "category": "{prefix}",
  "icon": "cover-image",
  "description": "Una riga in italiano.",
  "textdomain": "{text-domain}",
  "attributes": { "align": { "type": "string", "default": "full" }, "title": { "type": "string", "default": "" } },
  "supports": {
    "align": [ "full" ], "anchor": true, "html": false,
    "color": { "background": true, "text": true, "link": false },
    "spacing": { "padding": true, "__experimentalDefaultControls": { "padding": true } }
  },
  "render": "file:./render.php",
  "editorScript": "file:./build/index.js",
  "style": "file:./build/style-index.css",
  "editorStyle": "file:./build/index.css",
  "viewScriptModule": "file:./build/view.js"
}
```
- `version` is mandatory: outside `SCRIPT_DEBUG` the block CSS is cache-busted only by this
  key — **bump it at every release** of the block.
- `editorStyle` only when `src/editor.scss` exists; `viewScriptModule` only when `src/view.js`
  exists. The hook `check-block-contract.sh` verifies every `file:` has its source and that
  `README.md` and `render` exist.
- Carousels: `"style": ["{prefix}-swiper", "file:./build/style-index.css"]` — the shared Swiper
  CSS is a registered handle (`wdm-swiper` in the starter: `library/custom.php`,
  `assets/css/swiper.css`), **never** `@use 'swiper/swiper'` inside a block's SCSS (it would
  duplicate the Swiper core per block).
- Child blocks: `"parent": ["{prefix}/{parent}"]`, `"usesContext": ["{prefix}/xyz"]`,
  `"supports": { "html": false, "reusable": false }`; the parent declares
  `"providesContext": { "{prefix}/xyz": "attribute" }`.
- Section padding default lives in **theme.json → `styles.blocks["{prefix}/{slug}"].spacing.padding`**
  (top/bottom `var:preset|spacing|section-lg`), not in `attributes.style.default`: the control
  shows the inherited value, the client overrides from the presets, core's "None" option (0) means
  "no padding" — never add a `none` preset to `spacingSizes` (it duplicates core's option).
  Add the entry for every new section block.

### render.php — the only frontend markup, always dynamic
```php
<?php
/**
 * {prefix}/{slug} — markup frontend (unica fonte, mai save()).
 * @var array $attributes  @var string $content  @var WP_Block $block
 */
if ( ! defined( 'ABSPATH' ) ) exit;
$wrapper = get_block_wrapper_attributes( array( 'class' => '{prefix}-block-{slug}' . ( $attributes['reverse'] ? ' {prefix}-block-{slug}--reverse' : '' ) ) );
?>
<section <?php echo $wrapper; ?>>
  <div class="{prefix}-block-{slug}__inner">
    <?php if ( $attributes['title'] ) : ?><h2 class="{prefix}-block-{slug}__title"><?php echo wp_kses_post( $attributes['title'] ); ?></h2><?php endif; ?>
    <?php echo $content; // InnerBlocks, if any ?>
  </div>
</section>
```
Rules: never `save()` with markup (content invalidation at every markup change — the one
non-negotiable rule); `$content` or `$block->parsed_block['innerBlocks']` for children;
escaping `esc_html` / `esc_attr` / `esc_url` / `wp_kses_post` (RichText values); images via
`wp_get_attachment_image( $id, 'thumb-700x450', false, [ 'class' => …, 'alt' => $alt ] )` with
fallback to `imageUrl`; **`is_post_type_viewable()`** before any query or lookup on a post
type coming from an attribute, `post_status => publish` explicit; shared markup used by two
blocks goes in a PHP file of the owning block (e.g. `card.php` → `{prefix}_card_markup()`),
loaded with `require_once` by both render.php.

### index.js / edit.js
```js
// src/index.js
import { registerBlockType } from '@wordpress/blocks'
import { InnerBlocks } from '@wordpress/block-editor'   // only for blocks with children
import metadata from '../block.json'
import Edit from './edit'
registerBlockType(metadata.name, { edit: Edit })                                   // leaf block
registerBlockType(metadata.name, { edit: Edit, save: () => <InnerBlocks.Content /> }) // block with InnerBlocks
```
- `Edit` lives in `edit.js`; its markup **replicates render.php** (same tags, classes, order)
  via `useBlockProps({ className })`.
- Blocks with children: `save: () => <InnerBlocks.Content />` is **mandatory** (with `save:
  null` the children are not serialized); `useInnerBlocksProps` with `allowedBlocks`,
  `template`, `templateLock` (`'all'` for a fixed single child, `false` with
  `InnerBlocks.ButtonBlockAppender` for repeaters); `orientation: 'horizontal'` for carousels.
- Variant switch that drops children (e.g. carousel → single image): `replaceInnerBlocks(clientId,
  [first])` + `setAttributes`, with a `help` text warning the user; document it in the README.
  A fixed-child block saved via WP-CLI with more children than the lock allows loses them on
  open and shows the post as modified.
- UI strings in Italian inside `__( '…', '{text-domain}' )`: JS translations are not loaded
  (accepted: monolingual sites).
- Shared components in `src/js/editor/`: `LinkButton` (`value: {text,url,newTab}`,
  `onChange(next)`; RichText + LinkControl in a popover), `PostPicker` (`postType, postId,
  onChange` — ComboboxControl + `useEntityRecords`, debounced search), `PostTypeSelect`
  (viewable post types). Their editor styles live in `src/scss/editor/_*.scss`, loaded by the
  block's `editor.scss` with `@use 'editor/link-button'`.
- ServerSideRender previews (content derived from a post / a query): `<div ref={useDisabled()}>`
  around `<ServerSideRender block={metadata.name} attributes={attributes}
  skipBlockSupportAttributes />`, inside `useBlockProps()`; the inline-editable parts of the
  block (a RichText title) are rendered by edit.js and passed **empty** to the SSR so they are
  not duplicated. Without the required attribute → a `Placeholder` with the picker.
- Images: three attributes `imageId` (integer), `imageUrl` (string), `imageAlt` (string);
  `MediaPlaceholder` when empty, `MediaReplaceFlow` in `BlockControls group="other"` when set;
  `onSelect` writes all three (`media.sizes?.['thumb-700x450']?.url || media.url`). **`imageUrl`
  must be written together with `imageId`** in insertion markup: the editor shows the
  placeholder with the ID alone.

### Content pattern → attribute + control
| In the kit | Attribute(s) | Control in edit.js | render.php |
|---|---|---|---|
| short/long text, heading | `title`/`text` string | `RichText` (`tagName`, `allowedFormats: ['core/bold','core/italic'(,'core/link')]`) | `wp_kses_post()`, omitted when empty |
| image | `imageId` int, `imageUrl` str, `imageAlt` str | `MediaPlaceholder` / `MediaReplaceFlow` | `wp_get_attachment_image` → fallback `imageUrl` |
| button / link | `buttonText`, `buttonUrl`, `buttonNewTab` | `LinkButton` (shared) | `<a class="wp-element-button …">`, `target="_blank" rel="noopener"`; omitted if text or URL empty |
| choice among variants | `variant` string with `enum` | `SelectControl` in `InspectorControls` | class modifier `--{variant}` |
| on/off | boolean | `ToggleControl` | class modifier |
| number in a range | integer | `RangeControl` | `style="--{prefix}-x:N"` or `data-*` |
| repeated element | child block `{prefix}/{child}` with `parent` | `InnerBlocks` (appender) | `$content` |
| a content chosen by hand | `postType`, `postId` | `PostPicker` + `PostTypeSelect`, preview `ServerSideRender` | `is_post_type_viewable` + `get_post` |
| latest N of a post type | `postType`, `count` | `InspectorControls`, preview `ServerSideRender` | `WP_Query` `post_status publish`, `is_post_type_viewable` |
| background / text colour, padding | — | `supports.color`, `supports.spacing` (presets only) | `get_block_wrapper_attributes()` |
| anchor id (`id` on the section in the kit) | `anchor` in the insertion markup (no block.json attribute) | `supports.anchor` | wrapper attributes |
| raw HTML / embed / SVG | — | `core/html`, `core/embed`; SVG read from a file in render.php | never SVG in attributes (kses for non-admins) |

### README.md — the contract
Sections, in order: `# {prefix}/{slug} — Titolo` · `## Scopo` · `## Varianti` (table: variante,
attributi, classe, figli, kit) · `## Attributi` (table: nome, tipo, controllo, default, note) +
line "Supports: …" · `## Figli` · `## Markup (render.php = kit)` (HTML skeleton with classes) ·
`## Markup di inserimento` (the `<!-- wp:{prefix}/{slug} {…} -->` the build will write, with
`imageId`+`imageUrl`+`imageAlt`) · `## Dipendenze JS / CSS` · `## Componenti condivisi`. The
README is what `fse-build` reads to create and populate the block: an attribute not in the
table does not exist.

## 4. Kit = render.php — the parity rule

Kit markup (`blocks/{prefix}-block-{slug}/kit/_{prefix}-block-{slug}-{variant}.kit`) is the
exact output of render.php: same wrapper (`<section class="wp-block-{prefix}-{slug} alignfull
{prefix}-block-{slug} [--variant]">`), same classes, same element order, placeholder texts and
`../assets/img/placeholder-*.jpg` images (check the files in `assets/img/` first; the
starter ships `placeholder-2000x1150.jpg` (hero) and `placeholder-700x450.jpg` (cards)). One
kit file per variant; the page kit imports one per block instance:
```html
<!-- @import "../../blocks/{prefix}-block-{slug}/kit/_{prefix}-block-{slug}-{variant}.kit" -->
```
Page kit (`src/kit/{prefix}-{page}.kit`): `<!-- $title = … -->`, `@import "main/header/_header.kit"`,
`<main class="{prefix}-main">` with the block imports in page order, then after `</main>` `@import
"main/form/_form-contacts.kit"` (the default form part, §7 — omitted only when the page content
has its own `{prefix}/form`), `@import "main/footer/_footer.kit"`. `src/kit/{prefix}-blocks.kit` is the catalogue of every variant of
every block (one page, used for the screenshot comparison). Kit CSS comes from
`_css-shared.kit`: `fonts.css`, `wp-global-styles.css`, `main.css`, `swiper.css`, then one
`../blocks/{prefix}-block-{slug}/build/style-index.css` per block (add the line when a block is
born); `_js-shared.kit` loads the `build/view.js` modules.

`assets/css/wp-global-styles.css` is the CSS WP prints inline from theme.json (variables,
presets, elements, button, section padding): regenerated by `sync-theme-json-tokens.js` (reads
`{wp-cli}` from DESIGN.md, keeps the header comment) after every theme.json change, or by hand
with `{wp-cli} eval 'echo wp_get_global_stylesheet();'` restoring the header comment.

**Exception — the telaio** (§7): the kit is the visual target, the implementation is core
blocks + CSS; markup differences are expected and documented in the theme README. The exception
covers the **markup only**: every behaviour (dropdown trigger, drawer, accordion, scrolled header,
DOM transport) is designed and verified in the kit first — with kit-only scripts in
`_js-shared.kit` where core will provide the behaviour in WP — and WP must reproduce it
identically (same trigger, same classes, same CSS). A behaviour that exists in WP and not in the
kit, or that differs (hover vs click), is a bug of the build, not an accepted difference.

**Exception — plugin output**: a BEM element whose content is printed by a plugin (a form from
`FrmFormsController::get_form_shortcode()`, an embed) is declared as such in the block README
("Parità kit ↔ render: fino a `__el` incluso"); the kit replicates the plugin markup as the
target of the SCSS, and `fse-build` compares the wrapper and the siblings of `__el`, never its
content.

Verification of a kit: `npm run dev` → `https://localhost:8848/html/` (browser-sync lists the
compiled pages); never open `html/*.html` from `file://` — the `type="module"` view.js are
blocked by CORS and the carousels do not start.

## 5. CSS and JS conventions

### CSS (`src/style.scss` of the block, compiled to `build/style-index.css`)
- `@use 'breakpoints' as *;` as first line when the block needs media queries; mixins
  `bp-up(md)` / `bp-down(md)`; the SCSS map ≡ `theme.json → settings.custom.breakpoints`
  (`sync-theme-json-tokens.js --check` fails when they diverge). Breakpoints are the only token
  duplicated in SCSS: media queries do not accept custom properties. In JS read them from
  `--wp--custom--breakpoints--*` (Swiper breakpoints).
- Every other value from theme.json variables: `var(--wp--preset--color--main)`,
  `--wp--preset--spacing--xs|sm|md|lg|xl|section-sm|section-lg`,
  `--wp--preset--font-size--*`, `--wp--custom--radius--md`, `--wp--custom--transition--base`,
  `--wp--custom--z-index--header`, `--wp--custom--header-height--mobile|desktop`,
  `--wp--style--global--wide-size|content-size`. No hardcoded colours or sizes, no utility
  classes beyond core's.
- BEM on the block: `.{prefix}-block-{slug}` (root, given by render.php), `__el`, `--modifier`.
- Section blocks: the root `<section>` is `alignfull` (default `align: full`); the inner
  container is **`.{prefix}-block-{slug}__inner`**: `box-sizing: content-box; max-width:
  var(--wp--style--global--wide-size); margin-inline: auto; padding-inline:
  var(--wp--preset--spacing--xs)` (content = wide-size, padding outside, like core alignwide).
  A column that must align to the left edge of the content: `margin-inline-start: max(0px,
  calc((100% - var(--wp--style--global--wide-size)) / 2 - var(--wp--preset--spacing--xs)))`.
  No `supports.layout` on section blocks (core `wp-container-*` hash classes cannot be
  replicated in the kit).
- Vertical padding of the section comes from theme.json (§3), not from the SCSS.
- Carousels: `.swiper { position: static }` inside the block when the navigation is positioned
  relative to `__inner`; `.has-text-color :is(h1…h6), .has-text-color a:not(.wp-element-button)
  { color: inherit }` is already global (`_wp-blocks.scss`).
- `clamp()`, grid/flex, container queries where useful; `:where()` for low-specificity resets.
- Editor-only styles in `src/editor.scss` → `build/index.css` (placeholders, static carousel
  preview); frontend styles are loaded in the editor too (`style` is enqueued in both).
- Theme SCSS: `main.scss` (+ partials) → `assets/css/main.css`, enqueued on the frontend and
  as editor style (`add_editor_style`); form/reset rules inside `:where()` so they do not leak
  into editor placeholders. Never `import './style.scss'` from JS (build error by design).

### JS
Default **vanilla** (`<dialog>` via `src/js/_dialog.js` with `data-dialog-open`, `<details>`,
`IntersectionObserver`); **Interactivity API** (`@wordpress/interactivity`, `viewScriptModule`,
`supports.interactivity`) when there is state to manage; **Swiper** (`import Swiper from
'swiper'`, `import { Pagination, Navigation, A11y, Keyboard } from 'swiper/modules'`) for
carousels — bundled per block (tree-shaken, ~40 KB each, accepted). No jQuery.

`src/view.js` (ES module, frontend only): `document.querySelectorAll('.{prefix}-block-{slug}--carousel
.swiper').forEach(el => new Swiper(el, {...}))`; `a11y` messages **in Italian**
(`prevSlideMessage: 'Slide precedente'`, `paginationBulletMessage: 'Vai alla slide
{{index}}'`, …) because the A11y module rewrites the aria-labels; `slidesPerView` from a
`data-*` attribute written by render.php; breakpoints from
`getComputedStyle(document.documentElement).getPropertyValue('--wp--custom--breakpoints--md')`.
In the editor the carousel is a **static preview** (stacked/grid in editor.scss); Swiper runs
only on the frontend. Allowed `@wordpress/*` imports in a view.js: `interactivity`,
`interactivity-router`, `a11y` (import map of WP); anything else fails the build.

Shared view modules go in `src/js/view/`; whoever creates the first one adds to `build.js` the
watch rule `src/js/view/** → buildAllBlockViews()` (today only `src/js/editor/**` triggers a
rebuild of all blocks) — otherwise view.js stays stale in watch.

Theme JS (`src/js/main.js` + `_*.js`) uses the concat logic (`@prepend`/`@append`), not ES
modules.

## 6. Build contract (`build.js`)

- `npm run build` → exit 0 = everything compiled; `npm run dev` → watch + browser-sync
  (`https://localhost:8848`, proxy `CONFIG.proxy` = `{local-url}`). Any sass/esbuild/kit error
  → `process.exitCode = 1`.
- Discovery from `blocks/*/block.json`: no list to maintain. Per block, layout identical to
  `wp-scripts`: `src/index.js` → `build/index.js` (IIFE, JSX automatic, `@wordpress/*` →
  `window.wp.*`, `react/jsx-runtime` → `ReactJSXRuntime`) + `build/index.asset.php`
  (`dependencies` from the imports, `version` md5); `src/view.js` → `build/view.js` (ESM) +
  `build/view.asset.php` (`type => module`, module ids); `src/style.scss` →
  `build/style-index.css`; `src/editor.scss` → `build/index.css`.
- **Fails (exit 1)** on: unresolved import; React or an external `@wordpress/*` bundled;
  `import './style.scss'` (or any `.css`/`.scss`) from JS; `@wordpress/*` other than
  interactivity/router/a11y in a view.js.
- `@wordpress/icons` (and the other packages without a `wp.*` global, `BUNDLED` list) are
  bundled from npm: `npm i` them when used.
- `package.json` must **not** have `"type": "module"` (build.js is CommonJS): esbuild would
  apply Node ESM interop and `import ServerSideRender from '@wordpress/server-side-render'`
  would return the namespace instead of `.default`.
- Watch: `src/scss/**` partials → theme + all blocks; `blocks/{slug}/src/**` → that block;
  `src/js/editor/**` → all blocks' editor scripts; `blocks/*/block.json` add → build + reload,
  change → reload (the `metadata` import is inlined: touch `src/` to refresh it); `*.php`,
  `theme.json`, `templates/`, `parts/`, `patterns/` → reload; kits → recompile `html/`.
- `blocks/blocks.php`: `foreach glob(__DIR__.'/*/block.json') register_block_type(dirname)` +
  category filter. Nothing to add when a block is born: create the folder, run the build.
- `build/` and `html/` are committed (like the starter); `*.map` and `node_modules` are not.

## 7. The telaio (templates, parts, patterns)

Core blocks only, styled by `src/scss/_telaio.scss`:

- **Convention**: the parts give the core blocks, via `className`, the **same BEM classes as
  the kit** (`{prefix}-header`, `{prefix}-header__inner|__logo|__nav|__social`,
  `{prefix}-footer`, `{prefix}-footer__inner|__columns|__col|__nav|__social|__bottom`,
  `{prefix}-main`); `className` on the `template-part` block in the templates gives the class
  to `<header>`/`<footer>`. One CSS for kit and WP; the inner markup is core's and the
  differences go in the theme README ("Differenze kit ↔ WP attese").
- **Templates**: `post-content {"layout":{"type":"constrained"}}` inside a `main` **without**
  constrained layout (with a constrained main every alignfull block shrinks to contentSize).
  `page.html` (also used for the static front page) prints `post-title {"level":1}` inside a
  constrained group `{prefix}-page-header`; `single.html` prints it in the article header.
  **Page options** (`library/page-options.php`, the FSE twin of the starter's ACF page
  radios): two boolean post meta on `page` and `post`, default `true`, `show_in_rest` —
  `{prefix}_show_title` (the template title) and `{prefix}_show_form` (the default form part,
  below) — edited from the "Opzioni pagina" panel in the document sidebar (`src/js/page-options.js`
  → `assets/js/page-options.js`, plain JS entry in `build.js`, enqueued on
  `enqueue_block_editor_assets`) and set by `fse-build` from the kit: title `0` when the page
  opens with a hero variant image (its h1), form stays `1` (shown everywhere, as
  in wdm-starter) and goes to `0` only on a page whose content already has a `{prefix}/form` block. `render_block_core/post-title`,
  `render_block_core/group` (className `{prefix}-page-header`) and
  `render_block_core/template-part` (slug `form-contacts`) return `''` when the meta is off, on
  singular views only. The editor canvas still shows the template title and part (no editor
  hiding). No custom "page with title" template, no `titleLevel` attribute on blocks.
  **Default form**: `parts/form-contacts.html` ("Form di default", area `uncategorized`,
  `theme.json → templateParts`) holds one `{prefix}/form` block (title, text, `formId`): the
  single place where the site's default form is chosen; included by `page.html` and
  `single.html` after `</main>`, before the footer, as `template-part {"slug":"form-contacts",
  "className":"{prefix}-form-contacts"}`; kit `src/kit/main/form/_form-contacts.kit` imports
  the block's centered kit; when the part's values (title, text, form) differ from that variant
  kit, the part kit inlines the part's values (as a page kit does). `archive/search/index/404` print their own h1. **No `front-page.html`** (it
  would be identical to page.html and, with `show_on_front=posts`, would render the latest
  post's body as home): the front is a static page (`show_on_front=page` + `page_on_front`).
- **Gaps**: the telaio zeroes the root blockGap between header/main/footer (`.wp-site-blocks >
  * { margin-block: 0 }`) and the gap between two consecutive full sections
  (`.wp-block-post-content > .alignfull + .alignfull { margin-block-start: 0 }`); a paragraph
  followed by a section keeps the gap. Sections carry their own padding (§3).
- **Header**: `position: fixed` (as in wdm-starter) with a constant `padding-top` on `.wp-site-blocks` equal to the header height at rest — never `sticky` with a height that changes on scroll (the document reflows and the browser's scroll anchoring bounces around the threshold); in the Site Editor canvas (`.editor-styles-wrapper`) the header is `relative` and the root has no padding; `transition` always with the whole token `var(--wp--custom--transition--base)` (`all .2s …`: `transition: transform var(…)` is invalid). Tokens `--wp--custom--header-height--mobile|desktop`, `--wp--custom--z-index--header`,
  `top` = admin bar height when logged in (and 0 under 600px, where the bar scrolls away);
  `html { scroll-padding-top }`; `.wp-site-blocks` min-height compensates the admin bar;
  `.{prefix}-header__logo { min-width: 0 }` (long site names wrap). `site-logo` (empty until a
  logo is uploaded) + `site-title {"level":0}` (a `<p>`); a project with an image logo removes
  the site-title.
- **Menu**: `core/navigation` with `"ref": <id>` of a `wp_navigation` post with explicit links
  (`home-link` + `navigation-link`, never `page-list`); the **same `ref` in header and
  footer** (`fse-menu-build` rewrites it in **both** parts: core does not check the post type
  of the ref — a wrong id prints a page's content inside the nav, a missing id an empty nav).
  Overlay: `overlayMenu: mobile`, `overlayBackgroundColor`/`overlayTextColor` from the palette,
  breakpoint = **`xl`** (1170px, like the starter's `d-xl-none`): core opens the overlay under 600px, `_telaio.scss` moves the threshold with one isolated override of two core selectors (`__responsive-container-open` shown, `__responsive-container:not(.is-menu-open)` hidden between 600px and `xl`) and restyles `.is-menu-open` as the starter's left drawer (300px under the header, veil via `html.has-modal-open::after`, core's close button fixed over the hamburger). The kit replicates the drawer with a kit-only script in `_js-shared.kit` (never in `main.js`): `button.wdm-header__toggle` puts `is-menu-open` on the kit `nav`, which becomes the panel, plus `has-modal-open` on `html` and `is-open` on the parent `li` — same classes as WP, same CSS through a `drawer-panel` mixin in `_telaio.scss` whose inner selectors are parameters (core classes for WP, `> ul`/`li`/`a` for the kit); the kit's desktop menu rules are scoped to `.wdm-header__nav:not(.is-menu-open)`. Policy and social of the footer move into the drawer under `lg` via `src/js/_responsive-dom.js` (vanilla responsiveDom); the menu itself never moves: core prints one list.
  `social-links` with `is-style-logos-only`; `justifyContent` not set on the header navigation
  (the parent `space-between` pushes it right; setting it would also align the overlay items).
- **Footer**: `group` with `layout: grid`, `minimumColumnWidth: 16rem` (same auto-fill rule as
  the kit CSS); columns `group` with `blockGap xs`.
- **Patterns** (`patterns/{prefix}-{name}.php`, header `Title/Slug: {prefix}/{name}/Categories:
  {prefix}/Description/Keywords`, `if ( ! defined( 'ABSPATH' ) ) exit;`, core blocks only):
  recurring sections (CTA, contacts); site data (contacts, social, form IDs) is content of the
  parts/patterns — no options panel; repeated data → synced pattern. In development
  `define( 'WP_DEVELOPMENT_MODE', 'theme' )` in wp-config (no cache of the pattern list and
  theme.json); in production the pattern cache is invalidated only by bumping `Version` in
  `style.css`. From the CLI the theme patterns must be forced: `wp eval
  '_register_theme_block_patterns(); …'`.
- **theme.json spacing tokens**: never a bare `"0"` — core's `clamp(1rem,
  var(--wp--style--root--padding-top), 20rem)` becomes invalid; write `"0px"`.
- **Permalinks** `/%postname%/` (+ standard `.htaccess`, outside the repo): needed by
  single/archive/search and the REST `/wp-json`.
- Files are the source of the telaio: a template/part saved from the Site Editor becomes a
  `wp_template`/`wp_template_part` post that shadows the file — after a Site Editor test,
  `wp post delete <id> --force` so the files stay the source. Lock: open by default (a project
  adds `templateLock`/`lock` on request).
- h1 debt to remember (Phase 4 M5): a page whose client turned "Mostra il titolo" off and whose
  content has no hero has no h1 — say so when relevant.

## 8. WP-CLI recipes (the write path of `fse-build` and `fse-menu-build`)

`{wp-cli}` from `DESIGN.md → Project Config → Paths` is the full command (MAMP PHP 8.4 +
socket + phar + `--path`), e.g.
`/Applications/MAMP/bin/php/php8.4.17/bin/php -d memory_limit=512M -d mysqli.default_socket=/Applications/MAMP/tmp/mysql/mysql.sock {site-root}/wp-cli.phar --path={site-root}`.
The phar path is **absolute** (the skills `cd` into `{theme-root}` for npm and the Bash cwd
persists; `sync-theme-json-tokens.js` runs it from any cwd). In zsh put it in a script file, not
in a string variable. Below `{wp-cli}
post create` is what `wp post create` would be with a global `wp`.

```bash
# page from a file with block markup (the markup of the README "Markup di inserimento" + kit texts)
ID=$({wp-cli} post create {scratchpad}/page-{slug}.html --post_type=page --post_title="Titolo" --post_name="slug" --post_status=publish --porcelain)
{wp-cli} post update $ID {scratchpad}/page-{slug}.html              # replace the content of an existing page
{wp-cli} post get $ID --field=post_content                          # derived state: what is in WP now
{wp-cli} post meta update $ID {prefix}_show_title 0                  # page opening with a hero image (its own h1); {prefix}_show_form 0 only when the content already has a {prefix}/form block (§7)
{wp-cli} option update show_on_front page && {wp-cli} option update page_on_front $ID
{wp-cli} plugin install formidable --activate && {wp-cli} eval 'FrmAppController::install();'   # Formidable via WP-CLI: only install() creates its tables
{wp-cli} eval '$s = FrmAppHelper::get_settings(); $s->load_style = "none"; $s->store();'     # plugin CSS off: the theme styles the form
{wp-cli} post list --post_type=page --fields=ID,post_title,post_name,post_status
{wp-cli} media import {theme-root}/assets/img/placeholder-700x450.jpg --title="placeholder-700x450" --porcelain   # → attachment ID; reuse it
{wp-cli} post list --post_type=attachment --fields=ID,post_title,guid                                               # existing placeholders (starter: 10 = 2000x1150, 11 = 700x450)
{wp-cli} eval 'echo wp_get_attachment_url(11);'
{wp-cli} post list --post_type=wp_navigation --fields=ID,post_title            # menus (fse-menu-build owns them)
{wp-cli} eval-file ${CLAUDE_PLUGIN_ROOT}/skills/fse-menu-build/scripts/wp-navigation.php dump
{wp-cli} eval 'echo wp_get_global_stylesheet();'                                # CSS for the kit (sync script does it)
{wp-cli} eval '_register_theme_block_patterns(); foreach (WP_Block_Patterns_Registry::get_instance()->get_all_registered() as $p) echo $p["name"], "\n";'
{wp-cli} eval 'foreach (WP_Block_Type_Registry::get_instance()->get_all_registered() as $n => $b) if (str_starts_with($n, "{prefix}/")) echo $n, "\n";'
{wp-cli} post delete <id> --force                                               # test pages, wp_template_part copies
```

Insertion markup: `<!-- wp:{prefix}/{slug} {"attr":"value"} /-->` (leaf) or `<!-- wp:{prefix}/{slug}
{…} -->children<!-- /wp:{prefix}/{slug} -->`; attributes equal to their default may be
omitted; `imageId` always with `imageUrl` (+ `imageAlt`); core blocks inside a wrapper with
their HTML (`<!-- wp:paragraph --><p>…</p><!-- /wp:paragraph -->`). Texts verbatim from the
kit (WordPress applies `wptexturize` on output: compare after normalization). A page created
this way must open in the editor with **zero invalid blocks** and not dirty.

Direct `post_content` writes are the write path of the FSE family (the markup is
self-documenting, no opaque ACF keys); the editor JS API is used for the smoke test (§9).

## 9. Playwright checklist (agent user)

Scripts live in `{site-root}/.playwright-mcp/` (gitignored): `browser_run_code_unsafe` with
`filename` accepts only files there; screenshots in `.playwright-mcp/shots/`. Template per block
`pw-{slug}.js` (copy an existing one), `pw-catalog.js` (catalogue page at 3 widths),
`pw-telaio.js`, `pw-site-editor.js`. Login with `{agent-admin-user}` (username from DESIGN.md,
password from the prompt — asked once, never written): scripts carry the placeholder
`'{password}'`; to run one, write a temporary copy with the password substituted, run it and
delete the copy right after — a `pw-*.js` never holds the literal. The kit on browser-sync
(`https://localhost:8848`, self-signed certificate) needs a context with `ignoreHTTPSErrors: true`
(`page.context().browser().newContext({ ignoreHTTPSErrors: true })`; the sandbox has no `require`). If the browser is "already in use":
`pkill -f mcp-chrome-`.

Per block (editor → frontend):
1. `post-new.php?post_type=page`, wait for `wp.blocks.getBlockType('{prefix}/{slug}')` and the
   `iframe[name="editor-canvas"]`; disable the welcome guide.
2. `wp.blocks.createBlock('{prefix}/{slug}', attrs[, innerBlocks])` + `insertBlocks`,
   `editPost({ title, status: 'publish' })` (a draft has no frontend: point 5 would 404); **zero console errors** (ignore the pre-existing `login.css` 404 and
   `favicon.ico`); the canvas shows `.{prefix}-block-{slug}` with the classes of the variant.
3. `updateBlockAttributes(clientId, {…})` → canvas updated.
4. `savePost()` → `isEditedPostDirty() === false`, no `isValid === false` block,
   `getEditedPostContent()` as expected. A first save on `post-new.php` navigates: collect the
   result at the end (or in `window.__steps`), do not return in the middle.
5. `page.goto(getPermalink())`: `.{prefix}-block-{slug}` present, texts = attributes,
   `swiper-initialized` where expected, `img[srcset]`, `document.documentElement.scrollWidth
   === window.innerWidth` at 1440/768/390; padding-top from theme.json.
6. Screenshot editor + frontend, compared with `html/{prefix}-blocks.html` (browser-sync).
7. Measurements after scroll: `window.scrollTo({ top, behavior: 'instant' })` (the reset has
   `scroll-behavior: smooth`) and wait for the CSS transitions (`.2s`) before reading
   positions/colours; visitor view: `page.context().clearCookies()`.
8. Clean up: delete test pages (`wp post delete --force`), close the tab (post lock),
   `debug.log` empty.

Per page: created via WP-CLI → opens in the editor with 0 invalid / 0 `core/missing` blocks,
not dirty → frontend screenshot at 1440/768/390, no horizontal overflow, one h1.

## 10. Session hygiene

- Start: `DESIGN.md` (guard, Project Config, state tables, `## Domande aperte`), then verify the
  state on disk/WP (§11) and report discrepancies before acting.
- One ⏳ line in `DESIGN.md → ## Domande aperte` while a multi-step build is in progress
  (`⏳ pagina {Titolo} in costruzione: {M}/{N} blocchi (dal YYYY-MM-DD)`), removed when done.
- Credentials: username from DESIGN.md, password from the prompt, never persisted or echoed.
- Never take over a post locked by another user; close the tab at the end.
- `debug.log` empty at the end of every session (`WP_DEBUG_LOG` on); `npm run build` exit 0.
- Git is the dev's (Sourcetree): **never** a git command, not even read-only.
- 2 spaces, no tabs, in every file; never overwrite an existing file — read and complete it.
- Every question the agent feels like asking during a build is a gap of the kit/README: report
  it at the end, do not ask — except for the stop conditions of the skill. These gaps (report +
  `## Domande aperte`) are the expected product of the build; anything else still open at the
  end becomes one question with a proposal, not a list.
- A dev request that contradicts the spec or these foundations wins (a feature "as in
  wdm-starter" is replicated, not redesigned): implement it, then update foundations/skills and
  the spec in the same session and log it.

## 11. DESIGN.md — the cross-session state (FSE format)

```markdown
# Design: {slug}

## Project Config

### Identity
| Variable | Value |
|---|---|
| `theme_family` | fse |
| `{prefix}` | abc |
| `{site-folder}` | {slug} |
| `{theme-folder}` | {slug} |
| `{text-domain}` | {slug} |
| `{category-title}` | Nome Progetto |
| `{local-url}` | https://{slug}.local:8890/ |
| `{agent-admin-user}` | abcadminclaude |

### Paths
| Variable | Value |
|---|---|
| `{site-root}` | /Users/…/Sites/{slug} |
| `{theme-root}` | /Users/…/Sites/{slug}/wp-content/themes/{slug} |
| `{db-socket}` | /Applications/MAMP/tmp/mysql/mysql.sock |
| `{wp-cli}` | /Applications/MAMP/bin/php/php8.4.17/bin/php -d memory_limit=512M -d mysqli.default_socket=/Applications/MAMP/tmp/mysql/mysql.sock /Users/…/Sites/{slug}/wp-cli.phar --path=/Users/…/Sites/{slug} |

## Local Development
- **Local URL**, **Build watch** `npm run dev`, **Build single** `npm run build`, kit catalogue `https://localhost:8848/html/`

## Design Tokens
<!-- AUTO-GENERATED:design-tokens da theme.json … --> (sync-theme-json-tokens.js — never by hand)

## Telaio
| Item | Stato | Kit | Note |
|---|---|---|---|
| header | implementato | src/kit/main/header | parts/header.html |
| footer | implementato | src/kit/main/footer | parts/footer.html |
| template page / single / archive / search / 404 | implementato | — | templates/*.html |
| form di default | implementato | src/kit/main/form/_form-contacts.kit | parts/form-contacts.html |

## Pagine
| Pagina | URL | Stato | Kit | Blocchi (in ordine) |
|---|---|---|---|---|
| Home | / | implementata | src/kit/abc-home.kit | hero (image) |

## Blocchi
| Blocco | Stato | Varianti | Figli | Pagina d'origine |
|---|---|---|---|---|
| abc/hero | implementato | image, carousel | abc/hero-slide | Home |

## Navigazione
| menu (id) | parts | voci (primo livello + figli) | orfane | data |
|---|---|---|---|---|
| Menu principale (4) | header, footer | Home (home-link) · Chi siamo (12) › Team (15) | 0 | 2026-10-11 |

## Domande aperte
## Log decisioni
| Data | Decisione |
```

States: Telaio `da progettare` → `kit` → `implementato`; Pagine `da progettare` → `kit` →
`implementata`; Blocchi `kit` → `implementato` (variants listed; a block is `kit` as soon as
its first kit + README exist, `implementato` when `blocks/{prefix}-block-{slug}/build/index.asset.php`
exists — not `build/style-index.css` alone, which a kit-phase block already has).

**Verification on disk at session start** (every `fse-*` skill, after the guard). The tables
are what `fse-kit`/`fse-build` wrote; the disk and WP can **demote or flag a row, never promote
it** (a file's existence says nothing about whether the dev approved it) — with one exception:
- Blocchi: `blocks/{prefix}-block-{slug}/build/index.asset.php` exists → `implementato` (the
  only promotion: the editor script is unambiguous evidence of a built block; a kit-phase
  block has only `build/style-index.css`); an `implementato` block without it → back to `kit`;
  a row without `README.md` + `kit/` → flag.
- Pagine: row `kit`/`implementata` but `src/kit/{prefix}-{page}.kit` missing → back to
  `da progettare`; row `implementata` but the page is absent in WP (`{wp-cli} post list
  --post_type=page --name=<slug>`) → back to `kit`; a page present in WP while the row says
  `da progettare`/`kit` (e.g. the empty Home created by `fse-theme-setup`) → **flag only**
  ("esiste in WP, contenuto da confrontare col kit"): `implementata` means `fse-build` 2g passed
  (WP content ≡ kit), not "the page exists".
- Telaio: `parts/` and `templates/` always exist in a theme cloned from the starter — never
  evidence; the row is what the kit/build sessions wrote (`kit` after a redesign in `fse-kit`,
  `implementato` after the telaio session of `fse-build`).
- Navigazione: the menu id must exist as a `wp_navigation` post and both parts must carry
  `"ref":<id>` (`grep -n '"ref":' parts/*.html`); otherwise → flag ("menu da riallineare:
  fse-menu-build"). The row is written by `fse-menu-build` Step 5, never promoted or demoted.
Every demotion/flag is reported in the opening line of the run. `## Design Tokens` is owned by
the sync script; `## Project Config` by `fse-theme-setup` (created once, then only verified).

## 12. Hooks (plugin `wdm-agent`, `hooks/hooks.json`, PostToolUse on Write|Edit)

- `check-block-contract.sh` — on `blocks/*/block.json` (without `acf` key): name ↔ folder,
  `render` present, every `file:` has its source (`build/index.js` ← `src/index.js`,
  `build/style-index.css` ← `src/style.scss`, `build/index.css` ← `src/editor.scss`,
  `build/view.js` ← `src/view.js`), `README.md`, `version`. Violations → stderr, exit 2.
- `check-design-tokens.sh` — on `theme.json` of an FSE project (`theme_family: fse`): runs
  `sync-theme-json-tokens.js --check`; stale → show the diff to the dev and regenerate **only
  after confirmation** (`node ${CLAUDE_PLUGIN_ROOT}/shared/scripts/sync-theme-json-tokens.js
  {theme-root}` — also regenerates `assets/css/wp-global-styles.css`). **Pre-authorised
  exception**: a `styles.blocks["{prefix}/{slug}"]` entry (section padding default) that the
  README contract of a block requires, written by `fse-build`/`fse-block-edit`, is not a design
  change — run the sync at once without asking and log it in `## Log decisioni`. Every other
  theme.json change (palette, fonts, spacing, layout, custom) waits for the dev.

**File references inside the plugin.** A SKILL.md cites a file of its own skill with a path
relative to the skill folder (`scripts/setup.sh`); any other file of the plugin (`shared/…`,
another skill) with `${CLAUDE_PLUGIN_ROOT}/…`. `${CLAUDE_PLUGIN_ROOT}` is expanded by Claude
Code in SKILL.md bodies and in `hooks.json` commands, and exported to hook processes; it is
**not** set in the session shell, so never type it in a Bash command you compose yourself:
copy the already-expanded path from the skill text.
