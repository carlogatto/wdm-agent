---
name: fse-menu-build
description: 'Use to create or realign the WordPress navigation (`wp_navigation` posts and the `ref` of the `core/navigation` blocks in header and footer) from the kit header/footer menus for a wdm-theme FSE project — "popola il menu", "crea il menu WP", "allinea il menu al kit", "il menu mostra il contenuto di una pagina", or when the frontend shows a page list instead of the designed menu. Runs inline as the last step of the `fse-build` site build and stays available on its own for maintenance, whenever the kit menu or the pages change. Not for wdm-starter projects (`dev-menu-build`).'
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
`scripts/wp-navigation.php` run with `{wp-cli} eval-file`; **WordPress never loses anything
without an ok** — additions and reorders are written at once, a menu that would lose an item is
never rebuilt in the turn that computed its diff.

In a block theme the menu is content: a `wp_navigation` post (`home-link`, `navigation-link`,
`navigation-submenu` blocks) referenced by `"ref":<id>` on every `core/navigation` block of the
parts. Core does not check what the `ref` points to: a wrong id prints a **page's content**
inside the menu, a missing id an empty menu, no `ref` an auto-generated `page-list`. This is
why the `ref` must be rewritten in **both** `parts/header.html` and `parts/footer.html` (and
in any other part with a navigation block) every time the post changes.

## Step 0 — Guard and preconditions

1. `theme_family` = `fse` (fse-foundations §0); any other value, row missing or
   `DESIGN.md` missing → STOP with the §0 message for that case. Nothing else is read after the stop.
2. `Project Config` complete, `{wp-cli}` present (put it in a scratchpad script).
3. The kit partials exist and contain `<nav aria-label="…"><ul>…</ul></nav>` (the aria-label is
   the menu title; no label → "Menu {part}"); the parts contain a `<!-- wp:navigation {…} -->`.
4. The pages the kit links to exist in WP (the skill runs **after** the main pages are built):
   missing ones become orphans (below) — if **every** label is orphan the pages are not there
   yet: stop and say so (except in the setup run, whose plan is just Home).

## Step 1 — dump

```bash
{wp-cli} eval-file "${CLAUDE_PLUGIN_ROOT}/skills/fse-menu-build/scripts/wp-navigation.php" dump > "{scratchpad}/nav-before.json"
```
`parts` (ref per part), `navigations` (every `wp_navigation` with its item tree and raw
content), `pages` (any status), `front_page`. Keep it: it is the "before" of the report.

## Step 2 — plan from the kit

```bash
{wp-cli} eval-file "${CLAUDE_PLUGIN_ROOT}/skills/fse-menu-build/scripts/wp-navigation.php" plan \
  "header={theme-root}/src/kit/main/header/header-parts/_header-content.kit" \
  "footer={theme-root}/src/kit/main/footer/footer-parts/_footer-content.kit" > "{scratchpad}/nav-plan.json"
```
For every `<nav>` of every kit, in order: the `<ul>` items (`<li><a>` label; nested `<ul>` →
children) resolved to pages: label `Home` or `href="/"` → `home-link`; a **published** page with
the same title (case/entities/whitespace-insensitive) → `page: <id>`; else a published page with
slug = slugified label; else **orphan** (custom link `#`, kept so the structure is complete and
visible in the Site Editor). Identical lists in two parts → **one** menu with `parts:
["header","footer"]` (same `ref` in both); different lists → one menu per part. Warnings on
stderr: orphans (with the draft candidate if any), ambiguous titles. Read them:
- ambiguous (several published pages with the same title) → the script already treats the label
  as an orphan: go on, and report it as one question with a proposal at the end;
- orphan → fine, it goes to `DESIGN.md → Domande aperte`;
- a page the dev wants in the menu but absent from the kit → the kit is the truth: add it to the
  kit first (fse-kit), not to the plan.
Edit the plan only to resolve what the dev answers; never to add items the kit lacks.

Plan format (`items[].label`, `home: true` | `page: <id>` | nothing = orphan, `children`):
```json
{ "menus": [ { "title": "Menu principale", "parts": [ "header", "footer" ],
  "items": [ { "label": "Home", "home": true }, { "label": "Servizi", "page": 12, "children": [ { "label": "Fisioterapia", "page": 15 } ] }, { "label": "Blog" } ] } ] }
```

## Step 3 — apply: write what adds, ask for what would be lost

```bash
{wp-cli} eval-file "${CLAUDE_PLUGIN_ROOT}/skills/fse-menu-build/scripts/wp-navigation.php" apply "{scratchpad}/nav-plan.json"
```
For every menu of the plan the script finds the post (the `ref` of the first listed part if it
is a `wp_navigation`, else by title), serializes the items with core's own
`serialize_block_attributes()` and:
- every listed part is checked **before anything is written**: a part that does not exist, has
  no navigation block, or has several and none with the kit's `aria-label` → exit **1**, no menu
  created;
- post **missing** → created, `ref` written in every listed part → done;
- post present and content **identical** → "0 differenze", only the `ref` is (re)written if a
  part has a different or missing one → done;
- post present, content different, **nothing lost** (items added, reordered, an orphan that now
  finds its page) → prints the diff and writes: "aggiornato". No question: the diff goes in the
  log row;
- post present and WordPress **would lose something** → prints the diff and the line `WordPress
  perderebbe: …`, exits **3 without writing**. What counts as a loss: an item of the menu that
  the plan does not have (recognised by its label), an item whose destination was chosen by hand
  (a page linked from the Site Editor, a typed address) and that the plan would change, a block
  that is not a menu item (a search field added from the Site Editor). An orphan (`#`) that the
  plan now links to its page is not a loss;
- the menu post is **open in the editor** by a user → exit **4 without writing**: say who has
  it open, ask the dev to close the tab, relaunch `apply` in a later turn.

### The loss stop — no exceptions
**Violating the letter of this rule is violating its spirit.** The script decides what is a
loss, not the agent. When `apply` exits 3, the turn **ends** with the diff and the question.
`apply … confirm` runs only in a **later turn**, after a message from the dev that answers that
diff. Nothing else counts as confirmation:
- "allinea il menu al kit" / "aggiorna il menu" is the **trigger**, not the confirmation;
- a note in `DESIGN.md → Domande aperte` saying the skill will be re-run is not a confirmation;
- items the dev added by hand in the Site Editor are exactly what exit 3 protects: `apply …
  confirm` rebuilds the content from the plan, so an item the dev wants to keep must be in the
  kit first.

| Rationalization | Reality |
|---|---|
| "The request already implied the rebuild" | The request selects the skill; what would be lost is what the dev has not seen yet |
| "It is one item, asking is overhead" | A one-line question is the cheapest confirmation there is |
| "That item is obviously a leftover" | The script cannot know who added it, and neither can you |
| "fse-build is autonomous, it must not stop" | The site build closes its run with the diff in the final report, like a deletion: the dev answers, `confirm` runs in a later turn |

Red flags — stop and end the turn: you are about to run `apply … confirm` on a menu whose diff
you computed in this same turn · you are writing "ho applicato senza fermarmi" in a report about
an exit 3 · you are explaining why confirmation was not needed this time.

`parts=<dir>` (optional) points the `ref` rewrite to another directory — only for tests and dry
runs, never for the real theme.

## Step 4 — Verify

```bash
{wp-cli} eval-file "${CLAUDE_PLUGIN_ROOT}/skills/fse-menu-build/scripts/wp-navigation.php" dump > "{scratchpad}/nav-after.json"
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
- `DESIGN.md → ## Domande aperte`: one line per orphan (menu, label, draft candidate if any)
  and, on a standalone run, one `⏳` line per menu whose loss waits for `confirm` or that was
  open in the editor (exit 4).
- `DESIGN.md → ## Log decisioni`: one row (created/updated/0 differenze per menu, refs written).
- Theme README "Telaio → Menu" if the project documents the menu id.

## Final report

Standalone run: the handover message of fse-foundations §10 — *Esito* (`⚠️ chiuso, con attese`
when a loss waits for `confirm` or a menu was open in the editor); *Cosa è cambiato*: per menu
one line, created / updated / 0 differenze, and the parts whose `ref` changed; *Cosa aspetta
te*: each exit 3 as one item (the items WordPress would lose, by name) and each orphan with its
consequence and remedy (publish the draft, create the page, or remove the label from the kit);
*Prossimo passo*: what the dev writes to confirm each loss; `apply … confirm` runs in the turn
that follows the answer, in this conversation, with no prompt to paste. Item counts,
`ref` before → after, the curl check and a skipped or failed step go to the `## Log decisioni`
row (a failed step is also one line in *Esito*). Inside `fse-build` the same content enters the
build's closing report.

## Stop conditions (the only ones)

Guard fails · every label orphan (pages not built yet, outside setup) · kit partial without
`<nav>` and a `<ul>` inside it, or part without the navigation block the kit names (`apply`
exit 1) · `dump`/`plan` failing ({wp-cli} broken) · **a menu that would lose something and that
the dev has not confirmed in a later turn** (exit 3) · a menu open in the editor (exit 4) · a
request to delete a `wp_navigation` post.

## Never

Guess a page for a label · add to the plan items the kit does not have · rewrite kit labels ·
run `apply … confirm` in the turn that computed the diff · write through the Site Editor,
Playwright, `wp post update` by hand or SQL · leave the `ref` different between header and
footer when the plan lists both · use `page-list` · delete a `wp_navigation` without the dev ·
`git push`, or any git command beyond the fse-foundations §10 rule.

## Completion checklist

- [ ] Guard, `{wp-cli}` present, kit partials with `<nav><ul>`, parts with navigation blocks
- [ ] `dump` saved; `plan` generated from the kit, warnings read
- [ ] `apply` run; additions and reorders written at once; for every menu that would lose something (exit 3) the turn ended with the diff and the dev confirmed in a later turn before `apply … confirm`
- [ ] `dump` after = plan; `ref` identical in header AND footer (and every listed part)
- [ ] curl check: labels present, no `page-list`, no PHP errors
- [ ] DESIGN.md (Navigazione, Domande aperte, Log decisioni) updated; handover message (§10) delivered
- [ ] Commit of the aligned menus, on a standalone run (inside `fse-build` the build commits) (fse-foundations §10: main branch, files added by name); the push is the dev's
