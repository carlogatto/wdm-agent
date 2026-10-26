---
name: fse-menu-build
description: Use to create or realign the WordPress navigation (`wp_navigation` posts and the `ref` of the `core/navigation` blocks in header and footer) from the kit header/footer menus for a wdm-theme FSE project — "popola il menu", "crea il menu WP", "allinea il menu al kit", "il menu mostra il contenuto di una pagina", or when the frontend shows a page list instead of the designed menu. Runs once the main pages exist in WP and is re-run whenever the kit menu or the pages change. Not for wdm-starter projects (`dev-menu-build`).
---

# FSE Menu Build — kit `<nav><ul>` → `wp_navigation` + `ref` in the parts

**MANDATORY first steps, in order:**
1. Read `${CLAUDE_PLUGIN_ROOT}/shared/fse-foundations.md` — §0 (guard), §7 (menu: `ref` in both
   parts, overlay, `page-list` forbidden), §8 (WP-CLI), §10.
2. Read `DESIGN.md → ## Project Config` and apply the guard of Step 0 **before any other file**
   (`theme_family` row: `fse` → go on; any other value **or row missing** → stop); then the rest
   of `DESIGN.md` (`{wp-cli}`, `## Pagine`, `## Navigazione`, `## Domande aperte`).
3. Read `parts/header.html`, `parts/footer.html` and the kit partials with the menus
   (`src/kit/main/header/header-parts/_header-content.kit`,
   `src/kit/main/footer/footer-parts/_footer-content.kit`).

All paths are relative to `{theme-root}` from `DESIGN.md → Project Config`.

## Principle

**The kit `<nav><ul>` is the single source of truth** for labels, order and hierarchy;
**WordPress is the only state** (no progress log); **one write path**, the script
`scripts/wp-navigation.php` run with `{wp-cli} eval-file`; **diff, then ask** — a menu that
already exists is never rebuilt in the turn that computed its diff.

In a block theme the menu is content: a `wp_navigation` post (`home-link`, `navigation-link`,
`navigation-submenu` blocks) referenced by `"ref":<id>` on every `core/navigation` block of the
parts. Core does not check what the `ref` points to: a wrong id prints a **page's content**
inside the menu, a missing id an empty menu, no `ref` an auto-generated `page-list`. This is
why the `ref` must be rewritten in **both** `parts/header.html` and `parts/footer.html` (and
in any other part with a navigation block) every time the post changes.

## Step 0 — Guard and preconditions

1. `theme_family` = `fse` (fse-foundations §0); any other value **or row missing** → STOP with
   the §0 message (wdm-starter: `dev-menu-build`). Nothing else is read after the stop.
2. `Project Config` complete, `{wp-cli}` present (put it in a scratchpad script).
3. The kit partials exist and contain `<nav aria-label="…"><ul>…</ul></nav>` (the aria-label is
   the menu title; no label → "Menu {part}"); the parts contain a `<!-- wp:navigation {…} -->`.
4. The pages the kit links to exist in WP (the skill runs **after** the main pages are built):
   missing ones become orphans (below) — if **every** label is orphan the pages are not there
   yet: stop and say so (except in the setup run, whose plan is just Home).

## Step 1 — dump

```bash
{wp-cli} eval-file ${CLAUDE_PLUGIN_ROOT}/skills/fse-menu-build/scripts/wp-navigation.php dump > {scratchpad}/nav-before.json
```
`parts` (ref per part), `navigations` (every `wp_navigation` with its item tree and raw
content), `pages` (any status), `front_page`. Keep it: it is the "before" of the report.

## Step 2 — plan from the kit

```bash
{wp-cli} eval-file ${CLAUDE_PLUGIN_ROOT}/skills/fse-menu-build/scripts/wp-navigation.php plan \
  header={theme-root}/src/kit/main/header/header-parts/_header-content.kit \
  footer={theme-root}/src/kit/main/footer/footer-parts/_footer-content.kit > {scratchpad}/nav-plan.json
```
For every `<nav>` of every kit, in order: the `<ul>` items (`<li><a>` label; nested `<ul>` →
children) resolved to pages: label `Home` or `href="/"` → `home-link`; a **published** page with
the same title (case/entities/whitespace-insensitive) → `page: <id>`; else a published page with
slug = slugified label; else **orphan** (custom link `#`, kept so the structure is complete and
visible in the Site Editor). Identical lists in two parts → **one** menu with `parts:
["header","footer"]` (same `ref` in both); different lists → one menu per part. Warnings on
stderr: orphans (with the draft candidate if any), ambiguous titles. Read them:
- ambiguous (several published pages with the same title) → **stop** and ask which;
- orphan → fine, it goes to `DESIGN.md → Domande aperte`;
- a page the dev wants in the menu but absent from the kit → the kit is the truth: add it to the
  kit first (fse-kit), not to the plan.
Edit the plan only to resolve what the dev answers; never to add items the kit lacks.

Plan format (`items[].label`, `home: true` | `page: <id>` | nothing = orphan, `children`):
```json
{ "menus": [ { "title": "Menu principale", "parts": [ "header", "footer" ],
  "items": [ { "label": "Home", "home": true }, { "label": "Servizi", "page": 12, "children": [ { "label": "Fisioterapia", "page": 15 } ] }, { "label": "Blog" } ] } ] }
```

## Step 3 — apply: diff, then ask

```bash
{wp-cli} eval-file ${CLAUDE_PLUGIN_ROOT}/skills/fse-menu-build/scripts/wp-navigation.php apply {scratchpad}/nav-plan.json
```
For every menu of the plan the script finds the post (the `ref` of the first listed part if it
is a `wp_navigation`, else by title), serializes the items with core's own
`serialize_block_attributes()` and:
- post **missing** → created, `ref` written in every listed part → done;
- post present and content **identical** → "0 differenze", only the `ref` is (re)written if a
  part has a different or missing one → done;
- post present and content **different** → prints the diff and exits **3 without writing**.

### The diff stop — no exceptions
**Violating the letter of this rule is violating its spirit.** When `apply` exits 3, the turn
**ends** with the diff and the question. `apply … confirm` runs only in a **later turn**, after
a message from the dev that answers that diff. Nothing else counts as confirmation:
- "allinea il menu al kit" / "aggiorna il menu" is the **trigger**, not the confirmation;
- a note in `DESIGN.md → Domande aperte` saying the skill will be re-run is not a confirmation;
- a one-line diff is shown like any other diff; a menu that contains only kit items ("nothing
  to lose") is still shown and still waits;
- items the dev added by hand in the Site Editor are part of the diff: `apply … confirm`
  rebuilds the content from the plan, so an item the dev wants to keep must be in the kit first.

| Rationalization | Reality |
|---|---|
| "The request already implied the rebuild" | The request selects the skill; the diff is what the dev has not seen yet |
| "The diff is one line, asking is overhead" | A one-line diff is the cheapest confirmation there is |
| "The menu has only kit items, nothing can be lost" | The rule exists for the run where that is false and nobody checked |
| "fse-build is autonomous, it must not stop" | The telaio session stops at the diff like any other: that is its deliverable for the turn |

Red flags — stop and end the turn: you are about to run `apply … confirm` on a menu whose diff
you computed in this same turn · you are writing "ho applicato senza fermarmi" in a report ·
you are explaining why confirmation was not needed this time.

`parts=<dir>` (optional) points the `ref` rewrite to another directory — only for tests and dry
runs, never for the real theme.

## Step 4 — Verify

```bash
{wp-cli} eval-file ${CLAUDE_PLUGIN_ROOT}/skills/fse-menu-build/scripts/wp-navigation.php dump > {scratchpad}/nav-after.json
```
- `navigations[].items` of the applied menus = plan (labels, order, children, page ids);
- `parts.header` and `parts.footer` (and every part listed) = the menu id — **both**, always;
  `grep -n '"ref":' parts/*.html` shows the same number;
- frontend `curl -sk {local-url}`: `nav.wp-block-navigation` with the kit labels, no
  `wp-block-page-list`, `current-menu-item` on the current page, no `Fatal|Warning`; the footer
  navigation prints the same items; orphans render as links to `#`;
- Site Editor (optional, Playwright): header and footer parts open without invalid blocks and
  show the menu by name.
No `npm run build` is needed (parts are not compiled); the `html/` kit is unaffected.

## Step 5 — Documentation (no confirmation asked)

- `DESIGN.md → ## Navigazione`: table `menu (id) | parts | voci (primo livello + figli) | orfane
  | data`.
- `DESIGN.md → ## Domande aperte`: one line per orphan (menu, label, draft candidate if any).
- `DESIGN.md → ## Log decisioni`: one row (created/updated/0 differenze per menu, refs written).
- Theme README "Telaio → Menu" if the project documents the menu id.

## Final report

Per menu: created / updated / 0 differenze, item counts, orphans; `ref` per part before → after;
curl check result; every point where the skill stopped to ask. A skipped or failed step is said
explicitly. Never the password (none is needed: the script runs through WP-CLI).

## Stop conditions (the only ones)

Guard fails · a label with several published candidates · every label orphan (pages not built
yet, outside setup) · kit partial without `<nav><ul>` or part without a navigation block ·
`dump`/`plan` failing ({wp-cli} broken) · **a menu whose diff the dev has not confirmed in a
later turn** (exit 3) · a request to delete a `wp_navigation` post.

## Never

Guess a page for a label · add to the plan items the kit does not have · rewrite kit labels ·
run `apply … confirm` in the turn that computed the diff · write through the Site Editor,
Playwright, `wp post update` by hand or SQL · leave the `ref` different between header and
footer when the plan lists both · use `page-list` · delete a `wp_navigation` without the dev ·
git commands.

## Completion checklist

- [ ] Guard, `{wp-cli}` present, kit partials with `<nav><ul>`, parts with navigation blocks
- [ ] `dump` saved; `plan` generated from the kit, warnings read, ambiguities asked
- [ ] `apply` run; for every existing menu with differences the turn ended with the diff and the dev confirmed in a later turn before `apply … confirm`
- [ ] `dump` after = plan; `ref` identical in header AND footer (and every listed part)
- [ ] curl check: labels present, no `page-list`, no PHP errors
- [ ] DESIGN.md (Navigazione, Domande aperte, Log decisioni) updated; final report delivered
