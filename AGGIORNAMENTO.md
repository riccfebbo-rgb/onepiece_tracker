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

## Manutenzione

Aggiungere un anime = aggiungere una voce a `ANIME_DB` in cima allo script; nessun
altro punto del codice dipende da un id specifico. Per One Piece che continua, il
numero di episodi si aggiorna in **un solo posto**: il campo `total` (e l'ultima
saga, se ne inizia una nuova).

## Cosa resta da fare, se vorrai

- Separare `ANIME_DB` in un `data/anime.json` (adesso è ancora tutto in un file solo,
  per tenere il deploy su GitHub Pages banale).
- Sostituire le copertine `img/*.jpg` mancanti: se non ci sono, la card mostra un
  gradiente con l'iniziale — non si rompe, ma con le locandine è più bello.
