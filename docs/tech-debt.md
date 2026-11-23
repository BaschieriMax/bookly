# Technical Debt Log — Bookly

Registra ogni soluzione provvisoria. Nessuna soluzione temporanea viene presentata come architettura definitiva.

## Voci

```text
ID: TD-001
Problema:
L'app gira su Render free: va in pausa dopo 15 minuti di inattività, con cold start di 30-60 s.

Motivo:
Vincolo di costo zero per l'MVP (DEC-010).

Impatto:
Il primo cliente che apre la pagina di un'attività dopo un periodo di inattività aspetta fino a un minuto:
rischio di abbandono della prenotazione.
Mitigato in parte (DEC-034, DEC-035): cron-job.org chiama l'app ogni 15 minuti dalle 7 alle 22 e
di giorno la tiene sveglia; di notte va in pausa e il primo visitatore aspetta il risveglio.

Soluzione futura:
Passare al piano Render a pagamento più economico (o a un'alternativa equivalente) al primo tenant pagante.

Priorità:
Media (diventa Alta con il primo cliente reale)
```

```text
ID: TD-002
Problema:
I promemoria dipendono da un cron di GitHub Actions invece che da un job scheduler dell'app.

Motivo:
Con Render free un BackgroundService non gira mentre l'istanza è in pausa (DEC-012).

Impatto:
Possibili ritardi; dipendenza da GitHub per una funzione di prodotto.
Osservato in produzione (19/11/2026): nelle prime 18 ore il cron ogni 15 minuti è partito solo
2 volte. I promemoria possono arrivare tardi o saltare, e l'istanza Render non resta sveglia.
Mitigato (DEC-034): cron-job.org come pianificatore principale, GitHub Actions come riserva.
Resta la dipendenza da un servizio esterno per una funzione di prodotto.

Soluzione futura:
Con un'istanza sempre attiva, spostare la logica in un BackgroundService con PeriodicTimer
(la logica del service resta la stessa, cambia solo il trigger).

Priorità:
Bassa (con cron-job.org attivo e notifiche dei fallimenti)
```

```text
ID: TD-003
Problema:
npm audit segnala una vulnerabilità "high" (ReDoS, GHSA-fc5q-39xc-vjpf) in picomatch ≤ 4.0.7,
usato da Vite, Vitest e typescript-eslint. Non esiste ancora una versione corretta.

Motivo:
È una dipendenza solo di sviluppo/build, sfruttabile solo con pattern glob controllati da un
attaccante: non arriva nel bundle né sul server.

Impatto:
Nessuno a runtime. La CI verifica le sole dipendenze di produzione (`npm audit --omit=dev`).

Soluzione futura:
Aggiornare appena esce picomatch ≥ 4.0.8 (Dependabot) e riportare l'audit completo in CI.

Priorità:
Bassa

Stato:
Chiuso il 2026-11-19 (Step 14): `npm audit` (anche dipendenze di sviluppo) riporta 0 vulnerabilità.
```

```text
ID: TD-004
Problema:
Il frontend usa TypeScript 6.0 invece di TypeScript 7 (DEC-020).

Motivo:
typescript-eslint non supporta ancora TypeScript ≥ 6.1.

Impatto:
Type-check più lento rispetto al compilatore nativo; nessun impatto funzionale.

Soluzione futura:
Passare a TypeScript 7 quando typescript-eslint lo supporta, oppure se Massimo sceglie oxlint.
In quel momento togliere anche il blocco `typescript >= 6.1.0` in `.github/dependabot.yml`
(aggiunto dopo che la PR #39 di Dependabot aveva portato TypeScript 7 e rotto `npm ci`).

Priorità:
Bassa
```

```text
ID: TD-005
Problema:
Informativa privacy e termini di servizio sono bozze con campi da completare (ragione sociale,
contatti, regioni dei fornitori, limitazioni di responsabilità) e manca l'accordo art. 28 con le
attività.

Motivo:
I testi legali devono essere validati da un professionista (skill booking-domain, GDPR).

Impatto:
Non si può andare in produzione con clienti reali finché i testi non sono definitivi.

Soluzione futura:
Completare i campi in apps/web/src/i18n/it/legal.json, far validare i testi, preparare il DPA
per le attività, togliere l'avviso "Bozza" (LegalPage).

Priorità:
Alta (da chiudere prima della release, Step 15)
```

```text
ID: TD-006
Problema:
La conservazione non copre gli account inattivi e il cambio email non è self-service.

Motivo:
Manca il tracciamento dell'ultima attività; il cambio email richiede una doppia conferma
(vecchio e nuovo indirizzo) non ancora implementata.

Impatto:
Account confermati ma abbandonati restano finché l'utente non li elimina; per cambiare email
serve il supporto.

Soluzione futura:
Salvare LastActivityAt al login, avvisare dopo 23 mesi di inattività e anonimizzare a 24;
flusso di cambio email con token su entrambi gli indirizzi.

Priorità:
Media
```

```text
ID: TD-007
Problema:
Gli account SuperAdmin e Owner sono protetti solo da password (niente secondo fattore).

Motivo:
MFA e passkey sono nice-to-have nell'MVP (overview §5).

Impatto:
Una password rubata del super-admin dà accesso alla gestione di tutte le attività (non ai loro
appuntamenti). Mitigato da lockout dopo 5 tentativi, rate limit e password di almeno 10
caratteri.

Soluzione futura:
Passkey (supportate da Identity in .NET 10) o TOTP, obbligatori per SuperAdmin e consigliati
per gli Owner.

Priorità:
Media (Alta prima di avere molte attività sulla piattaforma)
```

```text
ID: TD-008
Problema:
La rubrica clienti dell'attività (DEC-037) si alimenta solo dal dialog "Nuovo appuntamento":
non c'è una pagina per vedere, correggere o eliminare una voce.

Motivo:
Lo step 1 copre l'inserimento degli appuntamenti; la gestione della rubrica è una funzione a sé.

Impatto:
Un numero sbagliato si corregge solo creando una nuova voce. Una richiesta GDPR di un cliente
senza account (accesso, rettifica, cancellazione) oggi va gestita dal supporto sul database;
l'anonimizzazione automatica dopo 24 mesi senza appuntamenti funziona già.

Soluzione futura:
Pagina "Clienti" nell'area dell'attività: elenco con ricerca, modifica, anonimizzazione su
richiesta e storico appuntamenti del cliente.

Priorità:
Media

Stato:
Chiuso il 2026-11-20 (DEC-038): pagina "Clienti" con elenco, correzione, export JSON e
cancellazione (anonimizzazione) delle voci della rubrica.
```

```text
ID: TD-009
Problema:
Il limite giornaliero delle email di sospensione (DEC-039) è un contatore interno fisso: 80
email al giorno UTC. Non conosce la quota reale di Resend né le altre email del giorno
(conferme, inviti, annullamenti e, dal 23/11/2026, fino a 2 avvisi all'attività per ogni
prenotazione online, DEC-040).

Motivo:
Resend free consegna 100 email al giorno in tutto e l'SMTP non espone la quota residua: un
numero fisso con margine è la soluzione più semplice e prevedibile.

Impatto:
In un giorno con molte altre email la quota di Resend può finire prima. Le email di sospensione
rimaste falliscono e ripartono con i tentativi successivi (fino a 8, in circa un giorno e mezzo);
quelle inviate nella richiesta (conferme, avvisi di nuova prenotazione) non si ripetono e si
perdono, ma la prenotazione resta salvata. Con
attività grandi la sospensione può richiedere più giorni per avvisare tutti. Con il mittente
onboarding@resend.dev, finché il dominio non è verificato (deploy §8), le email arrivano solo
all'indirizzo dell'account Resend.

Soluzione futura:
Al passaggio a un piano Resend a pagamento (o con il dominio verificato e volumi più alti)
alzare SuspensionNotices__DailyLimit su Render; in alternativa leggere la quota dall'API di
Resend e riconoscere l'errore di quota esaurita.

Priorità:
Bassa
```

```text
ID: TD-010
Problema:
I link delle email all'attività (disdetta del cliente, DEC-027; nuova prenotazione, DEC-040)
puntano a /admin, che apre l'attività selezionata in quel momento nel browser. Il link non dice
di quale attività si tratta.

Motivo:
L'attività attiva vive nello stato del frontend (store Zustand); quasi tutti i titolari hanno una
sola attività.

Impatto:
Un titolare o un operatore con più attività può aprire il calendario di un'altra attività e non
trovare l'appuntamento finché non cambia attività dal selettore.

Soluzione futura:
Aggiungere al link l'attività (es. /admin?attivita=<slug>&data=…) e far scegliere al frontend
quella attività, se l'utente ne è membro.

Priorità:
Bassa
```

```text
ID: TD-011
Problema:
Gli avvisi di nuova prenotazione (DEC-040), come la conferma al cliente e gli avvisi di disdetta,
partono dentro la richiesta di prenotazione, una connessione SMTP per email.

Motivo:
Riusa il meccanismo delle disdette (DEC-027) senza una coda: è semplice e un errore non tocca la
prenotazione.

Impatto:
La risposta alla prenotazione aspetta fino a 3 invii (cliente, titolare, operatore): qualche
secondo in più con Resend, al massimo il timeout SMTP per email se il server non risponde. Un
invio fallito non si ripete.

Soluzione futura:
Mettere le email transazionali in una coda con invio in background e riprova, come le email di
sospensione (DEC-039), oppure usare l'API HTTP di Resend con un'unica chiamata batch.

Priorità:
Bassa
```

## Revisione

Il log si rivede a ogni release e nella manutenzione mensile. Un debito con priorità `Alta` non può restare aperto alla release senza una decisione esplicita di Massimo registrata nel Decision Log.
