---
name: fse-brief
description: Use to turn the designer's brief into the site contract for a wdm-theme FSE project — reads every file in `docs/brief/` (site root) and delivers, for one review, the site map, the tokens applied to theme.json, the tone, the plugins and the images, writing `DESIGN.md → ## Brief`, `## Pagine` and `## Telaio` — "leggi il brief", "partiamo dal brief", "prepara il brief del progetto", `/fse-brief`, or when `## Pagine` has only the Home created by the setup. Runs after `fse-theme-setup`, before `fse-kit`.
---

# FSE Brief — `docs/brief/` → the site contract (gate 1)

**MANDATORY first steps, in order:**
1. Read `${CLAUDE_PLUGIN_ROOT}/shared/fse-foundations.md` — §0 (guard), §1 (gates), §10 (hygiene
   and the decision charter), §11 (DESIGN.md: the `## Brief` template), §12 (hooks: the token sync
   inside this skill is pre-authorised).
2. Read `DESIGN.md → ## Project Config` and apply the guard of Step 0 **before any other file**
   (`theme_family` row: `fse` → go on; any other value **or row missing** → stop).
3. Read the project `CLAUDE.md` and the rest of `DESIGN.md` (`## Brief` if present, `## Design
   Tokens`, `## Telaio`, `## Pagine`, `## Domande aperte`).
4. Read `{site-root}/docs/brief/` — every file (Step 1).

`{site-root}` and `{theme-root}` from `DESIGN.md → Project Config`; `docs/brief/` lives in the
site root, next to `DESIGN.md`.

## Principle

The designer deposits what they have — brand and logo, the list or map of the pages, texts or
notes per page, images, visual references, plugins or integrations, company data — in
`docs/brief/`, in any form. The agent reads **all of it** and turns it into the contract the
kit sessions will design from: a site map with the menu placement, the tone, the tokens
applied to `theme.json` (so the existing block catalogue on `:8848` already shows the brand),
the plugins and the images. One review (gate 1 of fse-foundations §1), revisions until the
dev's ok in a later turn. What the brief does not say is decided under the charter (§10): map,
tone and tokens are **proposed** (decide and log); facts about the client are never invented
(`[da confermare]`).

## Step 0 — Guard and preconditions

1. `theme_family` = `fse` (fse-foundations §0); any other value **or row missing** → STOP with
   the §0 message. Nothing else is read after the stop.
2. `DESIGN.md` missing → stop: "progetto non inizializzato: prima `fse-theme-setup`".
3. `## Brief` already `Stato: approvato` → stop: the brief is closed; it reopens only on an
   explicit request ("rivediamo il brief"), which runs Step 1–4 again on the same section.
4. `docs/brief/` missing or empty → stop with this paragraph, verbatim:
   > La cartella `docs/brief/` è vuota. Deposita quello che hai, in qualunque formato (testo,
   > Markdown, PDF, immagini, Word): brand e logo (colori, font, loghi in SVG o PNG), la mappa o
   > l'elenco delle pagine, i testi o gli appunti per ogni pagina, le immagini da usare, i
   > riferimenti visivi (siti o schermate che ti piacciono), i plugin o le integrazioni richieste
   > (il form è Formidable), i contatti e i dati societari. Poi scrivi "leggi il brief".
5. Opening line of the report: "brief: {N} file in `docs/brief/` ({tipi}); DESIGN.md {con/senza}
   `## Brief`; pagine in `## Pagine`: {elenco}".

## Step 1 — Read the brief

Every file of `docs/brief/`, recursively. `README.md` (or `BRIEF.md`) first if present. Text
(`.md`, `.txt`, `.html`, `.csv`, `.json`) with Read; PDF and images (`.png`, `.jpg`, `.svg`) with
Read as well — images are looked at (logo, palette, references), not only listed; `.docx` with
the `docx` skill when the environment has it, else listed as not read. Any other format → listed
as not read, with its name. No file is modified, moved or copied yet. Write down, per file, what
it covers (brand, map, texts of page X, images, plugins, data): that is the `Fonti` column.

## Step 2 — Derive the contract

Apply the charter (§10): what the brief states is copied; what it implies is proposed and
logged; what it lacks about the client is `[da confermare]`.

1. **Map** — one row per page: title, URL with its parents (`/servizi/fisioterapia`), menu
   placement (`principale`, `footer {nome colonna}`, `nessuno`), one line of content, the brief
   files that cover it. The brief gives no map → propose one from the texts (the pages the texts
   describe, plus Home and Contatti) and log it. Keep the menu order of the brief; without one,
   Home first, Contatti last. The pages of the map are the only pages the kit sessions design.
2. **Tone** — language, person (tu/voi/lei), register, lexicon to use and to avoid, three example
   sentences in that voice. Derived from the texts and the references when the brief does not
   state it; logged as a proposal.
3. **Tokens** — `theme.json` of the theme: palette on the fixed roles of the family (`base`,
   `surface`, `main`, `accent`, `muted`, `border`, `dark`: the brief gives the values, the roles
   never change; a brand with fewer colours fills the roles with its tints, logged), typography
   (font files in the brief → `assets/fonts/` + `@font-face` as the theme does; a font named
   without files → Google Fonts woff2 latin subset if it exists, else `[da confermare]` and the
   theme's font stays), spacing/radius only when the brand asks for it. Then:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/shared/scripts/sync-theme-json-tokens.js {theme-root}   # DESIGN.md → Design Tokens + assets/css/wp-global-styles.css
   cd {theme-root} && npm run build
   ```
   The hook `check-design-tokens.sh` reports the tokens as stale while you edit: inside this
   skill the regeneration is **pre-authorised** (fse-foundations §12: the whole deliverable is
   under review) — run the sync, do not ask. The catalogue `https://localhost:8848/html/
   {prefix}-blocks.html` (browser-sync of `npm run dev`, §10) now shows the existing blocks in the
   brand: it is the object of the review. Check it at 1440/768/390 (contrast of `main` on `base`,
   headings in the new font); screenshots `.playwright-mcp/shots/brief-{w}.png`.
4. **Plugins** — one row per need: need, plugin, decision. `form di contatto | Formidable Forms |
   fisso (famiglia FSE)` always (installed by the setup). Any other plugin only when the brief
   names a need the theme cannot cover (multilingual, e-commerce, booking, SEO on request):
   propose it with the reason; nothing is installed before the ok (Step 4).
5. **Images** — the usable ones copied into `{theme-root}/assets/img/` with slug names (logo as
   `logo.svg`/`logo.png`, photos `{soggetto}.jpg`, optimised: longest side ≤ 2000px, JPEG quality
   ~80, PNG kept as PNG when it has transparency; a name already taken in `assets/img/` or
   `assets/fonts/` → suffix `-brief`, never overwrite), one row each: file, use (page/section),
   origin (brief file), note. Pages of the map without an image → row `[da confermare]` ("immagine per {pagina}: da fornire; il kit userà un
   placeholder"). `docs/brief/` itself is never modified.

## Step 3 — Write `DESIGN.md`

- `## Brief` (template of fse-foundations §11, between `## Design Tokens` and `## Telaio`; read
  the file, insert or replace only this section): `Stato: bozza · Fonte: \`docs/brief/\` (N file
  letti, M non letti: …)`, `### Mappa`, `### Tono`, `### Plugin`, `### Immagini`.
- `## Pagine`: one row per page of the map, `da progettare`, Kit and Blocchi empty, URL from the
  map; the setup's Home row is rewritten, `Catalogo blocchi` keeps its row.
- `## Telaio`: header, footer, form di default → `da progettare` (the telaio inherited from the
  starter is redesigned in the project's kit); templates row untouched.
- `## Log decisioni`: one row — the proposals made (map derived, tone, palette mapping, fonts)
  and why.

## Step 4 — Review (gate 1) and approval

The last message of the session hands over the brief: the map (as a table), the tone, the tokens
(catalogue URL and screenshots), the plugins proposed with the reason, the images table, the
files not read, and the **table of `[da confermare]`** with the default chosen for each ("Niente
da confermare" when empty). Then the turn ends.

Later turns: the dev's remarks are their decisions — apply them (Step 2–3 again on what changed),
log them as "richiesta del dev", hand over again. The dev's explicit ok →
- `## Brief` → `Stato: approvato YYYY-MM-DD`;
- plugins approved: `{wp-cli} plugin install {slug} --activate` (and `{wp-cli} language plugin
  install {slug} it_IT`) for each, listed in the log row;
- `## Log decisioni`: "brief approvato"; `## Domande aperte`: only the `[da confermare]` the dev
  left open. Next session: `fse-kit` (telaio).

## Stop conditions (the only ones)

Guard fails · `DESIGN.md` missing · `docs/brief/` missing or empty · `## Brief` already
`approvato` without an explicit request to reopen it.

## Never

Install a plugin before the dev's ok · write pages, kits, parts or blocks (that is `fse-kit`) ·
invent a fact about the client (phone, address, prices, names: `[da confermare]`) · modify,
move or delete anything in `docs/brief/` · change the palette roles of theme.json · ask mid-way
what the charter decides · git commands.

## Completion checklist

- [ ] Guard passed, `docs/brief/` read file by file (not-read files listed)
- [ ] Map, tone, tokens, plugins, images derived under the charter; `[da confermare]` only for facts
- [ ] `theme.json` edited, sync run, `npm run build` exit 0, catalogue checked at 3 widths with screenshots
- [ ] `DESIGN.md`: `## Brief` (`Stato: bozza`), `## Pagine` `da progettare`, `## Telaio` `da progettare`, log row
- [ ] Review delivered with the `[da confermare]` table; turn ended
- [ ] On the dev's ok (later turn): `Stato: approvato`, plugins installed, log row
