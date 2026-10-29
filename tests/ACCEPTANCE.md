# Accettazione wdm-agent 1.3.0 — 2026-10-30

Checkout `~/Documents/Development/wdm-agent`, spec `docs/2026-10-30-wdm-agent-flusso-autonomo.md` §10, piano `…-plan.md`.

| # | Criterio (spec §10) | Esito | Evidenza |
|---|---|---|---|
| 1 | `bash tests/run.sh` ALL GREEN con i due test nuovi, `test-wp-page` eseguito e non SKIP | ✅ | 10 test; `test-wp-page` casi (a)–(k) su una pagina di prova in bozza di wdm-theme (e una figlia), cancellate a fine test; (j) round trip di `&`, `<br>`, `"`, `--` (fix `wp_slash` dalla revisione finale), (k) pagina figlia trovata per slug |
| 2 | Nessun riferimento a piani/fasi in skill e fondamenta | ✅ | `tests/test-no-plan-refs.sh` PASS (rimossi "decision 14 of the plan" in fse-build e "Phase 4 M5" in §7) |
| 3 | Conversazione nuova su wdm-theme: 6 skill `wdm-agent:*`; `/wdm-agent:fse-brief` si ferma su `docs/brief/` vuota con il paragrafo di istruzioni | ⏳ | da verificare da Carlo nella conversazione nuova dopo la reinstallazione |
| 4 | Lettura cieca di `fse-brief` e `fse-build` 1.3.0: il flusso a quattro gate si ricava dalle sole skill | ✅ (fse-brief) / ⏳ (fse-build) | sottoagente su `fse-brief/SKILL.md`: descrizione corretta di input, output, review, stop, ok; due ambiguità chiuse (conflitti di nome in `assets/`, PNG con trasparenza). `fse-build` da leggere nella conversazione nuova |
| 5 | `wp-page.php plan page=home` con il markup del kit Home: exit 1, hero `modificato`, 9 `nuovo`, 0 cancellazioni, nessuna scrittura | ✅ | `home (id 37): 0 uguale · 1 modificato · 9 nuovo · 0 spostato · 0 da cancellare` (`~ wdm/hero (image): figli`); il run ha fatto emergere e correggere il caso "variante al default omessa in WP" (test (i)). Prova su `page=contatti` non eseguita (evidenza mancante, minor deferito dalla revisione) |

# Accettazione wdm-agent 1.0.0 — 2026-10-26

Claude Code 2.1.286 · macOS · checkout `~/Documents/Development/wdm-agent` installato da marketplace locale.

| # | Criterio (spec §6) | Esito | Evidenza |
|---|---|---|---|
| 1 | Installazione: le 5 skill con namespace, nessuna `fse-*` nuda | ✅ | `claude -p` in una sessione nuova (cwd wdm-theme) elenca esattamente `wdm-agent:fse-block-edit`, `fse-build`, `fse-kit`, `fse-menu-build`, `fse-theme-setup`; `~/.claude/skills/fse-*` non esistono più (`tests/test-no-duplicates.sh`) |
| 2 | Comportamento identico: fondamenta dal plugin, `wp-navigation.php` dal percorso del plugin, sync `--check` 0 con marker vecchio e nuovo | ✅ | `eval-file …/wdm-agent/skills/fse-menu-build/scripts/wp-navigation.php dump` → parts header 4 / footer 69, navigations 4/69/70/71; `sync-theme-json-tokens.js --check` su wdm-theme: 0 con marker vecchio (avviso) e 0 dopo la rigenerazione (`tests/test-sync-marker.sh` a–e, wp-cli attivo); le skill citano `${CLAUDE_PLUGIN_ROOT}/shared/fse-foundations.md` (`tests/test-skill-refs.sh`). L'espansione di `${CLAUDE_PLUGIN_ROOT}` nel testo delle skill è documentata da Claude Code: da confermare a occhio nella prima sessione `fse-kit` (vedi "Da fare") |
| 3 | Hook una volta sola | ✅ (strutturale) | `settings.json` registra solo `check-build-registration.sh` e `check-design-tokens.sh` (ramo starter, esce su theme.json: verificato); `hooks.json` del plugin registra i due hook fse una volta; `tests/test-hooks.sh` (a)–(h). La prova "dal vivo" con Write/Edit in sessione è nella lista "Da fare" |
| 4 | Zero percorsi assoluti | ✅ | `bash tests/run.sh` → ALL GREEN (7 test, `test-no-absolute-paths` esclude tests/, docs/, README) |
| 5 | README seguito alla lettera da chi non sa nulla | ✅ | Lettura cieca del README da un sottoagente: 5 punti ambigui → README corretto. Install reale da GitHub su questo Mac: fallita con repo **privato** (git senza credenziali non interattive: Claude Code non può chiederle), riuscita dopo che Carlo ha reso il repo **pubblico** (2026-10-26 sera): marketplace `github carlogatto/wdm-agent`, plugin 1.0.0 identico al checkout. Decisione: repo pubblico, prerequisiti su credenziali e inviti tolti dal README |
| 6 | Guard `theme_family` invariato | ✅ | testo §0 in `shared/fse-foundations.md` e nelle 5 SKILL.md identico all'originale salvo la frase sulla coesistenza delle famiglie (diff limitato alle righe dei percorsi, `tests/test-skill-refs.sh`) |

**Revisione finale (revisore fresco, 2026-10-30):** 1 Critical (manca `wp_slash` in `wp_update_post`: attributi con `&`, `<`, `"`, `--` corrotti) e 3 Important (pagina figlia non trovata per slug → duplicati; perimetro del telaio; gate 2/3 non nominati in `fse-build`) corretti con test (j)/(k) e testo; 9 Minor deferiti (ledger della sessione, elenco nel report finale a Carlo). `wp-navigation.php` ha lo stesso `wp_update_post` senza `wp_slash`: fuori perimetro, da sistemare in una release di manutenzione.

## Da fare nella prima sessione reale (Carlo o l'agente, nuova sessione in wdm-theme)
1. `/wdm-agent:fse-kit`: la riga 1 dei MANDATORY first steps mostra il percorso **espanso** `…/wdm-agent/shared/fse-foundations.md` (criterio 2, ultimo punto).
2. Criterio 3 dal vivo: `Edit` neutro su `blocks/wdm-block-cta/block.json` → nessun output di hook; `Write` di un `block.json` di prova con `file:./build/view.js` senza `src/view.js` → un solo errore (exit 2); `Edit` di `theme.json` (`radius.sm` 4px → 5px) → un solo avviso del sync, poi ripristino e `--check` 0.
