# wdm-agent

Plugin di Claude Code con il sistema agentico di **wdm-theme**: le skill che, dal brief del
designer, progettano e costruiscono un block theme WordPress (FSE) a blocchi nativi dinamici, le
loro convenzioni, gli hook di controllo e lo script dei design token.

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
| `fse-brief` | il brief del designer in `docs/brief/` diventa il contratto del sito: mappa, token applicati, tono, plugin, immagini, per una review ("leggi il brief") |
| `fse-kit` | progettazione in HTML del telaio o di una pagina completa con i suoi blocchi, un item per sessione, una review alla fine ("progettiamo il kit…") |
| `fse-build` | build del sito in WordPress da tutti i kit approvati, rieseguibile (applica solo la differenza kit ↔ WP), menu inclusi, una review finale ("costruisci il sito") |
| `fse-block-edit` | modifica di un blocco già implementato ("aggiungi un attributo a X"); una variante nuova nasce in `fse-kit`, dentro la pagina che la richiede |
| `fse-menu-build` | creazione e riallineamento dei menu `wp_navigation` dal kit ("popola il menu") |

- `shared/fse-foundations.md`: le convenzioni, citate per § da ogni skill e dal `CLAUDE.md` dei progetti.
- `shared/scripts/sync-theme-json-tokens.js`: genera la sezione Design Tokens di `DESIGN.md` e `assets/css/wp-global-styles.css` da `theme.json`.
- `skills/fse-build/scripts/wp-page.php` e `skills/fse-menu-build/scripts/wp-navigation.php`: i due write path verso WordPress (pagine e menu), eseguiti con WP-CLI; mostrano il diff e cancellano solo dopo una conferma in un turno successivo.
- `hooks/`: `check-block-contract.sh` (a ogni scrittura di un `block.json`: nome, cartella, `render`, sorgenti, README, versione) e `check-design-tokens.sh` (a ogni scrittura di `theme.json`: token di `DESIGN.md` allineati, altrimenti chiede conferma al dev prima di rigenerare).

## Il flusso

Il designer giudica tre deliverable finiti; fra un gate e l'altro l'agente decide da solo
(testi, layout nel sistema, id, numeri verificabili) e marca `[da confermare]` i fatti sul cliente
che non può decidere (telefono, prezzi, testi legali, immagini mancanti), con un default plausibile.
L'ok a un gate non chiude: l'agente prosegue nella stessa conversazione con il momento successivo
(brief → kit del telaio; kit → build → kit della pagina seguente). Il designer decide tre cose
sole, l'ok a un kit, i `confirm` delle cancellazioni e i fatti `[da confermare]`; la meccanica
non passa mai dalla sua tastiera. I blocchi nascono dentro la pagina che li usa: una review per
pagina, mai per blocco.

| Gate | Cosa guarda il designer | Skill |
|---|---|---|
| 1 — brief | mappa del sito, tono, plugin, immagini in `DESIGN.md`; i blocchi esistenti nel brand nuovo su `localhost:8848` | `fse-brief` |
| 2 — telaio | header, footer e form di default in HTML su `localhost:8848` | `fse-kit` |
| 3 — kit di pagina (uno per pagina) | la pagina completa, con tutti i blocchi che le servono e i testi veri, su `localhost:8848` | `fse-kit` |

La build (`fse-build`) non è un gate: parte da sola all'ok di un kit, nella stessa conversazione,
e si chiude con il report del sito in WordPress; le osservazioni sul sito live tornano come
revisioni del kit. A ogni gate le osservazioni tornano all'agente come revisioni; il gate si
chiude con un ok esplicito in un turno successivo, che la skill registra in `DESIGN.md`. Ogni
consegna è un messaggio in quattro punti (esito · cosa è cambiato · cosa aspetta te · prossimo
passo). Un `confirm` si dà nella stessa conversazione, in un turno successivo, senza prompt da
incollare; una conversazione nuova serve solo dopo un aggiornamento del plugin. I controlli
passati non si elencano, il dettaglio tecnico sta in
`DESIGN.md → ## Log decisioni` (fondamenta §10). La build è rieseguibile su tutto il sito: applica
solo la differenza, corregge da sola il kit quando è il kit a sbagliare (una classe che WP
aggiunge in render), e una cancellazione (blocco, pagina, voce di menu) viene mostrata e si
esegue solo dopo l'ok.

## Prerequisiti

- Claude Code aggiornato (CLI, app desktop o estensione VS Code).
- `node` 18 o successivo.
- `jq` (gli hook lo usano). Su macOS 15 o successivo è già nel sistema: `jq --version` risponde
  `jq-1.7…-apple`. Se manca, si installa con [Homebrew](https://brew.sh): `brew install jq`.
- git (quello di Xcode Command Line Tools basta). Il repo è pubblico: non servono account GitHub,
  inviti o credenziali.
- MAMP e WP-CLI non servono per installare il plugin: li prepara `fse-theme-setup` nel progetto.

Nel progetto la password dell'utente agente (`{agent-admin-user}` di `DESIGN.md`) sta in
`{site-root}/.env`, due righe `AGENT_ADMIN_USER=…` e `AGENT_ADMIN_PASSWORD=…`: le scrive `fse-theme-setup` (Step 2c), il
`.gitignore` della site root la tiene fuori dal repo, le skill la leggono solo attraverso la shell
per il login Playwright e non la stampano mai (fondamenta §9/§10). In un progetto nato prima di
questa regola il dev crea il file a mano con quelle due righe.

## Installazione

```bash
claude plugin marketplace add carlogatto/wdm-agent
claude plugin install wdm-agent@wdm-agent
claude plugin list
```

L'ultima riga deve elencare `wdm-agent`. Le sessioni di Claude Code già aperte non vedono il plugin: chiudile e riaprile, oppure scrivi `/reload-plugins` nella sessione.

Lo stesso si può fare **dentro Claude Code**, senza terminale: nella chat scrivi
`/plugin marketplace add carlogatto/wdm-agent`, poi `/plugin install wdm-agent@wdm-agent`
(oppure `/plugin`, scheda **Marketplaces** per aggiungere il catalogo e scheda **Discover** per il
bottone Install), e infine `/reload-plugins`.

## Aggiornamento

```bash
claude plugin marketplace update wdm-agent
claude plugin update wdm-agent@wdm-agent
```

**Lo fa l'agente, sempre.** Dopo ogni modifica al plugin l'agente fa il commit (fondamenta §10:
il commit è suo, il push resta al dev), esegue i due comandi da sé e verifica la versione in
`~/.claude/plugins/installed_plugins.json`; non li consegna mai al dev come passo da fare. Con il
marketplace locale (il checkout) l'aggiornamento legge la cartella; con il marketplace GitHub
legge il remoto: se la versione resta quella vecchia manca il push del dev, l'agente lo dice in
una riga e riprova dopo il push. Le skill nuove si caricano al riavvio di Claude Code (o con
`/reload-plugins`): l'unica cosa che resta al dev.

## Verifica dell'installazione

Apri una sessione di Claude Code nella cartella di un progetto wdm-theme (quella con `DESIGN.md`
e `CLAUDE.md`; se non ne hai ancora uno, il tema base `wdm-theme` che ricevi con il corso va
bene, e un progetto nuovo lo crea `fse-theme-setup`). Le skill compaiono nell'elenco come `wdm-agent:fse-theme-setup`,
`wdm-agent:fse-brief`, `wdm-agent:fse-kit`, `wdm-agent:fse-build`, `wdm-agent:fse-block-edit`,
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
node tests/run.js
```

Le prove usano `node --test`, senza pacchetti da installare. Il verdetto è `TUTTO VERDE` solo se
ogni prova è stata eseguita ed è passata: una prova saltata dà `NON VERDE`, con il motivo. Le
prove in `tests/` chiedono solo Node. Quelle nelle sottocartelle chiedono altro, e si escludono
solo dichiarandolo: `node tests/run.js --senza claude,sito` risponde `VERDE IN PARTE` e nomina i
gruppi esclusi.

| Gruppo | Richiede |
|---|---|
| `tests/bash/` | `bash` e `jq`: sono le prove degli hook |
| `tests/claude/` | la CLI `claude` con il plugin installato |
| `tests/sito/` | il sito di prova |

Il sito di prova è un WordPress usa e getta, in una cartella e in un database riservati alle
prove: le prove che scrivono in WordPress scrivono solo lì, lo azzerano prima di cominciare e lo
lasciano vuoto. I valori della macchina (cartella, database, PHP e socket di MAMP, `wp-cli.phar`)
stanno in `tests/sito.local.json`, che non entra nel repo: si parte da una copia di
`tests/sito.example.json`. Cartella e database devono avere un nome che finisce con `-test`, e la
cartella al primo uso deve essere vuota: le prove ci lasciano il file `.wdm-agent-sito-di-prova`
e da allora svuotano solo una cartella che lo contiene. Per usarlo a mano:
`node tests/lib/sito.js install | reset | status | wp …`.

A ogni push su `master` GitHub Actions (`.github/workflows/prove.yml`) esegue le prove su macOS
e su Windows, senza i gruppi che lì non possono girare.

Su un altro Mac di Carlo il plugin **non** c'è finché non lo si installa anche lì: la copia che
Claude Code usa sta in `~/.claude/plugins/`, cartella esclusa dal repo `claude-global`. Si installa
dal remoto con i due comandi della sezione Installazione; se `settings.json` arrivato da git
contiene ancora il marketplace locale `wdm-agent`, il comando lo sostituisce con quello GitHub.

A ogni release alza `version` in **entrambi** `.claude-plugin/plugin.json` e
`.claude-plugin/marketplace.json`, e crea il tag git corrispondente. Gli studenti installano
sempre dal remoto GitHub (repo pubblico), mai dal checkout.

## Come sono scritti i percorsi

Dentro una skill, un file della stessa skill si cita con percorso relativo alla sua cartella
(`scripts/setup.sh`). Qualunque altro file del plugin si cita con `${CLAUDE_PLUGIN_ROOT}/…`,
che Claude Code espande nel testo delle skill e nei comandi degli hook, ovunque il plugin sia
installato. Dettagli in `shared/fse-foundations.md §12`.

## Storia

Nato il 2026-10-26 dalle skill `fse-*` che vivevano come cartelle globali in `~/.claude` sul Mac
di Carlo (spec e piano in `docs/`). La famiglia gemella per wdm-starter (`dev-*`, `design-*`)
non fa parte del plugin.
