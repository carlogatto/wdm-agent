# wdm-agent — il flusso autonomo (design, 2026-10-30)

> Esito della sessione del 2026-10-29/30 su `wdm-agent` (1.2.0 → 1.3.0). Parte dai cinque
> punti decisi da Carlo il 2026-10-29 (`DESIGN.md → Log decisioni` di wdm-theme, ultima riga) e
> chiude i quattro punti lasciati aperti: cosa legge e produce `fse-brief`, la carta delle
> decisioni, il meccanismo del diff kit ↔ WP, il posto di `fse-menu-build` nella build del sito.
> Le scelte segnate **[proposta]** sono dell'agente, non ancora discusse con Carlo: si approvano
> o si correggono leggendo questo documento.

## 1. Intento e perché

Il flusso 1.2.0 chiede troppo e troppo spesso: `fse-kit` è dialogico per costruzione (ogni
contratto README "concordato con il dev prima dell'HTML", iterazione in browser a ogni passo),
`fse-build` costruisce una pagina per sessione e si ferma, i menu sono una sessione a parte. Un
sito di sei pagine costa quindici conversazioni e il designer passa il tempo a rispondere invece
che a giudicare.

Il flusso 1.3.0 inverte il rapporto: **l'agente decide nei tratti, il designer giudica i
deliverable**. Quattro gate umani, tutti su cose finite da guardare:

| # | Gate | Deliverable | Skill che lo consegna |
|---|---|---|---|
| 1 | brief | mappa del sito, token applicati, tono, plugin, in `DESIGN.md` e nel catalogo kit | `fse-brief` (nuova) |
| 2 | telaio | kit di header, footer, form di default su `:8848` | `fse-kit` |
| 3 | kit di pagina (uno per pagina) | kit completo con i testi veri su `:8848` | `fse-kit` |
| 4 | sito costruito | tutte le pagine approvate in WordPress, menu allineati | `fse-build` |

A ogni gate le osservazioni del designer tornano all'agente come revisioni; il gate si chiude
con un ok esplicito in un turno successivo. Fra un gate e l'altro l'agente non fa domande: decide
secondo la carta (§4) e marca `[da confermare]` ciò che non può decidere.

Il primo run del nuovo flusso è la build del sito di wdm-theme con `fse-build` 1.3.0: la Home
(kit approvato il 2026-10-29) è la pagina nuova; le righe già `implementata` (Contatti) e `kit`
(Catalogo blocchi, form di default del telaio) passano dal diff e ricevono solo la loro
differenza; Servizi è `da eliminare` (spec prodotto §8) e la sua cancellazione attende l'ok.

## 2. Obiettivi, non obiettivi, anti-obiettivi

**Obiettivi**
- `fse-brief` nuova: legge `docs/brief/` e consegna il gate 1.
- `fse-kit` senza gate intermedi: un item per sessione (telaio, poi una pagina), una review a fine
  item, revisioni fino all'ok.
- `fse-build` come build del sito: tutte le righe `kit`, rieseguibile, applica solo la differenza,
  menu inclusi, una review finale.
- La carta delle decisioni scritta una volta nelle fondamenta e citata dalle skill.
- Plugin 1.3.0 con test verdi, README aggiornato, reinstallato e verificato in una conversazione
  nuova.

**Non obiettivi**
- Cambiare l'anatomia dei blocchi, la regola di parità (§3–§5 delle fondamenta), gli hook, lo
  script dei token, `fse-block-edit`, lo script `wp-navigation.php`.
- Un formato obbligatorio per `docs/brief/`: il designer deposita quello che ha.
- Un'interfaccia di approvazione: il gate è un messaggio in chat, lo stato è in `DESIGN.md`.
- Ricostruire la Home in questa sessione.

**Anti-obiettivi**
- Una build che cancella o sposta contenuto senza un ok in un turno successivo.
- Una skill che "decide" un fatto sul cliente (telefono, prezzo, data) inventandolo.
- Un `fse-build` che fa domande in corsa.
- Riferimenti a piani, fasi o decisioni numerate nel testo delle skill e delle fondamenta.

## 3. `fse-brief` — cosa legge, cosa produce

### 3.1 Posto nel flusso
`fse-theme-setup` → **`fse-brief`** → `fse-kit` (telaio) → `fse-kit` (pagine) → `fse-build`.
Il setup resta prima **[proposta]**: il brief scrive in `DESIGN.md` (che il setup crea), modifica
`theme.json` (tema già rinominato), installa plugin via WP-CLI (WordPress già installato). Il
setup chiude con "prossima sessione: `fse-brief`". Su wdm-theme `fse-brief` non gira: il brief
del tema è la spec prodotto; le skill devono funzionare anche senza `## Brief` (§3.5).

### 3.2 Input: `docs/brief/` nella root del sito
Cartella libera. L'agente legge **ogni** file: testo (`.md`, `.txt`, `.html`, `.csv`, `.json`),
PDF e immagini con `Read`, `.docx` con la skill `docx` se presente, altrimenti lo elenca come non
letto. Niente convenzioni di nome o struttura; un file `README.md` nel brief, se c'è, è letto
per primo. Cartella mancante o vuota → **stop** con un solo paragrafo che dice cosa depositare
(brand e logo, mappa o elenco delle pagine, testi o appunti per pagina, immagini, riferimenti
visivi, plugin o integrazioni richieste, contatti e dati societari).

Ciò che il brief **non** contiene si propone secondo la carta (§4): mappa derivata dai testi,
tono derivato dai testi e dai riferimenti, token derivati dal logo e dai riferimenti; i fatti sul
cliente mancanti vanno in `[da confermare]`.

### 3.3 Output
1. **`DESIGN.md → ## Brief`** (sezione nuova, fra `## Design Tokens` e `## Telaio`; template in
   fondamenta §11):
   ```markdown
   ## Brief
   Stato: bozza | approvato YYYY-MM-DD · Fonte: `docs/brief/` (N file letti, M non letti: …)

   ### Mappa
   | Pagina | URL | Menu | Contenuto | Fonti |
   |---|---|---|---|---|
   | Home | / | principale, footer Pagine | claim, 3 servizi, cta contatti | brief/home.md, brief/azienda.pdf |

   ### Tono
   Lingua, persona (tu/voi/lei), registro, lessico da usare e da evitare, 3 esempi di frase.

   ### Plugin
   | Esigenza | Plugin | Decisione |
   |---|---|---|
   | form di contatto | Formidable Forms | fisso (famiglia FSE) |

   ### Immagini
   | File (`assets/img/`) | Uso | Origine | Nota |
   ```
   La mappa è il contratto delle pagine (URL con i genitori, posto nei menu, una riga di
   contenuto, i file del brief che la coprono); `## Pagine` riceve una riga `da progettare` per
   pagina (Kit e Blocchi vuoti) e `## Telaio` torna `da progettare` su header, footer, form di
   default (il telaio ereditato dallo starter va riprogettato nel kit del progetto).
2. **Token in `theme.json`**: palette (i ruoli del tema sono fissi: `base`, `surface`, `main`,
   `accent`, `muted`, `border`, `dark`; il brief dà i valori), font (file forniti nel brief
   copiati in `assets/fonts/`; font nominato senza file → scaricato da Google Fonts in woff2
   latin se esiste, altrimenti `[da confermare]` e si tiene il font del tema), spaziature e raggi
   solo se il brand li cambia. Poi `sync-theme-json-tokens.js` (DESIGN.md + `wp-global-styles.css`)
   e `npm run build`: il catalogo `https://localhost:8848/html/{prefix}-blocks.html` mostra i
   blocchi esistenti nel brand nuovo ed è l'oggetto della review. Dentro `fse-brief` la
   rigenerazione dei token è pre-autorizzata (fondamenta §12: il deliverable è sotto review).
3. **Immagini** utilizzabili copiate in `assets/img/` con nomi slug (logo `.svg`, foto `.jpg`),
   elencate nella tabella; immagini mancanti per la mappa → riga `[da confermare]` (il kit userà
   un placeholder).
4. **Review in chat** (gate 1): mappa, tono, token (URL del catalogo), plugin proposti con la
   ragione, tabella `[da confermare]` con il default scelto per ciascuno, file non letti. Fine del
   turno. Turno successivo: osservazioni → revisione e nuova review; ok → `Stato: approvato`,
   installazione dei plugin approvati (`{wp-cli} plugin install … --activate`, Formidable è già
   del setup), riga in `## Log decisioni`.

### 3.4 Stop (i soli)
Guard · `DESIGN.md` assente (prima `fse-theme-setup`) · `docs/brief/` vuota · `## Brief` già
`approvato` (si riapre solo su richiesta esplicita: "rivediamo il brief").

### 3.5 Progetti senza `## Brief`
wdm-theme e i progetti cliente già avviati non hanno la sezione. `fse-kit` e `fse-build` **non si
fermano**: lo segnalano nella riga di apertura ("brief assente: tono e mappa da DESIGN.md e dai kit
esistenti") e decidono da soli come per il resto. Un progetto nuovo arriva al kit con il brief
perché il setup lo indica come sessione successiva.

## 4. La carta delle decisioni (fondamenta §10)

Tre classi, valide in ogni skill. Fuori dai gate l'agente non chiede: classifica e procede.

| Classe | Cosa | Come si traccia |
|---|---|---|
| **Decide e logga** | testi nel tono del brief (riscrittura di appunti, titoli, microcopy, alt, etichette dei menu); layout dentro il sistema (quale blocco e variante, ordine delle sezioni della mappa, colonne, `headingLevel`, sfondi dalla palette); id e ancore; slug dai titoli; immagini scelte fra quelle fornite; **numeri verificabili** dal codice o dal DB (conteggi, versioni, date del repo); link a pagine e ancore della mappa; contratti README di blocchi e varianti nuovi; attributi e default; configurazione dei plugin approvati | nel kit/README/`DESIGN.md` dove vive; **una** riga in `## Log decisioni` per deliverable con le scelte non ovvie e il perché |
| **Default + `[da confermare]`** | fatti sul cliente assenti dal brief (telefono, indirizzo, orari, prezzi, nomi, P.IVA); numeri e affermazioni non verificabili; URL esterni non nel brief; testi legali e policy; immagini mancanti; punti in cui il brief si contraddice; font senza file | testo: `[da confermare]` inline; valore non testuale: default plausibile + commento adiacente `<!-- attr "valore" [da confermare]: perché -->` (un placeholder in un `href` è un link rotto); tutti raccolti nella **tabella della review** del gate con il default; dopo il gate restano in `## Domande aperte` solo quelli che il designer ha lasciato aperti |
| **Stop** | guard; input del deliverable assente (brief vuoto, kit mancante, blocco senza README); cancellazioni (pagine, blocchi, voci di menu, `wp_navigation`) → diff mostrato, si applica solo con un ok in un **turno successivo**; rinomina o rimozione di attributi implementati; post bloccato da un altro utente; richiesta fuori dalla skill | fine del turno con il diff o la domanda, **una**, con proposta |

Regole di contorno:
- `[da confermare]` mai in un `href`, in un `src`, in un attributo numerico: lì default + commento.
- Il testo di un `[da confermare]` è la domanda in sé ("[da confermare] telefono dello studio"),
  così il designer la legge nel kit senza cercare la tabella.
- "Niente da confermare" è un esito normale e si dice in una riga.
- Le revisioni del designer a un gate sono decisioni sue: si applicano e si loggano come "richiesta
  del designer", non si discutono.

## 5. `fse-kit` 1.3.0

- **Principio**: il kit è il design vero, fatto dall'agente dentro il sistema (telaio, blocchi,
  token) e dentro il brief (mappa, tono, fonti). Si disegna un item per sessione: telaio, poi le
  pagine nell'ordine della mappa. La frase "l'unica fase in cui chiedere è il lavoro" sparisce;
  al suo posto la carta (§4).
- **Step 3a** (contratto README): lo scrive l'agente, nessun accordo preventivo; il README è
  parte del deliverable della pagina.
- **Step 3f e 4.5** (controllo a 1440/768/390): lo fa l'agente con Playwright, screenshot in
  `.playwright-mcp/shots/kit-{item}-*.png`; niente "iterare con il dev".
- **Testi di pagina**: dal brief quando il brief li dà (verbatim, ortografia corretta), scritti
  dall'agente nel tono del brief quando dà appunti, `[da confermare]` per i fatti (§4). Senza
  brief (§3.5): testi dall'agente nel tono che i kit esistenti già usano.
- **Fattibilità**: nessun vincolo kit → render (`render.php` stampa qualunque HTML). Restano le
  regole di anatomia: una `<section>` radice per blocco, niente `<script>`/`<style>` inline (JS in
  `view.js`, CSS in `style.scss`), Formidable unica deroga di parità (§4 fondamenta).
- **Fine item = review** (gate 2 o 3): URL su `:8848`, screenshot, blocchi e varianti nuovi con
  il loro contratto, decisioni prese, tabella `[da confermare]`. La riga resta `da progettare`
  con `⏳ kit {item} in revisione (dal YYYY-MM-DD)` in `## Domande aperte`; all'ok del designer
  (turno successivo) → `kit`, ⏳ rimossa, riga di log. Le revisioni chieste dopo la build (gate 4)
  passano da qui senza nuovo gate: la modifica è richiesta del designer, la riga resta `kit`,
  `fse-build` riapplica la differenza.
- **Immagine, blocco nuovo, variante nuova** dentro la pagina: come oggi (Step 3 prima del kit di
  pagina), senza gate intermedio.

## 6. `fse-build` 1.3.0 — la build del sito

### 6.1 Perimetro di un run
Tutte le righe di `## Telaio` e `## Pagine` che **non** sono `da progettare` (genitori prima dei
figli): `kit` e `implementata` passano entrambe dal diff (una pagina allineata risponde "0
differenze"; una revisione del kit dopo il gate 4 non retrocede la riga: il run successivo
applica la differenza), `da eliminare` (§6.3) entra come cancellazione. Poi i menu. Le righe
`da progettare` sono saltate e nominate nel report. Un run con una sola pagina approvata
costruisce quella pagina e trova le altre a 0 differenze. **Mode B** (stop prima di ogni scaffold)
sparisce **[proposta]**: la build è autonoma per definizione, i suoi stop sono quelli della carta.

### 6.2 Ordine
1. **Telaio** (se `kit`): confronto `html/{prefix}-telaio.html` ↔ `parts/*.html` come oggi
   (Step 1), modifica delle part, `npm run build`, verifica §9. Il menu **non** si fa qui.
2. **Pagine**, in ordine di mappa: per ciascuna 2a (K dal kit compilato via README) → 2b (blocchi
   mancanti, scaffold di tutte le varianti; variante o attributo additivo mancante →
   `fse-block-edit` inline) → 2c (build + smoke) → **2d diff** (§6.3) → 2e scrittura della
   differenza → 2f/2g verifiche e parità → 2h documentazione. Una pagina che si ferma al diff
   (cancellazioni, §6.3) non ferma le altre: si passa alla successiva e il report raccoglie i diff
   in attesa.
3. **Menu**: `fse-menu-build` inline (`dump` → `plan` → `apply`) dopo che le pagine esistono. Lo
   stop del diff resta identico: `apply` exit 3 → il diff entra nel report finale come domanda,
   `apply … confirm` solo in un turno successivo, dopo la risposta del designer. `fse-menu-build`
   resta anche skill autonoma per la manutenzione; la riga della sua tabella delle
   razionalizzazioni ("The telaio session stops at the diff") si riscrive: la build del sito
   chiude il run con il diff nel report, come per le cancellazioni.
4. **Report finale** (gate 4) e stop.

### 6.3 Il diff kit ↔ WP (2d)
Principio: **il kit è la fonte dei valori, WordPress non perde mai nulla senza un ok**. Script
nuovo `skills/fse-build/scripts/wp-page.php`, gemello di `wp-navigation.php`, eseguito con
`{wp-cli} eval-file`; l'agente produce come oggi `{scratchpad}/page-{slug}.html` da K (markup
generato dal kit secondo i README, deterministico: gli id di immagini, post, form e pagine sono
risolti da WP, non inventati), lo script fa la parte meccanica.

- `plan {file} page={slug}`: `parse_blocks` del file generato (G) e del `post_content` della
  pagina (W); allineamento dei blocchi di primo livello per chiave `(nome blocco, variante)`
  con una sottosequenza comune più lunga; per ogni coppia confronto degli **attributi**
  normalizzati (entità decodificate, spazi collassati, default omessi, `wptexturize` ignorato)
  e ricorsivo sui figli. Esito per blocco: `uguale` · `modificato` (attributi diversi: il kit
  vince, prima/dopo nel report) · `nuovo` (in G, non in W: inserito alla sua posizione) ·
  `spostato` (stessa coppia, ordine diverso: si riordina, nulla si perde) · `da cancellare` (in
  W, non in G: blocco che il kit non ha più **o** blocco aggiunto a mano). Stampa il diff leggibile
  e il JSON del piano; exit **0** nessuna differenza · **1** differenze senza cancellazioni ·
  **3** almeno una cancellazione.
- `apply {file} page={slug}`: scrive il contenuto fuso — i blocchi `uguale` tengono la stringa di
  W byte per byte (così `postId`, `imageId` e whitespace di WP non cambiano), `modificato` e
  `nuovo` prendono il markup di G, `spostato` si riordina — e scrive solo se c'è almeno una
  differenza; con exit 3 **non scrive** e lascia il diff al report: `apply … confirm` (turno
  successivo) applica anche le cancellazioni. Pagina assente → `post create` dal file intero.
- Idempotente: il secondo run risponde "0 differenze" su ogni pagina e non tocca `post_modified`.
- Page options (`{prefix}_show_title`, `{prefix}_show_form`) derivate dal kit come oggi, scritte
  solo se diverse.
- **Password dell'utente agente**: input del run, non decisione. Dal prompt; se manca, **una**
  domanda all'avvio del run, prima di qualunque scrittura. Senza password il run procede, salta i
  passi Playwright (2c smoke test, 2g editor) e nessuna pagina arriva a `implementata`: resta
  `kit` con la nota "verifica editor mancante" nel report. Mai scritta, mai ripetuta.
- **Pagine da eliminare**: stato nuovo `da eliminare` in `## Pagine` (lo scrive `fse-kit` quando
  il designer toglie una pagina dalla mappa, o il dev a mano; la riga e il kit restano finché la
  cancellazione non è eseguita). Il run la mette nel report come cancellazione; `confirm` (turno
  successivo) cancella la pagina in WP (`post delete --force`), il file kit, la riga, e logga.
  Nessuna euristica: una pagina in WP che non ha una riga in `## Pagine` (Pagina di esempio,
  Privacy Policy) non è mai toccata ed è elencata una volta nel report come "fuori dal flusso".
  Servizi, che la spec prodotto §8 elimina, prende `da eliminare` nella sessione del piano.
- Il vecchio stop "pagina modificata a mano" diventa un caso del diff: un blocco aggiunto a mano
  compare come `da cancellare` e non viene mai rimosso senza `confirm`; un attributo modificato a
  mano viene sovrascritto dal kit e **segnalato** nel report (se il designer lo vuole, lo mette
  nel kit: stessa regola dei menu). **[proposta]**

### 6.4 Report finale (gate 4)
Per pagina: id, permalink, blocchi creati, modifiche additive, esito del diff (uguale /
modificato / nuovo / spostato / in attesa di confirm), immagini importate, `[da confermare]` e
link `#` residui, differenze di parità, screenshot. Menu: per menu creato / aggiornato / 0
differenze / diff in attesa, orfane. Pagine saltate (`da progettare`) e fuori dal flusso. Mai la
password. `DESIGN.md`: `## Pagine` `implementata` solo con 2g verde; `## Blocchi`; `## Navigazione`
(da `fse-menu-build` Step 5); una riga di log per il run; `⏳ build sito: pagina {X} {M}/{N} (dal
…)` durante il run, rimossa alla fine. Il run successivo riparte da zero e trova le pagine a 0
differenze: non c'è stato di avanzamento da riprendere.

### 6.5 Stop (i soli)
Guard · `npm run build` rosso su codice non di questo run · kit o html compilato mancanti per una
riga `kit` · blocco senza README/attributi/markup · elemento del kit non mappabile al README ·
pagina genitore mancante · post bloccato · modifica non additiva a un blocco implementato ·
errori console in un blocco implementato fuori da questo run. Le cancellazioni e i diff dei menu
**non** fermano il run: lo chiudono con le domande nel report.

## 7. Fondamenta

- **§1**: tabella dei gate (§1 di questo documento) al posto di "Two phases, promoted to sessions":
  sei momenti (setup, brief, kit telaio, kit pagina ×N, build sito, manutenzione), chi decide, il
  deliverable del gate, la sessione. Il confine di sessione del kit resta l'item; quello della
  build è il **sito**.
- **§10**: la carta (§4 di questo documento) sostituisce il punto "Every question the agent feels
  like asking…"; il resto dell'igiene resta. Il formato della ⏳ accoglie i due casi nuovi (`⏳ kit
  {item} in revisione`, `⏳ build sito: pagina {X} {M}/{N}`).
- **§11**: template con `## Brief`; stato `da eliminare` per `## Pagine` (verifica su disco: la
  pagina assente in WP e il kit assente → la riga si toglie, è l'unico caso in cui il disco chiude
  una riga); regola di verifica: `## Brief` assente → flag "brief assente", mai stop; `Stato:
  approvato` è scritto solo da `fse-brief` all'ok del designer.
- **§4**: la frase sul kit "producibile da un render.php" resta solo come regola di anatomia (una
  radice, niente script/style inline).
- Via i riferimenti a piani e fasi: `fse-build` ("decision 14 of the plan"), §7 ("Phase 4 M5").
  Le "Phase 1–5" interne di `fse-theme-setup` sono le sue fasi di esecuzione, non piani: restano.

## 8. Plugin: struttura, test, README, versione

- `skills/fse-brief/SKILL.md` (frontmatter solo `name` + `description`, trigger: "leggi il
  brief", "partiamo dal brief", "prepara il brief del progetto", `/fse-brief`, o `## Pagine` con
  la sola Home del setup).
- `skills/fse-build/scripts/wp-page.php` (`plan`, `apply`, `apply … confirm`, `page=` per slug o
  id, `parts=`-like `dry=1` per i test che scrivono in una pagina di prova).
- Test: `test-skill-refs.sh` a 6 skill (+ `wp-page.php` citato in `fse-build`, sync citato in
  `fse-brief`); `test-readme.sh` con `fse-brief` nella tabella; `test-no-plan-refs.sh` nuovo
  (pattern: `of the plan`, `Phase [0-9]+ M[0-9]`, `Task [0-9]`, `decision [0-9]+`, `piano` in
  `skills/*/SKILL.md` e `shared/fse-foundations.md`, esclusi i titoli `## Phase` di
  `fse-theme-setup`); `test-wp-page.sh` nuovo sul pattern di `test-sync-marker.sh`: con `{wp-cli}`
  di wdm-theme raggiungibile crea una pagina di prova `wdm-agent-test-{ts}` in bozza, esegue
  `plan`/`apply` su tre casi (pagina vuota, attributo modificato, blocco in più → exit 3 senza
  scrittura), poi la cancella; senza WP → SKIP. `tests/ACCEPTANCE.md` riceve la riga 1.3.0.
- README: tabella a 6 skill, sezione nuova "Il flusso" con i quattro gate (10 righe), ciclo di
  sviluppo invariato.
- Versione **1.3.0** in `plugin.json` e `marketplace.json`; a fine sessione `claude plugin
  uninstall … && claude plugin install …`; verifica in una conversazione nuova (criterio: le 6
  skill elencate, `/wdm-agent:fse-brief` legge DESIGN.md e applica il guard).

## 9. Fuori dal plugin (progetto wdm-theme)

- `CLAUDE.md` (site root): riga `fse-brief` nella tabella di routing, descrizione di `fse-build`
  come build del sito, `## Brief` nell'elenco delle sezioni da leggere; viaggia così nei progetti
  cliente via `fse-theme-setup`.
- Spec prodotto `{site-root}/docs/superpowers/specs/2026-10-26-wdm-theme-product-design.md`: §1 (il ciclo
  diventa brief → kit → README → build → WordPress), §11 fase 5 (kit per pagina, poi build del
  sito rieseguibile a ogni pagina approvata, menu dentro la build).
- Spec plugin `docs/2026-10-26-wdm-agent-plugin-design.md` (copia nel plugin e in wdm-theme): §4
  struttura a 6 skill + script `wp-page.php`, rimando a questo documento.
- `DESIGN.md` di wdm-theme: nessun `## Brief` (§3.5), Servizi → `da eliminare`, riga di log a
  fine sessione, Domanda aperta del 2026-10-29 chiusa.

## 10. Verifica (criteri di accettazione)

1. `bash tests/run.sh` → ALL GREEN, inclusi i due test nuovi (`test-wp-page` eseguito, non SKIP,
   su questo Mac).
2. Nessuna occorrenza dei pattern di `test-no-plan-refs.sh` in skill e fondamenta.
3. In una conversazione nuova su wdm-theme: le 6 skill `wdm-agent:*` elencate;
   `/wdm-agent:fse-brief` si ferma su "`docs/brief/` vuota" con il paragrafo di istruzioni.
4. Lettura cieca: un sottoagente legge `fse-brief/SKILL.md` e `fse-build/SKILL.md` 1.3.0 e
   descrive il flusso con i quattro gate senza altre fonti.
5. `wp-page.php plan` su `page=home` di wdm-theme con il markup generato dal kit Home attuale
   restituisce exit 1 (hero `modificato`, 9 `nuovo`, 0 cancellazioni) senza scrivere; su
   `page=contatti` exit 0 o solo `modificato`; la prova generale del primo run.

## 11. Lasciato al costruttore

- Forma esatta dell'allineamento in `wp-page.php` (LCS per chiave o scansione posizionale con
  look-ahead), purché valgano gli esiti del §6.3 e il test dei tre casi.
- Normalizzazione degli attributi: elenco dei campi ignorati nel confronto (`imageUrl` quando
  `imageId` coincide; `postId` risolto per titolo).
- Testo esatto del paragrafo "cosa depositare in `docs/brief/`" e del template `## Brief`.
- Dove mettere gli screenshot del kit (`.playwright-mcp/shots/`, già gitignored).
- Ordine di riscrittura dei file del plugin e della spec prodotto nel piano.

## 12. Approvazione

Da approvare da Carlo leggendo questo documento. Le **[proposta]** da confermare: setup prima
del brief (§3.1); Mode B rimosso (§6.1); un attributo modificato a mano in WP viene sovrascritto
dal kit e segnalato, mai conservato (§6.3); le cancellazioni (blocchi, pagine, menu) attendono un
ok in un turno successivo ma non fermano il resto del run (§6.2, §6.5). Scelte fatte dopo la
lettura cieca del documento (controllo costruttore): perimetro del run = tutte le righe non
`da progettare` (§6.1); stato `da eliminare` al posto di un'euristica sulle pagine orfane (§6.3);
password chiesta una volta all'avvio, run senza Playwright se manca (§6.3). Senza correzioni,
proposte e scelte valgono come approvate per il piano.
