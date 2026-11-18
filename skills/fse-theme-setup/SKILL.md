---
name: fse-theme-setup
description: 'Use to scaffold a new client project from wdm-theme for a wdm-theme FSE project (block theme, native Gutenberg blocks) — when the dev starts a new site from the wdm-theme repo, invokes `/fse-theme-setup`, or asks "nuovo progetto da wdm-theme", "nuovo progetto dal tema base", "inizializza il tema per il cliente X" — and to prepare on another computer a project already set up and cloned there ("prepara questo progetto su questo computer"). Not for wdm-starter projects (those use `new-project-setup`) and never to set up again a project that already runs on this computer.'
---

# FSE Theme Setup — wdm-theme → new client project

**MANDATORY first steps, in order:**
1. Read `${CLAUDE_PLUGIN_ROOT}/shared/fse-foundations.md` — §0 (guard), §2 (structure), §7
   (telaio: menu `ref`, front page, permalinks, `WP_DEVELOPMENT_MODE`), §8 (WP-CLI), §9 (the
   login without a password), §10 (git, the handover message), §11 (DESIGN.md format: this skill
   creates it).
2. Read `{site-root}/DESIGN.md → ## Project Config` **if it exists** — the guard of Step 0
   (`theme_family`: a value other than `fse` = wdm-starter project → stop) comes before anything
   else; this skill is the one that creates the row when DESIGN.md does not exist yet.
3. Read `${CLAUDE_PLUGIN_ROOT}/skills/fse-menu-build/SKILL.md` — the `wp_navigation` is created here with
   its script.

All paths are absolute; `{site-root}` = the conversation's working directory (`pwd`),
`{theme-root}` = `{site-root}/wp-content/themes/{slug}` after the rename.

Two Node scripts do the deterministic work: `scripts/mamp.js` (Step 1b: finds MAMP PRO, WP-CLI,
the database) and `scripts/setup.js` (Step 3a: the rename). Never do by hand what they do. Both
can be relaunched with the same values: they resume, and report what is already done.
Start immediately with Step 0 — no extra trigger phrase required.

---

## Step 0 — Guard and information

**Guard.** `{site-root}/DESIGN.md`:
- exists with `theme_family` ≠ `fse`, **or without the row** (every wdm-starter project predates
  it) → **STOP** with the fse-foundations §0 message for that case (a wdm-starter project, or a
  `DESIGN.md` that lost the row);
- exists with `theme_family: fse`, `wp-content/themes/wdm-theme` is gone and WordPress is
  installed here (`{site-root}/wp-config.php` exists) → the setup already ran: offer only the
  verification of Phase 5, never a setup restarted from Phase 1;
- exists with `theme_family: fse`, `wp-content/themes/wdm-theme` is gone and there is **no**
  `wp-config.php` → the project was set up on another computer and cloned here: go to "A project
  cloned on another computer" at the end of this file. Never `setup.js`, never Phase 3a;
- exists with `theme_family: fse`, `wp-content/themes/wdm-theme` still present and
  `{site-root}/SETUP.md` present → an earlier session stopped mid-setup: **resume**. Every value
  comes from `DESIGN.md → Project Config` (ask nothing), `SETUP.md` and `DESIGN.md` stay as they
  are, the work restarts from the first unchecked step of `SETUP.md`. A checked step is not rerun; an unchecked `mamp.js` or `setup.js` step is
  simply relaunched with the same values (both resume from where they stopped).
- does not exist, or exists as the copy shipped by the wdm-theme repo (its `{prefix}` is
  `wdm`) → proceed: the skill creates/rewrites `## Project Config`.

**Anti-scaffold.** `{site-root}/wp-content/themes/wdm-theme/` must exist (clone or ZIP of the
wdm-theme repo). Missing → stop: the skill renames the starter, it does not create a theme.

**One opening message, then no more questions.** Four values only the dev knows; everything
else has a default the message declares. Values already given in the dev's request are not asked
again; on a resume they all come from `DESIGN.md`. Send this, adapted to what is already known,
and wait for the answer — it is the only wait of the whole setup:

> Per creare il progetto mi servono quattro cose:
> 1. **Nome del progetto**, in minuscolo e senza spazi (es. `pincopallino`): diventa il nome
>    del sito locale, del database e della cartella del tema.
> 2. **Prefisso**: tre o quattro lettere minuscole (es. `pnc`), diverse da `wdm`. Stanno
>    davanti ai nomi dei blocchi e delle classi del tema.
> 3. **Titolo del progetto** (es. `Pinco Pallino`): il nome che si legge nel sito e nell'editor.
> 4. **La tua email**, per il tuo utente di WordPress.
>
> Il resto lo imposto io, se non mi dici altro: indirizzo locale `https://NOME.local:8890/`,
> titolo del sito uguale al titolo del progetto, il tuo utente di WordPress con il nome che
> precede la `@` della tua email.
>
> Prima di rispondere controlla due cose in MAMP PRO: che esista un sito `NOME.local` con SSL
> attivo e come cartella (**Site Folder**) questa cartella, e che i server siano avviati
> (**Start**). I passi sono nel README del plugin wdm-agent, «Il primo progetto».
> Quando rispondi parto, e proseguo da solo fino alla fine.

From the answer:

1. **Project slug** — kebab-case (e.g. `pincopallino`): MAMP folder, local URL, DB name, theme
   folder, text domain.
2. **Prefix** — lowercase, alphanumeric, not `wdm` (e.g. `pnc`): replaces `wdm` in block names
   (`pnc/hero`), folders (`pnc-block-hero`), functions (`pnc_`), classes (`pnc-header`),
   categories.
3. **Project title** — human name (e.g. `Pinco Pallino`): Theme Name, block/pattern category
   title, kit/footer texts (replaces "WDM Theme"), and the site title.
4. **Dev email** — `wp core install`; dev admin username = the part before `@`.

Defaults, used unless the dev says otherwise: text domain `{slug}`; local URL
`https://{slug}.local:8890/`; site title = project title; agent admin username
`{prefix}adminclaude`. No password is chosen or stored: WordPress generates the dev's one,
shown **once**; the agent's user has a random one nobody sees and logs in with a temporary
session (Step 2c, fse-foundations §9). `setup.js` validates slug, prefix and title before
touching the disk (Step 3a): a value it refuses is the only reason to ask again, and only that
value.

Never ask where MAMP is, which PHP it runs or how the database is reached: `mamp.js` (Step 1b)
finds all of it and writes `{db-socket}` and `{wp-cli}` in `DESIGN.md`. Derived: DB
`{slug}-db` (root/root, MAMP's default user), `{db-host}` = the `dbHost` the script prints.
`{wp-cli}` is the full command (MAMP PHP + `display_errors=stderr` + phar with absolute path +
`--path`, fse-foundations §8): WP-CLI runs on the newest MAMP PHP that starts the phar without
warnings, which can differ from the PHP of the host — it is intended (a newer PHP makes the
phar print `Deprecated` lines, and one of those in a captured stdout breaks the kit's global
CSS). Put `{wp-cli}` in a script file in the scratchpad for the session (zsh does not expand a
command stored in a string variable).

## Progress tracking

Create `{site-root}/SETUP.md` (checklist below) and write `{site-root}/DESIGN.md → ## Project
Config` with the FSE template of fse-foundations §11 (`theme_family: fse`, Identity, Paths with
`{site-root}` and `{theme-root}`, `## Local Development`; the rows `{db-socket}` and `{wp-cli}`
are written by `mamp.js` in Step 1b). If the repo shipped a `DESIGN.md`
(wdm-theme's own, with Telaio/Pagine/Blocchi tables of the starter), **integrate**: rewrite the
Project Config values, keep the tables (`setup.js` renames `wdm` → `{prefix}` in them), leave
`## Design Tokens` to the sync script.

```markdown
# Setup: {slug}

## Phase 1 — Environment
- [ ] Step 1a — project folder and MAMP host verified
- [ ] Step 1b — MAMP found, database created, {wp-cli} written in DESIGN.md

## Phase 2 — WordPress
- [ ] Step 2a — WordPress core present
- [ ] Step 2b — wp-config.php written
- [ ] Step 2c — WordPress installed, agent admin user created

## Phase 3 — Rename and build
- [ ] Step 3a — setup.js completed, no wdm/WDM residuals
- [ ] Step 3b — npm install + npm run build exit 0

## Phase 4 — Activation and site data
- [ ] Step 4a — Theme activated
- [ ] Step 4b — the four wp_navigation created, ref written in header AND footer
- [ ] Step 4c — Home page, show_on_front=page, permalinks
- [ ] Step 4d — Design Tokens + wp-global-styles.css synced
- [ ] Step 4e — Checks: home 200, Site Editor 200, debug.log empty
- [ ] Step 4f — Formidable installed

## Phase 5 — Handover
- [ ] Step 5a — DESIGN.md tables, CLAUDE.md and site-root README.md verified
- [ ] Step 5b — Git repo and first commit (agent), handover
```

Rules: update `SETUP.md` after every step, before the next. **No step waits for the dev**: after
the opening message the setup runs to the end. It stops only when a script or a check says that
something only the dev can fix is missing (MAMP PRO not installed, servers stopped, host
missing, git without an identity): send the message verbatim, STOP, and resume from that step
after their **fatto**. Git follows fse-foundations §10 (the agent commits, the dev pushes; a
missing `.git` is expected until Step 5b); re-read this SKILL.md from disk at every phase
boundary.

---

## Phase 1 — Environment

### Step 1a — Folder and MAMP host `[AGENT]`
The folder is checked by the guard (anti-scaffold). The host is checked by asking it:
```bash
curl -sk -o /dev/null -w '%{http_code}' "{local-url}"
```
Any HTTP code (403, 404, 500: WordPress is not there yet) → the host exists, go on. `000` → the
host does not answer: send this and STOP; after **fatto**, check again.

> Non riesco a raggiungere `{local-url}`. In MAMP PRO controlla che esista il sito
> `{slug}.local` (sezione **Sites**, pulsante **+**, tipo **Empty**), che la sua cartella
> (**Site Folder**) sia `{site-root}`, che nella scheda **SSL** sia attivo SSL, poi premi
> **Save** e **Start**. Quando è fatto scrivimi **fatto**.

### Step 1b — MAMP, WP-CLI and database `[AGENT]`
```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/fse-theme-setup/scripts/mamp.js" --site "{site-root}" --db "{slug}-db"
```
The script finds MAMP and its PHP versions, downloads `wp-cli.phar` into the site root if it is
missing, picks the PHP for WP-CLI, checks that MAMP's database answers, creates `{slug}-db`
(`utf8mb4_unicode_ci`) if it does not exist, writes `{db-socket}` and `{wp-cli}` in
`DESIGN.md → Project Config → Paths` and proves the written command. Read its exit code:
- **0** → it prints a JSON summary: keep `dbHost` (it is `{db-host}` of Step 2b). `{wp-cli}` is
  now the row of `DESIGN.md`.
- **1** → something only the dev can fix. The message says what, in plain words (MAMP PRO not
  installed, servers not started, a database with that name that belongs to another project,
  no internet for the download): send it to the dev **verbatim**, STOP, and relaunch the same
  command after their **fatto**. A database that already has tables is never emptied or
  deleted by the agent.
- **2** → wrong arguments: fix the command.

## Phase 2 — WordPress

### Step 2a — WordPress core `[AGENT]`
```bash
[ -d "{site-root}/wp-includes" ] || {wp-cli} core download --locale=it_IT --skip-content   # no default themes/plugins
```
`wp-cli.phar` (downloaded in Step 1b) is gitignored by the repo whitelist (verify the line exists).

### Step 2b — wp-config.php `[AGENT]`
```bash
{wp-cli} config create --dbname={slug}-db --dbuser=root --dbpass=root --dbhost={db-host} --dbcharset=utf8mb4 --dbprefix={prefix}_ --extra-php <<'PHP'
define( 'WP_DEBUG', true );
define( 'WP_DEBUG_DISPLAY', false );
define( 'WP_DEBUG_LOG', true );
define( 'WP_DEVELOPMENT_MODE', 'theme' ); // niente cache di theme.json e pattern durante lo sviluppo
define( 'WP_MEMORY_LIMIT', '1024M' );
define( 'AUTOMATIC_UPDATER_DISABLED', true );
PHP
```
WP-CLI writes the file with fresh secret keys. Without `WP_DEVELOPMENT_MODE` WP caches the
pattern list and theme.json: patterns added later do not appear. An existing `wp-config.php` is
never overwritten (the command refuses): read it and complete it by hand.

### Step 2c — Install + agent user `[AGENT]`
```bash
{wp-cli} core install --url={local-url} --title="{site-title}" --admin_user={dev-admin} --admin_email={dev-email} --skip-email   # prints "Admin password: …"
{wp-cli} option update siteurl {local-url-without-trailing-slash} && {wp-cli} option update home {local-url-without-trailing-slash}   # wp-cli may append the path
{wp-cli} user create {agent-admin-user} {agent-admin-user}@{slug}.local --role=administrator --porcelain   # prints only the user ID
```
`core install` without `--admin_password` generates the dev's password and prints it: tell it
to the dev **once** in chat, never write it anywhere. `user create … --porcelain` gives the
agent user a random password that is never printed: nobody needs it, the agent enters the
backend with a temporary session that is always revoked (fse-foundations §9). No `.env`, no
password file of any kind. Write the agent username in `DESIGN.md → Project Config →
{agent-admin-user}`.

## Phase 3 — Rename and build `[AGENT]`

### Step 3a — setup.js
```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/fse-theme-setup/scripts/setup.js" \
  --prefix "{prefix}" --slug "{slug}" --textdomain "{text-domain}" --title "{project-title}" \
  --local-url "{local-url}" --target "{site-root}"
```
It checks every value before touching the disk (exit 2 lists what to correct, nothing is
changed: ask the dev only for the value it names). Then, in every text file of the theme, it
replaces `wdm-theme` → text domain, `WDM Theme` → title (written correctly inside PHP strings,
HTML and block attributes: a title like `L'Atelier` is fine) and `wdm` → prefix (block names,
parent/context, theme.json `styles.blocks`, pattern slugs and `Categories`, BEM classes of
parts and kit, handles like `{prefix}-swiper`); the names `wdm-agent`, `wdm-starter` and
`carlogatto/wdm-theme` stay. It renames `blocks/{prefix}-block-*`, kit and pattern files; sets
the `build.js` proxy; fixes the site-root `.gitignore`, `README.md` and `DESIGN.md`; removes
the generated files (`build/`, `html/`, compiled css/js — rebuilt in 3b) and the demo page kits
of the base theme (only `{prefix}-blocks.kit` and `{prefix}-telaio.kit` stay in `src/kit/`);
in the parts it sets `formId` to 0 and drops the `ref` of the navigation blocks (ids of the
base theme's database: Step 4b writes the new ones); last, it renames the theme folder. In the
site root it removes `docs/superpowers/` (the base theme's own working documents) and creates
`docs/brief/` (a brief already there is left as it is).
`CLAUDE.md` is not touched (placeholders resolved from DESIGN.md).

Exit 0 → done. Exit 1 → it stopped half-way or found `wdm` references it could not replace: the
message says what to do; then relaunch **the same command**, it resumes (a finished rename only
redoes the final check). Exit 3 → the base theme is not in `wp-content/themes/wdm-theme`, or
both `wdm-theme` and `{slug}` are there: the message says which, nothing was changed.

### Step 3b — Dependencies and build
```bash
cd "{theme-root}" && npm install && npm run build
```
Exit 0; `blocks/*/build/index.asset.php` for every block, `html/{prefix}-blocks.html`,
`assets/css/main.css`.

## Phase 4 — Activation and site data `[AGENT]`

### Step 4a — Activate
`{wp-cli} theme activate {slug}` → `{wp-cli} theme list --status=active`.

### Step 4b — wp_navigation + ref, before the first render
The navigation blocks of the parts have no `ref` after Step 3a (core does not check the post
type of a `ref`: an id of another database would print a page inside the menu). The theme
ships four menus, one per `<nav aria-label>` of the kit: "Menu principale" in the header,
"Pagine", "Demo" and "Policy" in the footer. Take the plan from the kit and apply it: it
creates the four `wp_navigation` posts and writes each `ref` in the navigation block with the
same `ariaLabel`:
```bash
{wp-cli} eval-file "${CLAUDE_PLUGIN_ROOT}/skills/fse-menu-build/scripts/wp-navigation.php" plan "header={theme-root}/src/kit/main/header/header-parts/_header-content.kit" "footer={theme-root}/src/kit/main/footer/footer-parts/_footer-content.kit" > "{scratchpad}/nav-plan.json"
{wp-cli} eval-file "${CLAUDE_PLUGIN_ROOT}/skills/fse-menu-build/scripts/wp-navigation.php" apply "{scratchpad}/nav-plan.json"
{wp-cli} eval-file "${CLAUDE_PLUGIN_ROOT}/skills/fse-menu-build/scripts/wp-navigation.php" dump   # every block of navigation_blocks has a ref that is an id of navigations
```
On a new site the pages of the kit menus do not exist yet: `plan` warns on stderr and those
items become `#` links. It is expected: `fse-menu-build` realigns the menus once the project's
telaio kit and pages exist.

### Step 4c — Home, front page, permalinks
```bash
HOME_ID=$({wp-cli} post create --post_type=page --post_title="Home" --post_name=home --post_status=publish --porcelain)
{wp-cli} option update show_on_front page && {wp-cli} option update page_on_front $HOME_ID
{wp-cli} option update permalink_structure '/%postname%/' && {wp-cli} rewrite flush --hard   # writes .htaccess (outside the repo); if it cannot, write the standard WP .htaccess
```
No `front-page.html` (fse-foundations §7): the static Home uses `page.html`.

### Step 4d — Tokens
```bash
node "${CLAUDE_PLUGIN_ROOT}/shared/scripts/sync-theme-json-tokens.js" "{theme-root}"   # DESIGN.md → Design Tokens + assets/css/wp-global-styles.css via {wp-cli}
node "${CLAUDE_PLUGIN_ROOT}/shared/scripts/sync-theme-json-tokens.js" "{theme-root}" --check   # exit 0
cd "{theme-root}" && npm run build   # html/ with the regenerated global styles
```

### Step 4e — Checks
- `cd "{theme-root}" && npm run check` → exit 0, with the frontend checks executed (no `SKIP`
  line for the Home: a `SKIP … non raggiungibile` here means the host stopped answering) and
  `PASS check-parita`: header and footer of the new project have the same structure in the kit
  and in WordPress.
- Login as `{agent-admin-user}` (fse-foundations §9: `sessione.js apri` with the model
  `pw-pagina.js` and the Home's id, then `chiudi`) → the Home opens in the editor without
  invalid blocks and shows header/footer with the menu on the frontend.
- `{wp-cli} eval 'foreach (WP_Block_Type_Registry::get_instance()->get_all_registered() as $n => $b) if (str_starts_with($n, "{prefix}/")) echo $n, "\n";'`
  → every `blocks/*/block.json` of the repo with the new prefix; patterns `{prefix}/contacts`, `{prefix}/cta`
  (`_register_theme_block_patterns()` first).
- `{wp-cli} post list --post_type=wp_template --format=count` and `wp_template_part` → 0 (files
  are the source).
- `{site-root}/wp-content/debug.log` empty (or absent).

### Step 4f — Formidable (`{prefix}/form` and the default form part)
```bash
{wp-cli} plugin install formidable --activate && {wp-cli} language plugin install formidable it_IT
{wp-cli} eval 'FrmAppController::install();'   # WP-CLI does not create the tables otherwise
{wp-cli} eval '$s = FrmAppHelper::get_settings(); $s->load_style = "none"; $s->store();'   # the theme styles the form
```
`parts/form-contacts.html` has `formId` 0 since Step 3a (title and text only, no broken form):
add to `## Domande aperte`: "form di default:
creare il form Contatti in Formidable e impostare `formId` nella part (Aspetto → Editor →
Parti)".

## Phase 5 — Handover

### Step 5a — DESIGN.md, CLAUDE.md and README.md `[AGENT]`
- `## Telaio`: header, footer, templates, form di default `implementato` (inherited from the starter; the project
  kit will redesign them with `fse-kit`).
- `## Pagine`: Home `/` `da progettare` (the WP page exists, empty; its kit is the project's;
  `fse-brief` rewrites these rows from the map);
  Catalogo blocchi `/catalogo-blocchi/` `kit` (`src/kit/{prefix}-blocks.kit`, every variant of the
  shipped blocks: the regression page, built by the first `fse-build`). The base theme's demo
  pages get no row (Step 3a removed their kits); wdm-theme's "fuori dal flusso" note and its
  `## Log decisioni` rows are dropped.
- `## Blocchi`: one row per `blocks/*/build/index.asset.php` on disk, `implementato`, origin
  "starter" (block, state, origin: variants and children stay in each README).
- `## Navigazione`: the four menus of Step 4b (title, id and part from `dump`), items as in
  the kit, the ones without a page marked "orfana".
- `## Domande aperte`, `## Log decisioni` (one row: setup date, values).
- `CLAUDE.md` ships with the repo and resolves `{prefix}`/paths from DESIGN.md: verify its
  "First: read DESIGN.md" protocol and routing table mention only `fse-*` skills.
- `README.md` (site root) ships with the repo as the project's quick-start note for humans
  (dependencies, setup on a new machine, `npm` commands, the flow, the project structure); it is
  never a state file (state lives in `DESIGN.md`). `setup.js` renamed it (Step 3a): verify the
  title and the theme paths carry the project values and that the only `wdm` left are the plugin
  name `wdm-agent` and the base repo URL `carlogatto/wdm-theme`. Missing from the clone → say so
  in the handover; never write it from scratch.

### Step 5b — Git and handover `[AGENT]`
Git first (fse-foundations §10: `git init` and `git add .` are allowed in this step only).
`{site-root}/.git` missing → `git init` in `{site-root}`; already there → no init. Then the
first commit, on the main branch: the whole project is the work, so `git add .` (the
`.gitignore` shipped with the repo keeps WordPress core, uploads, `.playwright-mcp/` and
`node_modules` out). Before committing,
`git status --short | grep -E '\.playwright-mcp/|wp-admin/|wp-includes/|wp-config\.php|wp-cli\.phar|node_modules/|uploads/'`
must print nothing: any line → stop, nothing is committed. Message: `chore: setup del progetto
{slug} da wdm-theme`. Never a remote, never a push: they are the dev's, from Sourcetree.

Git without an identity on this computer (`git config user.name` or `git config user.email`
prints nothing; reading the configuration is allowed, writing it never is — §10): do not
commit, leave Step 5b unchecked, send this and STOP. After **fatto**, commit and go on.

> Il progetto è pronto, ma non posso ancora salvare il primo commit: git su questo computer non
> conosce il tuo nome e la tua email. Apri Sourcetree → Impostazioni → Generali → «Informazioni
> utente predefinite», scrivi nome completo ed email e lascia attiva «Permetti a SourceTree di
> modificare i tuoi file di configurazione globali Git e Mercurial». Poi scrivimi **fatto**: il
> commit lo faccio io.

When every step of `SETUP.md` is checked, delete `SETUP.md` (it is this skill's own progress
file). Then the **handover**, in the shape of fse-foundations §10 "The handover message" — it is
not a question and nothing waits for an answer:

- *Esito*: `✅ chiuso`.
- *Cosa è cambiato*: the site at `{local-url}` (home with header, footer and menu), the theme
  folder, the dev's WordPress user with its password — shown here, **once** — and the first
  commit, visible in Sourcetree.
- *Cosa aspetta te*: change that password from your profile in WordPress (it is the only one of
  the project: the agent enters without a password); the remote on GitHub and the push, from
  Sourcetree, when you want; if `.git` was already there with a remote `origin` that points to
  `carlogatto/wdm-theme`, add "il repository punta ancora al tema base wdm-theme: cambia il
  remoto prima del push". One line for the things the project will replace along the way:
  `screenshot.png` and the placeholder images in `assets/img/`.
- *Prossimo passo*: the brief. `{site-root}/docs/brief/` already has files → no question: read
  `${CLAUDE_PLUGIN_ROOT}/skills/fse-brief/SKILL.md` and start `fse-brief` **in the same
  conversation**, right after the handover (fse-foundations §1 "The ok continues"). Empty → "metti
  in `docs/brief/` il materiale del progetto (brand, logo, font, elenco delle pagine, testi,
  immagini) e scrivi «leggi il brief»; per provare senza un cliente scrivi «usa il brief di
  esempio»". Never a prompt to paste.

## A project cloned on another computer

`DESIGN.md` says `theme_family: fse`, the theme folder already has the project's name and there
is no `wp-config.php`: the repo is complete, WordPress and its database are not here. Nothing is
renamed and no value is asked except the dev's email (one message, with the MAMP PRO check of
the opening message: the host `{site-folder}.local` on this folder, servers started). Then, in
order, with the values of `DESIGN.md → Project Config`:

1. Step 1a (the host answers) and Step 1b: `mamp.js --site "{site-root}" --db "{site-folder}-db"`.
   The rows `{db-socket}` and `{wp-cli}` cloned from the other computer carry **its** paths:
   `mamp.js` rewrites them with this computer's. Rewrite `{site-root}` and `{theme-root}` too.
2. Step 2a, 2b, 2c: WordPress core, `wp-config.php` (`--dbprefix={prefix}_`), install, the agent
   user `{agent-admin-user}`.
3. Step 3b (`npm install && npm run build`), Step 4a (activate), Step 4c (Home, front page,
   permalinks), Step 4f (Formidable).
4. `fse-build`, whole perimeter: pages and menus are rebuilt from the kits of the repo. The
   `ref` it writes in the parts are the ids of **this** database: if they differ from the
   committed ones, leave that change out of the commit and say so in the handover.
5. Step 4e (checks) and the handover: what the kits do not contain — content written by hand in
   WordPress, uploaded media, form entries — is not in the repo and arrives only with an export
   of the other computer's database, which this skill does not do.

## What is NOT automated
The MAMP PRO host (its interface has no command) · the git identity, the remote and the push
(Sourcetree) · the change of the dev's password.

## Never
Rename by hand what `setup.js` renames · empty or delete a database that already has tables · touch the starter repo · persist the dev's password (chat only, once) ·
give the agent user a password of your choice or write one in a file (it logs in with a
temporary session, fse-foundations §9) · `git push`, or any git command beyond the fse-foundations §10 rule · write `CLAUDE.md` by hand (it ships with the repo).
