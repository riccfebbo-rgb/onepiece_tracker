# Anime Tracker v3 — note di aggiornamento

## File

| File | Cosa fare |
|---|---|
| `index.html` | **sostituisce** quello attuale |
| `manifest.json` | nuovo — rende l'app installabile |
| `sw.js` | nuovo — service worker (offline) |
| `firestore.rules` | **non va sul sito**: si incolla nella console Firebase |

Tutto il resto (`icon.png`, `img/*.jpg`) resta com'è.

## Come applicare

1. Copia i primi tre file nella root del repo `onepiece_tracker`, allo stesso
   livello di `icon.png`, e fai commit.
2. **Importante:** pubblica sullo stesso indirizzo di prima. Il salvataggio del
   browser è legato al dominio: se cambi URL, i dati vecchi restano sull'URL vecchio.
3. Apri Firebase Console → Firestore Database → Regole, incolla il contenuto di
   `firestore.rules` e premi Pubblica.
4. Sempre in Google Cloud Console → API e servizi → Credenziali, apri la chiave
   API del progetto e limitala ai referrer HTTP del tuo dominio.

Al primo avvio vedrai un messaggio tipo *"Recuperati 347 episodi dal salvataggio
precedente"*: è la migrazione automatica dal vecchio formato.

---

## Perché ora i dati non si perdono

Era il problema principale. Le cause erano tre e sono state chiuse tutte.

**1. Il cloud sovrascriveva il locale.** `openTracker()` leggeva il localStorage e
subito dopo `applyData()` rimpiazzava tutto con il documento Firestore. Se quel
documento non aveva quell'anime, il tuo `Set` diventava vuoto.
Adesso locale e remoto vengono **uniti**, mai sostituiti.

**2. Non si poteva unire senza perdere qualcosa.** Un elenco di numeri non dice
*quando* un episodio è stato segnato, quindi unire due elenchi significa scegliere
quale buttare. Il nuovo formato tiene un timestamp per ogni episodio, sia per
"visto" sia per "non visto":

```json
{ "v":3, "w":{"12":1756400000000}, "u":{"13":1756400001000}, "r":{"12":[4,1756400002000]} }
```

Un episodio risulta visto se il timestamp in `w` è più recente di quello in `u`.
Con questa regola l'unione dà lo stesso risultato in qualunque ordine avvenga e
non può cancellare niente: è verificato da un test che fonde 200 scritture nei due
ordini opposti e confronta i risultati.

**3. Le cancellazioni erano definitive.** Ora:
- prima di ogni operazione distruttiva viene salvata una copia (ne restano 5);
- "Azzera progressi", "Salta filler", "Segna tutti" hanno **Annulla** nel toast;
- c'è **Esporta / Importa backup** in Impostazioni (l'import unisce, non sostituisce);
- il "reset" non cancella le chiavi, le marca — così l'annullamento funziona anche
  dopo che il cloud ha già sincronizzato.

Le vecchie chiavi (`onepiece_w`, `onepiece_r`, …) **non vengono toccate**: restano
nel browser come ultima rete di sicurezza.

Dalla console del browser, se qualcosa andasse storto:

```js
AnimeTracker.backups('onepiece')          // elenco copie con data e motivo
AnimeTracker.restoreBackup('onepiece', 0) // ripristina la più recente
AnimeTracker.stats()                      // quanti episodi risultano visti
```

### Un caso che avrebbe distrutto i dati

Il documento già su Firestore è nel vecchio formato (`{watched:[…], ratings:{…}}`).
Se avessi solo cambiato formato, al primo accesso da un dispositivo nuovo il codice
avrebbe letto quel documento come vuoto e poi l'avrebbe sovrascritto — perdendo
tutto lo storico. `normalize()` riconosce il vecchio formato e lo converte in
lettura, quindi la prima sincronizzazione lo recupera invece di cancellarlo.

---

## Bug corretti

| # | Problema | Soluzione |
|---|---|---|
| 1 | Il cloud sovrascriveva i progressi locali | merge con timestamp |
| 2 | Ogni click ricostruiva 1155 celle (l'`onSnapshot` rimbalzava sulla propria scrittura) | si ignora l'eco (`hasPendingWrites`), aggiornamento mirato della singola cella |
| 3 | 3 listener per cella (≈3500 in totale) | un solo listener delegato su tutta la griglia |
| 4 | `saveCloud()` senza `.catch()`: errori invisibili e unhandled rejection | stato di sync visibile, retry con backoff, ripresa quando torna la rete |
| 5 | Il pallino del voto sui film non compariva mai (CSS `.ep.has-rating` non copriva `.ep-movie`) | stile e render unificati |
| 6 | Gli episodi "misti" venivano contati fra i canonici | statistica separata |
| 7 | Flash di tema chiaro all'avvio (lo script era `type="module"`, quindi differito) | tema applicato da uno script inline nel `<head>` |
| 8 | Chiavi localStorage senza prefisso, su un dominio condiviso con gli altri tuoi repo GitHub Pages | prefisso `at:v3:` |
| 9 | **Se `gstatic.com` non rispondeva, l'app non partiva proprio** (import statico in cima al modulo) | Firebase caricato con `import()` dinamico dopo il primo render: senza rete l'app funziona lo stesso in locale |
| 10 | `signInWithPopup` fallisce nei browser in-app e in PWA su iOS, e l'errore era solo in console | fallback su `signInWithRedirect` + messaggio visibile |
| 11 | Griglia non raggiungibile da tastiera, modale senza focus trap | celle `<button>`, navigazione con le frecce, `<dialog>` nativo |
| 12 | `if (currentAnime === 'hxh' \|\| …)` scritto a mano in due punti | campo `hasSub` nel database |
| 13 | Nessuna regola Firestore nel repo | `firestore.rules` incluso |

## Novità

- **Grafica rifatta**: palette in OKLCH, colore d'accento diverso per ogni anime,
  tipografia di sistema con il serif corsivo solo negli accenti, ombre e raggi
  coerenti, tema chiaro/scuro/automatico che segue il sistema.
- **Card della libreria con i progressi**: percentuale, barra, prossimo episodio.
- Barra "Prossimo da vedere" con il **titolo** dell'episodio e, se il prossimo è
  un filler, la scorciatoia *"Salta al …"* per andare al primo canonico.
- Modale sostituita da un `<dialog>` nativo che su telefono diventa un **bottom sheet**.
- **"Segna tutti fino a qui"** al posto del banner che spuntava a sorpresa.
- Intestazioni delle saghe fisse durante lo scorrimento, `content-visibility` per
  disegnare solo le saghe in vista.
- **Titoli degli episodi** scaricati da MyAnimeList (Jikan) e tenuti in cache;
  disattivabile in Impostazioni, e se non c'è rete si ignora e basta.
- **PWA**: installabile, con service worker in *network-first* sull'HTML — quando
  aggiorni `index.html` la nuova versione arriva subito, la cache serve solo offline.
- Scorciatoie: `/` per cercare, `B` per tornare alla libreria, `Esc` per chiudere.

## Passata grafica (v3.1)

- **Libreria**: copertine grandi, titolo e progressi *sopra* la locandina con
  sfumatura, badge della percentuale, ingrandimento leggero al passaggio del mouse.
- **Testata dell'anime**: locandina in evidenza e la stessa immagine, sfocata, come
  fondale; titolo grande, barra dei progressi e "prossimo da vedere" in un blocco solo.
  Scorrendo resta una mini-locandina nella barra in alto.
- **Saghe senza emoji**: al posto dell'icona ogni saga ha una fascia con l'immagine
  di copertina sfocata e una barretta nel colore dell'anime. Se vuoi un'immagine
  diversa per una saga, aggiungi il campo facoltativo `art` alla saga:
  `{name:'Wano', s:878, e:1085, art:'img/saghe/wano.jpg'}`.
- **Più atmosfera**: tema scuro più profondo, alone del colore dell'anime dietro
  alla pagina, e una grana da pellicola quasi invisibile che toglie il "piatto".

## Nuovi episodi in automatico (v3.2)

All'avvio l'app chiede a MyAnimeList qual è l'ultimo episodio uscito (non più di
due volte al giorno) e, se ne trova di nuovi, li aggiunge alla griglia da sola:
avviso in basso, contatore "3 nuovi" sulla copertina in libreria, celle nuove
evidenziate finché non apri l'anime. Non devi più aggiornare `total` a mano.

Per una serie in corso il campo "episodi" di MyAnimeList resta vuoto, quindi il
numero viene preso dall'ultimo episodio presente nell'elenco. Due paletti:
il numero scritto nel file fa da pavimento (si può solo salire) e uno scarto
superiore a 400 episodi viene scartato come errore dell'API. Se sei senza rete
non succede niente. Si disattiva in Impostazioni, dove c'è anche "Controlla adesso".

## Muoversi dentro la lista (v3.4)

Tre modifiche che affrontano lo stesso problema: 1155 episodi sono tanti da
attraversare.

**Si apre già al punto in cui sei.** Prima entravi in One Piece e ti trovavi
all'episodio 1, con ottocento celle da scorrere. Ora la pagina si posiziona da
sola sulla saga in corso.

Perché funzionasse ho dovuto sistemare una cosa sotto il cofano: le saghe fuori
schermo non vengono disegnate (`content-visibility`), quindi il browser ne deve
stimare l'altezza, e con una stima fissa di 260px per tutte sbagliava di molto —
la barra di scorrimento saltava mentre scendevi e "vai all'episodio" atterrava
storto. Ora l'altezza si calcola dal numero di celle e dalla larghezza
disponibile: **scarto 0,0%** su tutte le saghe misurate.

**La barra "prossimo" ti segue.** Appena scorri, la testata con "Guarda ITA" esce
di scena; una barra sottile in basso mostra episodio, tipo e il bottone per farlo
partire. Tocchi il numero e salti alla cella. Sparisce quando apri una scheda e
quando torni in cima.

**I filtri si sommano.** Erano esclusivi: o "Canonici" o "Da vedere". Ora sono due
gruppi indipendenti — il tipo (uno alla volta) e lo stato (quanti ne vuoi) — così
*i canonici che non ho ancora visto* diventa una combinazione possibile. Gli
interruttori attivi sono colorati e c'è un "Azzera" che compare solo quando serve.

## Il baricentro (v3.5)

La home non è più una vetrina di copertine: è **l'episodio che devi guardare
adesso**. Apri il sito e trovi in grande la serie che stavi seguendo, il numero
dell'episodio, il suo titolo, se è canonico o filler, e i bottoni per guardarlo o
segnarlo. Le altre serie restano sotto, in formato ridotto.

Quale serie va in cima: quella toccata più di recente fra quelle non finite. Se
nessuna ha una data utile — succede con i progressi importati dal vecchio
formato, che non hanno un "quando" — vince quella in cui sei più avanti.

"Segna visto" funziona direttamente da lì e la schermata **avanza da sola** al
successivo, con Annulla nel messaggio in basso. Se sono usciti episodi nuovi,
compare la pastiglia accanto al tipo. "Tutti gli episodi" (o la locandina) apre
la griglia come prima, già posizionata al punto giusto.

### Perché non ha toccato i salvataggi

È una modifica di sola presentazione: legge lo stesso stato di prima, con le
stesse chiavi e lo stesso formato. Nessuna migrazione, nessun campo nuovo, niente
da convertire. Il test lo verifica esplicitamente: dopo aver segnato un episodio
dalla nuova home, il salvataggio ha ancora `v:3` con i suoi `w`, `u`, `r`, e le
vecchie chiavi del formato v1 sono ancora al loro posto.

## Manutenzione

Aggiungere un anime = aggiungere una voce a `ANIME_DB` in cima allo script; nessun
altro punto del codice dipende da un id specifico. Il numero di episodi ormai si
aggiorna da solo (vedi sopra), quindi `total` va toccato solo se vuoi correggerlo
a mano.

Per farmi aggiungere una serie servono tre cose:

1. il **nome**;
2. il link di **un episodio qualsiasi** (meglio il primo) — da lì ricavo il
   formato di tutti gli altri, zeri davanti compresi. Se hai anche il link SUB ITA,
   mandalo: comparirà il secondo bottone;
3. le **saghe**, se le vuoi divise (`Nome: 1-21`, una per riga). Se non le mandi
   metto un unico blocco con tutti gli episodi.

Facoltativi ma utili: gli intervalli dei **filler** (`54-60, 98-99`) e la
**copertina** — o un'immagine in `img/`, o l'indirizzo di una copertina online.
Il resto (numero di episodi, titoli, colore) lo ricavo io.

Il codice regge anche formati di indirizzo diversi da quelli attuali: oltre a
`.../pagine/001` funzionano `/ep-7`, `?ep=12`, `/episodio-005.html`. Basta che il
numero dell'episodio compaia nel link.

## Cosa resta da fare, se vorrai

- Separare `ANIME_DB` in un `data/anime.json` (adesso è ancora tutto in un file solo,
  per tenere il deploy su GitHub Pages banale).
- Sostituire le copertine `img/*.jpg` mancanti: se non ci sono, la card mostra un
  gradiente con l'iniziale — non si rompe, ma con le locandine è più bello.
