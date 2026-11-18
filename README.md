# wdm-agent

Plugin di Claude Code con il sistema agentico di **wdm-theme**: le skill che, dal brief del
designer, progettano e costruiscono un block theme WordPress (FSE) a blocchi nativi dinamici, le
loro convenzioni, gli hook di controllo e gli script che scrivono in WordPress.

## Cos'è

wdm-theme è un tema base: un kit HTML progettato dall'agente e approvato da te diventa il
contratto di render di ogni blocco, e le skill di questo plugin portano quel contratto fino alla
pagina pubblicata in WordPress. Il plugin si installa una volta e vale per ogni progetto nato da
wdm-theme. Le skill partono da sole quando la richiesta corrisponde alla loro descrizione
(«leggi il brief», «costruisci il sito»), oppure si invocano per nome: `/wdm-agent:fse-kit`.

**Lingue e ruoli.** Le istruzioni per l'agente (skill, fondamenta, `CLAUDE.md`) sono in inglese.
Tutto ciò che è rivolto a te (i messaggi dell'agente, i README, `DESIGN.md`) è in italiano. Nelle
skill «dev» e «designer» sono la stessa persona: chi usa il sistema, cioè tu.

## Prerequisiti

Tutto ciò che serve è in questo elenco, nell'ordine in cui conviene procurarselo. Il sistema è
provato su macOS.

| Cosa | Perché | Come si ottiene |
|---|---|---|
| Un Mac con **macOS** | è il sistema su cui il flusso è provato dall'inizio alla fine | — |
| **MAMP PRO** | il server locale: un sito con il suo nome e HTTPS per ogni progetto, PHP e database compresi. La versione gratuita (MAMP) non basta | [mamp.info](https://www.mamp.info/), licenza a pagamento: 99 € più IVA (prezzo di novembre 2026) |
| **Claude Code**, all'ultima versione | l'agente. Esiste come app desktop, estensione di VS Code e programma da terminale: fanno la stessa cosa, l'app desktop è la più semplice per cominciare | [claude.com/claude-code](https://claude.com/claude-code), con un abbonamento Claude a pagamento (Pro o Max) |
| **Node.js 22** o successivo | la build del tema, gli hook e gli script del plugin | [nodejs.org](https://nodejs.org/), installer per macOS |
| **git** | lo usa l'agente per salvare il lavoro (i commit) | su macOS arriva con gli strumenti di sviluppo di Apple. Se durante il lavoro compare la finestra che propone di installare gli «strumenti da riga di comando per sviluppatori», scegli **Installa**, attendi la fine e chiedi all'agente di riprovare |
| **Sourcetree** con un **account GitHub** | è dove guardi cosa l'agente ha salvato, colleghi il progetto a GitHub e pubblichi (push). Aprilo una volta **prima** del primo progetto: all'avvio chiede nome ed email, che diventano la firma dei commit, anche di quelli dell'agente | [sourcetreeapp.com](https://www.sourcetreeapp.com/) e [github.com](https://github.com/), entrambi gratuiti |
| **Playwright** per Claude Code | il browser con cui l'agente controlla l'editor e le pagine | nella chat di Claude Code scrivi `/plugin install playwright@claude-plugins-official`, poi chiudi e riapri Claude Code |
| Il plugin **wdm-agent** | le skill che fanno il lavoro: questo plugin | sezione «Installazione», qui sotto |
| Il tema base **wdm-theme** | il punto di partenza di ogni progetto | [github.com/carlogatto/wdm-theme](https://github.com/carlogatto/wdm-theme): Code → Download ZIP |

Non vanno installati: WordPress, WP-CLI e il database del progetto. Li scarica e li crea
`fse-theme-setup`.

Nel progetto l'agente entra nel backend di WordPress **senza password**: per il suo utente crea
una sessione temporanea di quindici minuti e la revoca a fine lavoro. Non c'è nessuna password
dell'agente da scegliere, salvare o cambiare.

## Installazione

In Claude Code, nella chat, una riga alla volta:

```
/plugin marketplace add carlogatto/wdm-agent
/plugin install wdm-agent@wdm-agent
/reload-plugins
```

Lo stesso da terminale:

```bash
claude plugin marketplace add carlogatto/wdm-agent
claude plugin install wdm-agent@wdm-agent
claude plugin list
```

Da terminale l'ultima riga deve elencare `wdm-agent`. Le finestre di Claude Code già aperte non
vedono il plugin: chiudile e riaprile, oppure scrivi `/reload-plugins`.

## Verifica dell'installazione

Serve la cartella di un progetto: se non ne hai ancora una, fai prima il passo 1 di «Il primo
progetto» (il tema base appena scompattato va bene). Apri Claude Code scegliendo quella cartella
come cartella di lavoro e scrivi «che stato ha il progetto?».

**Esito atteso:** l'agente risponde con lo stato letto da `DESIGN.md` (telaio, pagine, blocchi).
Scrivendo `/wdm-agent:` nella chat compare l'elenco delle sei skill:
`wdm-agent:fse-theme-setup`, `wdm-agent:fse-brief`, `wdm-agent:fse-kit`, `wdm-agent:fse-build`,
`wdm-agent:fse-block-edit`, `wdm-agent:fse-menu-build`. Se l'agente risponde che `DESIGN.md` non
c'è, la cartella aperta non è quella del progetto. Se le skill non compaiono, vedi «Problemi
comuni».

## Il primo progetto

1. **La cartella.** Scarica lo ZIP di wdm-theme, scompattalo dentro la cartella dei tuoi siti
   (di solito `Sites`, nella tua cartella personale: se non c'è, creala) e rinomina la cartella
   ottenuta con il nome del progetto, in minuscolo e senza spazi: per esempio `pincopallino`.
2. **Il sito in MAMP PRO**, dopo la cartella e non prima (su una cartella vuota MAMP PRO mette
   una sua pagina di benvenuto):
   - apri MAMP PRO, sezione **Sites**, aggiungi un sito (pulsante **+**) di tipo **Empty**;
   - nome: quello della cartella seguito da `.local`, quindi `pincopallino.local`;
   - **Site Folder** (Document Root): la cartella del passo 1; la versione di PHP proposta va
     bene;
   - nella scheda **SSL** attiva SSL: MAMP PRO crea il certificato e chiede la password del Mac
     per renderlo attendibile;
   - **Save**, poi **Start** per avviare i server.
   Il sito risponderà a `https://pincopallino.local:8890/` (8890 è la porta HTTPS predefinita di
   MAMP PRO; se MAMP PRO mostra un indirizzo diverso, dillo all'agente al passo 3). Finché
   WordPress non è installato mostra un errore o un elenco di file: va bene.
3. **Il setup.** Apri Claude Code scegliendo la cartella del progetto come cartella di lavoro e
   scrivi «nuovo progetto da wdm-theme». L'agente chiede in un solo messaggio i quattro dati che
   non può conoscere, spiegandoli (nome del progetto, un prefisso di poche lettere, titolo, la
   tua email), poi fa tutto da solo: database, WordPress, rinomina del tema, menu, primo commit.
   Alla fine ti scrive l'indirizzo del sito, il nome del tuo utente di WordPress e, una volta
   sola, la sua password: annotala e cambiala dal tuo profilo in WordPress.
4. **Il brief.** Nella cartella del progetto il setup ha creato `docs/brief/`: mettici quello
   che hai (brand, logo, font, elenco delle pagine, testi, immagini, riferimenti), in qualunque
   formato, e scrivi «leggi il brief». Per provare il flusso senza un cliente vero scrivi
   «usa il brief di esempio»: l'agente usa il brief di uno studio inventato
   (`skills/fse-brief/esempio/brief.md` in questo plugin) e parte da lì.
5. **Da qui in poi** l'agente lavora e ogni tanto si ferma a un gate: ti scrive cosa guardare e
   a quale indirizzo, tu rispondi «ok» oppure con le tue osservazioni. Come procede è spiegato
   in «Il flusso».

Un progetto già avviato, scaricato da GitHub su un altro computer (clonato, con Sourcetree):
crea il sito in MAMP PRO come al passo 2, apri la cartella in Claude Code e scrivi «prepara
questo progetto su questo computer».

## Il flusso

Giudichi tre consegne finite, i gate (le parole in grassetto del glossario qui sotto spiegano il
resto). Fra un gate e l'altro l'agente decide da solo testi, impaginazione e dettagli tecnici, e
marca `[da confermare]` i fatti sul cliente che non può sapere (telefono, prezzi, testi legali,
immagini mancanti), con un valore plausibile: li trovi elencati nel messaggio di consegna e
rispondi con quello vero. Con il tuo ok il lavoro non si ferma: l'agente prosegue nella stessa
conversazione con il momento successivo (brief → kit del telaio; kit → build → kit della pagina
seguente). Decidi tre cose sole: l'ok a un gate, i `confirm` delle cancellazioni e i fatti `[da
confermare]`; tutto il resto lo fa l'agente. I blocchi nascono dentro la pagina che li usa: una
review per pagina, mai per blocco.

| Gate | Cosa guardi | Skill |
|---|---|---|
| 1 — brief | mappa del sito, tono, plugin di WordPress, immagini (l'agente te li riporta in chat e li scrive in `DESIGN.md`); i blocchi esistenti nel brand nuovo su `https://localhost:8848` | `fse-brief` |
| 2 — telaio | header, footer e form di default in HTML su `localhost:8848` | `fse-kit` |
| 3 — kit di pagina (uno per pagina) | la pagina completa, con tutti i blocchi che le servono e i testi veri, su `localhost:8848` | `fse-kit` |

La build (`fse-build`) non è un gate: parte da sola all'ok di un kit, nella stessa conversazione,
e si chiude con il report del sito in WordPress; le osservazioni sul sito live tornano come
revisioni del kit. A ogni gate le osservazioni tornano all'agente come revisioni; il gate si
chiude con un ok esplicito in un turno successivo, che la skill registra in `DESIGN.md`. Ogni
consegna è un messaggio in quattro punti (esito · cosa è cambiato · cosa aspetta te · prossimo
passo). Un `confirm` si dà nella stessa conversazione, in un turno successivo, senza copiare
nulla in un'altra chat; una conversazione nuova serve solo dopo un aggiornamento del plugin
(chiudi e riapri Claude Code). I controlli passati non si elencano: il dettaglio tecnico sta in
`DESIGN.md → ## Log decisioni`.

Tre regole proteggono ciò che c'è già in WordPress:

- **I contenuti sono di chi scrive in WordPress.** I testi e le immagini del kit riempiono una
  pagina alla prima build. Da quando qualcuno la modifica dall'editor, la build non tocca più i
  suoi contenuti: aggiunge solo le sezioni nate dopo nel kit.
- **Nulla si cancella senza un ok.** Un blocco, una pagina o una voce di menu che sparirebbe
  viene mostrata e si toglie solo dopo il tuo `confirm`. Aggiungere una voce al menu non chiede
  nulla.
- **La struttura resta uguale tra kit e sito.** Uno script lo controlla all'inizio di ogni
  conversazione e alla fine di ogni sessione; se trova una differenza l'agente allinea il lato
  rimasto indietro.

## Glossario

| Parola | Cosa vuol dire qui |
|---|---|
| **brief** | il materiale che dai all'agente in `docs/brief/`: brand, pagine, testi, immagini. Diventa il contratto del sito |
| **kit** | una pagina (o un pezzo di pagina) disegnata in HTML dall'agente, che guardi nel browser prima che esista in WordPress |
| **kit di pagina** | il kit di una pagina intera, con tutti i suoi blocchi e i testi veri |
| **telaio** | ciò che sta intorno al contenuto di ogni pagina: header, footer, menu e il form di contatto che compare in fondo alle pagine (form di default) |
| **gate** | un punto in cui l'agente ti consegna una cosa finita e aspetta il tuo ok. Sono tre: brief, telaio, kit di pagina |
| **ok** | la tua approvazione a un gate, scritta in chat. Fa partire il passo successivo |
| **`confirm`** | la parola con cui autorizzi una cancellazione che l'agente ti ha mostrato: scrivi proprio `confirm` in chat |
| **conversazione** e **turno** | una conversazione è una chat con l'agente, dall'apertura alla chiusura; un turno è un tuo messaggio con la sua risposta |
| **block theme** (FSE) | un tema di WordPress fatto di blocchi anche in header e footer, che si modifica dall'editor del sito |
| **`[da confermare]`** | un fatto sul cliente che l'agente non può sapere: mette un valore plausibile e te lo segnala |
| **build** | la costruzione del sito in WordPress a partire dai kit approvati. Si può rilanciare: applica solo le differenze |
| **blocco** | una sezione di pagina (hero, card, form) che in WordPress si inserisce e si compila dall'editor |
| **variante** | una versione di un blocco con un layout diverso (immagine a sinistra o a destra) |
| **part** e **template** | i file del tema che compongono header, footer e l'ossatura delle pagine |
| **token** | un valore di design con un nome (un colore, una spaziatura), scritto in `theme.json` |
| **parità** | kit e sito hanno la stessa struttura: stessi blocchi, stesso ordine, stesse classi |
| **`DESIGN.md`** | il file dove sta lo stato del progetto: pagine, blocchi, menu, decisioni prese. Si apre con qualunque editor di testo, ma di solito basta chiedere all'agente |
| **`CLAUDE.md`** | le regole che l'agente legge all'inizio di ogni conversazione |
| **cartella del progetto** (site root) | la cartella che apri in Claude Code: contiene WordPress, `DESIGN.md` e il tema |
| **`localhost:8848`** | l'indirizzo, sul tuo computer, dove guardi i kit mentre l'agente lavora: `https://localhost:8848`, te lo scrive l'agente a ogni consegna |
| **MAMP PRO**, sito locale | il programma che fa funzionare WordPress sul tuo computer, e il sito che ci crei per il progetto |
| **WP-CLI** | lo strumento con cui l'agente scrive in WordPress. Lo scarica e lo usa lui |
| **skill** | un insieme di istruzioni che l'agente segue per un compito (leggere il brief, costruire il sito) |
| **plugin** (di Claude Code) | il pacchetto che porta le skill: questo. Non è un plugin di WordPress |
| **hook** | un controllo automatico che parte da solo quando l'agente modifica certi file |
| **commit** e **push** | il commit salva una versione del lavoro sul tuo computer, e lo fa l'agente; il push la pubblica su GitHub, e lo fai tu da Sourcetree |

## Problemi comuni

| Cosa succede | Cosa fare |
|---|---|
| L'agente scrive «avvia i server di MAMP PRO» | I server sono fermi: apri MAMP PRO, premi **Start**, poi scrivi «fatto» |
| Le skill `wdm-agent:…` non compaiono, o dopo un aggiornamento non cambia nulla | Chiudi e riapri Claude Code (oppure scrivi `/reload-plugins`): le skill si caricano all'avvio |
| Il browser dice che `https://localhost:8848` non è sicuro | È l'anteprima dei kit sul tuo computer, con un certificato fatto in casa: cerca nella pagina di avviso la voce per proseguire comunque (in Chrome «Avanzate», in Safari «Mostra dettagli»). Succede una volta |
| L'agente dice che non può controllare l'editor, o che il browser è già in uso | Manca Playwright (`/plugin install playwright@claude-plugins-official`, poi riavvia Claude Code), oppure è rimasta aperta una sua finestra: scrivi «libera il browser e riprova» |
| Il primo commit non parte: git non conosce il tuo nome e la tua email | Apri Sourcetree → Impostazioni → Generali → «Informazioni utente predefinite»: scrivi nome completo ed email e lascia attiva «Permetti a SourceTree di modificare i tuoi file di configurazione globali Git e Mercurial». Poi scrivi «fatto» |

## Cosa contiene

Per chi vuole sapere cosa c'è dentro il plugin: per usarlo non serve.

| Skill | Quando parte |
|---|---|
| `fse-theme-setup` | nuovo progetto dal tema base («nuovo progetto da wdm-theme»), o progetto esistente su un altro computer |
| `fse-brief` | il brief in `docs/brief/` diventa il contratto del sito: mappa, token applicati, tono, plugin, immagini («leggi il brief») |
| `fse-kit` | progettazione in HTML del telaio o di una pagina completa con i suoi blocchi, una review alla fine («progettiamo il kit…») |
| `fse-build` | build del sito in WordPress da tutti i kit approvati, rieseguibile, menu inclusi («costruisci il sito») |
| `fse-block-edit` | modifica di un blocco già implementato («aggiungi un attributo a X»); una variante nuova nasce in `fse-kit`, dentro la pagina che la richiede |
| `fse-menu-build` | creazione e riallineamento dei menu `wp_navigation` dal kit («popola il menu») |

- `shared/fse-foundations.md`: le convenzioni («fondamenta»), citate per paragrafo (§) da ogni skill e dal `CLAUDE.md` dei progetti. Quando un testo dice «fondamenta §9» parla di questo file.
- `shared/scripts/sync-theme-json-tokens.js`: genera la sezione Design Tokens di `DESIGN.md` e `assets/css/wp-global-styles.css` da `theme.json`.
- `shared/scripts/parita.js`: confronta la struttura dei kit con quella del sito, senza scrivere nulla.
- `shared/scripts/sessione.js` e `shared/playwright/`: il login dell'agente nel backend senza password (una sessione temporanea, sempre revocata) e i modelli degli script che esegue nel browser.
- `skills/fse-build/scripts/wp-page.php` e `skills/fse-menu-build/scripts/wp-navigation.php`: i due write path verso WordPress (pagine e menu), eseguiti con WP-CLI; mostrano il diff, cancellano solo dopo una conferma in un turno successivo, non scrivono su una pagina aperta nell'editor e non toccano i contenuti modificati a mano in WordPress.
- `skills/fse-theme-setup/scripts/`: `mamp.js` (trova MAMP PRO, scarica WP-CLI, sceglie il PHP, crea il database del progetto e scrive `{wp-cli}` in `DESIGN.md`) e `setup.js` (rinomina il tema base nel tema del progetto; si può rilanciare dopo un'interruzione).
- `hooks/`: tre script Node. `check-block-contract.js` (a ogni scrittura di un `block.json` del tema: nome, prefisso, cartella, `render`, sorgenti, README, versione), `check-design-tokens.js` (a ogni scrittura di `theme.json`: token di `DESIGN.md` allineati, altrimenti chiede conferma prima di rigenerare) e `chiudi-sessione.js` (a fine turno: chiude la sessione dell'utente agente se è rimasta aperta).

## Aggiornamento

In Claude Code: `/plugin`, scheda **Marketplaces**, aggiorna `wdm-agent`; poi `/reload-plugins`.
Da terminale:

```bash
claude plugin marketplace update wdm-agent
claude plugin update wdm-agent@wdm-agent
```

Le skill nuove si caricano al riavvio di Claude Code, o con `/reload-plugins`. L'agente dice
quando un aggiornamento serve.

## Disinstallazione

In Claude Code: `/plugin`, scheda **Installed**, seleziona `wdm-agent` e disinstallalo. Da
terminale:

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

**L'aggiornamento lo fa l'agente, sempre.** Dopo ogni modifica al plugin l'agente fa il commit
(fondamenta §10: il commit è suo, il push resta al dev), esegue i due comandi della sezione
Aggiornamento e verifica la versione in `~/.claude/plugins/installed_plugins.json`; non li
consegna mai al dev come passo da fare. Con il marketplace locale (il checkout) l'aggiornamento
legge la cartella; con il marketplace GitHub legge il remoto: se la versione resta quella vecchia
manca il push del dev, l'agente lo dice in una riga e riprova dopo il push.

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
| `tests/claude/` | la CLI `claude` con il plugin installato |
| `tests/sito/` | il sito di prova e una copia del tema base (wdm-theme) |

Il sito di prova è un WordPress usa e getta, in una cartella e in un database riservati alle
prove: le prove che scrivono in WordPress scrivono solo lì, lo azzerano prima di cominciare e lo
lasciano vuoto. Il setup, i controlli e la build del tema si provano su una copia del tema base,
che le prove leggono soltanto. I valori della macchina (cartella, database, PHP e socket di MAMP,
`wp-cli.phar`, site root del tema base) stanno in `tests/sito.local.json`, che non entra nel repo: si parte da una copia di
`tests/sito.example.json`. Cartella e database devono avere un nome che finisce con `-test`, e la
cartella al primo uso deve essere vuota: le prove ci lasciano il file `.wdm-agent-sito-di-prova`
e da allora svuotano solo una cartella che lo contiene. Per usarlo a mano:
`node tests/lib/sito.js install | reset | status | wp …`.

Su un altro Mac di Carlo il plugin **non** c'è finché non lo si installa anche lì: la copia che
Claude Code usa sta in `~/.claude/plugins/`, cartella esclusa dal repo `claude-global`. Si installa
dal remoto con i comandi della sezione Installazione; se `settings.json` arrivato da git
contiene ancora il marketplace locale `wdm-agent`, il comando lo sostituisce con quello GitHub.

A ogni release alza `version` in **entrambi** `.claude-plugin/plugin.json` e
`.claude-plugin/marketplace.json`, e crea il tag git corrispondente. Gli studenti installano
sempre dal remoto GitHub (repo pubblico), mai dal checkout.

## Come sono scritti i percorsi

Dentro una skill, un file della stessa skill si cita con percorso relativo alla sua cartella
(`scripts/setup.js`). Qualunque altro file del plugin si cita con `${CLAUDE_PLUGIN_ROOT}/…`,
che Claude Code espande nel testo delle skill e nei comandi degli hook, ovunque il plugin sia
installato. Dettagli in `shared/fse-foundations.md §12`.

## Storia

Nato il 2026-10-26 dalle skill `fse-*` che vivevano come cartelle globali in `~/.claude` sul Mac
di Carlo (spec e piano in `docs/`). La famiglia gemella per wdm-starter (`dev-*`, `design-*`)
non fa parte del plugin.
