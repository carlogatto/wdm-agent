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

## Da fare nella prima sessione reale (Carlo o l'agente, nuova sessione in wdm-theme)
1. `/wdm-agent:fse-kit`: la riga 1 dei MANDATORY first steps mostra il percorso **espanso** `…/wdm-agent/shared/fse-foundations.md` (criterio 2, ultimo punto).
2. Criterio 3 dal vivo: `Edit` neutro su `blocks/wdm-block-cta/block.json` → nessun output di hook; `Write` di un `block.json` di prova con `file:./build/view.js` senza `src/view.js` → un solo errore (exit 2); `Edit` di `theme.json` (`radius.sm` 4px → 5px) → un solo avviso del sync, poi ripristino e `--check` 0.
