# wdm-agent

Plugin di Claude Code con il sistema agentico di **wdm-theme**: le skill che progettano e
costruiscono un block theme WordPress (FSE) a blocchi nativi dinamici, le loro convenzioni, gli
hook di controllo e lo script dei design token.

## Cos'è

wdm-theme è un tema base: un kit HTML progettato con il dev diventa il contratto di render di
ogni blocco, e le skill di questo plugin portano quel contratto fino alla pagina pubblicata in
WordPress. Il plugin si installa una volta a livello utente e vale per ogni progetto nato da
wdm-theme. Le skill partono da sole quando la richiesta corrisponde alla loro descrizione, oppure
si invocano per nome: `/wdm-agent:fse-kit`.

## Cosa contiene

| Skill | Quando parte |
|---|---|
| `fse-theme-setup` | nuovo progetto cliente dal repo wdm-theme ("nuovo progetto da wdm-theme") |
| `fse-kit` | progettazione in HTML di telaio, pagine e blocchi, in dialogo con il dev ("progettiamo il kit…") |
| `fse-build` | costruzione autonoma in WordPress del prossimo item pronto: telaio, poi una pagina per sessione ("costruisci la pagina X") |
| `fse-block-edit` | modifica di un blocco già implementato ("aggiungi una variante a X") |
| `fse-menu-build` | creazione e riallineamento dei menu `wp_navigation` dal kit ("popola il menu") |

- `shared/fse-foundations.md`: le convenzioni, citate per § da ogni skill e dal `CLAUDE.md` dei progetti.
- `shared/scripts/sync-theme-json-tokens.js`: genera la sezione Design Tokens di `DESIGN.md` e `assets/css/wp-global-styles.css` da `theme.json`.
- `hooks/`: `check-block-contract.sh` (a ogni scrittura di un `block.json`: nome, cartella, `render`, sorgenti, README, versione) e `check-design-tokens.sh` (a ogni scrittura di `theme.json`: token di `DESIGN.md` allineati, altrimenti chiede conferma al dev prima di rigenerare).

## Prerequisiti

- Claude Code aggiornato (CLI, app desktop o estensione VS Code).
- `node` 18 o successivo.
- `jq` (gli hook lo usano): `brew install jq`.
- git con credenziali per GitHub, perché il repo è privato: chiave SSH caricata in `ssh-agent`
  oppure `gh auth login` seguito da `gh auth setup-git`. Claude Code non chiede password durante
  l'installazione: se git non ha già la credenziale, il comando fallisce.
- Accesso al repo `carlogatto/wdm-agent`, concesso da Carlo.
- MAMP e WP-CLI non servono per installare il plugin: li prepara `fse-theme-setup` nel progetto.

## Installazione

```bash
claude plugin marketplace add carlogatto/wdm-agent
claude plugin install wdm-agent@wdm-agent
claude plugin list
```

L'ultima riga deve elencare `wdm-agent`. Riavvia le sessioni di Claude Code già aperte.

## Aggiornamento

```bash
claude plugin marketplace update wdm-agent
claude plugin update wdm-agent@wdm-agent
```

## Verifica dell'installazione

Apri una sessione di Claude Code nella cartella di un progetto wdm-theme (quella con `DESIGN.md`
e `CLAUDE.md`). Le skill compaiono nell'elenco come `wdm-agent:fse-theme-setup`,
`wdm-agent:fse-kit`, `wdm-agent:fse-build`, `wdm-agent:fse-block-edit`,
`wdm-agent:fse-menu-build`. Scrivi `/wdm-agent:fse-kit`: la skill legge `DESIGN.md` e applica
la guardia `theme_family` (fse-foundations §0) prima di ogni altra cosa.

## Disinstallazione

```bash
claude plugin uninstall wdm-agent@wdm-agent
```

## Sviluppo

Solo per chi modifica il plugin. Il checkout di lavoro è `~/Documents/Development/wdm-agent`,
aggiunto come marketplace locale:

```bash
claude plugin marketplace add ~/Documents/Development/wdm-agent
claude plugin install wdm-agent@wdm-agent
```

Con Claude Code 2.1.286 l'installazione **copia** il checkout in `~/.claude/plugins/cache/`
(`claude plugin update` non ricopia a versione uguale). Dopo una modifica ai file:

```bash
claude plugin uninstall wdm-agent@wdm-agent && claude plugin install wdm-agent@wdm-agent
```

poi nuova sessione, o `/reload-plugins` nella sessione aperta. Le versioni più recenti della CLI
leggono i marketplace locali sul posto: in quel caso basta `/reload-plugins`. Prima di ogni commit:

```bash
bash tests/run.sh
```

Su un altro Mac di Carlo il plugin **non** c'è finché non lo si installa anche lì: la copia che
Claude Code usa sta in `~/.claude/plugins/`, cartella esclusa dal repo `claude-global`. Si installa
dal remoto con i due comandi della sezione Installazione; se `settings.json` arrivato da git
contiene ancora il marketplace locale `wdm-agent`, il comando chiede di sostituirlo: rispondere sì.

A ogni release alza `version` in **entrambi** `.claude-plugin/plugin.json` e
`.claude-plugin/marketplace.json`, e crea il tag git corrispondente. Gli studenti installano
sempre dal remoto GitHub, mai dal checkout.

## Come sono scritti i percorsi

Dentro una skill, un file della stessa skill si cita con percorso relativo alla sua cartella
(`scripts/setup.sh`). Qualunque altro file del plugin si cita con `${CLAUDE_PLUGIN_ROOT}/…`,
che Claude Code espande nel testo delle skill e nei comandi degli hook, ovunque il plugin sia
installato. Dettagli in `shared/fse-foundations.md §12`.

## Storia

Nato il 2026-10-26 dalle skill `fse-*` che vivevano come cartelle globali in `~/.claude` sul Mac
di Carlo (spec e piano in `docs/`). La famiglia gemella per wdm-starter (`dev-*`, `design-*`)
non fa parte del plugin.
