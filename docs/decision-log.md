# Decision Log — Bookly

Una voce per ogni decisione architetturale significativa. Le voci non si cancellano: se una decisione cambia, quella vecchia diventa `Superseded` e se ne aggiunge una nuova.

Stato: **Approved** = scelta da Massimo · **Proposed** = proposta tecnica di Claude in attesa di approvazione.

---

```text
Decision:
DEC-001 — Prodotto: booking app multi-tenant per attività locali

Date:
2026-11-18

Context:
Massimo vuole un progetto costruito end-to-end, utile per il portfolio e vendibile alle
attività individuate dal Lead Engine.

Decision:
Web app di prenotazioni con pagina pubblica per attività, area cliente, dashboard admin e super-admin.

Alternatives:
Dashboard Lead Engine (uso interno); template sito vetrina (piccolo, solo frontend); portfolio v2.

Motivation:
Copre tutto lo stack full-stack (auth, multi-tenancy, concorrenza, email, CI/CD) e ha valore commerciale.

Status:
Approved
```

```text
Decision:
DEC-002 — Monorepo (apps/web + apps/api)

Date:
2026-11-18

Context:
Un solo sviluppatore, frontend e backend rilasciati insieme in un unico container.

Decision:
Un repository GitHub con apps/web e apps/api, CI unica, tipi TS generati dall'OpenAPI.

Alternatives:
Due repository (deploy indipendenti, ma più overhead e contratto più facile da far divergere).

Motivation:
Modifiche full-stack atomiche in una sola PR; il contratto API resta verificato in CI.

Status:
Approved
```

```text
Decision:
DEC-003 — Backend .NET 10 LTS + ASP.NET Core Controllers + EF Core 10

Date:
2026-11-18

Context:
Massimo lavora con C# ed EF Core; .NET 10 è LTS (supporto fino a novembre 2028).

Decision:
ASP.NET Core 10 con Controllers e struttura semplice (Controllers/Services/Entities/DTOs/Data).
Niente Clean Architecture, CQRS, MediatR né Repository.

Alternatives:
Minimal APIs (meno codice, ma Massimo è abituato ai Controllers); Supabase (meno valore full-stack).

Motivation:
Familiarità, LTS, OpenAPI 3.1 nativo; complessità proporzionata.

Status:
Approved
```

```text
Decision:
DEC-004 — Database PostgreSQL

Date:
2026-11-18

Context:
Serve un DB relazionale con piano gratuito permanente e un vincolo anti-overlap sugli intervalli.

Decision:
PostgreSQL 17 (Neon in produzione, Docker in locale).

Alternatives:
SQL Server (coerente col lavoro, ma tier cloud gratuiti limitati e niente exclusion constraint nativo).

Motivation:
Hosting gratuito disponibile; exclusion constraint con btree_gist per bloccare le doppie prenotazioni.

Status:
Approved
```

```text
Decision:
DEC-005 — Autenticazione con cookie HttpOnly (ASP.NET Core Identity)

Date:
2026-11-18

Context:
SPA e API sullo stesso origin. La preferenza permanente di Massimo è JWT; gli sono state presentate le alternative.

Decision:
Identity con cookie HttpOnly/Secure/SameSite=Lax, antiforgery (XSRF-TOKEN + X-XSRF-TOKEN),
validazione del security stamp per la revoca, Data Protection keys persistite su Postgres.

Alternatives:
JWT + refresh token (più codice; token esposto se salvato in JS); cookie + passkey (rimandato a nice-to-have).

Motivation:
Token non leggibile da JS (meno rischio XSS), revoca immediata, nessun refresh da gestire.

Status:
Approved
```

```text
Decision:
DEC-006 — Multi-tenancy con database condiviso e TenantId

Date:
2026-11-18

Context:
Un deploy deve servire più attività.

Decision:
Schema condiviso con colonna TenantId, global query filter EF Core, tenant risolto dallo slug
(rotte pubbliche) o dalla membership dell'utente (rotte admin), mai da input libero del client.

Alternatives:
Single-tenant (un deploy per cliente); schema per tenant o DB per tenant (overkill per l'MVP).

Motivation:
Un solo deploy, costo zero, isolamento verificabile con test.

Status:
Approved
```

```text
Decision:
DEC-007 — Account cliente obbligatorio

Date:
2026-11-18

Context:
Scelta tra prenotazione come ospite e account.

Decision:
Il cliente deve registrarsi e confermare l'email prima di prenotare.

Alternatives:
Ospite + email (meno attrito, meno dati); entrambi (più complesso).

Motivation:
Storico prenotazioni, meno prenotazioni false, gestione delle disdette dall'area personale.
Costo accettato: più flussi auth e più obblighi GDPR (export e cancellazione).

Status:
Approved
```

```text
Decision:
DEC-008 — Frontend: React + Vite 8 + TS + React Router v8 + TanStack Query + Tailwind v4

Date:
2026-11-18

Context:
Stack di default di Massimo; progetto medio-grande con dashboard.

Decision:
Vite 8 (Rolldown), React Router v8 data mode (createBrowserRouter, import da "react-router"),
TanStack Query + Axios, RHF + Zod, Tailwind v4, react-i18next (solo IT), react-hot-toast, lucide-react.
Nessuno store globale finché non serve.

Alternatives:
CSS puro / CSS Modules (default di Massimo per i progetti piccoli).

Motivation:
Molti componenti e viste admin: Tailwind riduce il CSS da mantenere e mantiene il responsive coerente.

Status:
Approved
```

```text
Decision:
DEC-009 — Doppie prenotazioni impedite dal database (exclusion constraint)

Date:
2026-11-18

Context:
Due clienti possono confermare lo stesso slot nello stesso istante; un controllo
"leggi poi scrivi" nel service non basta in concorrenza.

Decision:
EXCLUDE USING gist (staff_member_id WITH =, tstzrange(start_utc, blocked_until_utc) WITH &&)
WHERE status = 'Confirmed'. L'errore 23P01 diventa HTTP 409 booking.slot_unavailable.

Alternatives:
Lock applicativo o SERIALIZABLE (più fragile e più lento); controllo solo nel service (race condition).

Motivation:
Garanzia atomica gestita da Postgres; poco codice; testabile con Testcontainers.

Status:
Approved
```

```text
Decision:
DEC-010 — Single container: ASP.NET serve anche la SPA

Date:
2026-11-18

Context:
Con l'auth a cookie, SPA e API sullo stesso origin evitano CORS e i problemi dei cookie cross-site.

Decision:
Dockerfile multi-stage; la build Vite finisce in wwwroot; fallback a index.html per le route client.
Deploy su Render free + Neon free + Resend free.

Alternatives:
Cloudflare Pages + API separata con dominio custom (più scalabile, ma serve un dominio e la config CORS).

Motivation:
Costo 0 €, setup minimo, sicurezza dei cookie più semplice.

Status:
Approved
```

```text
Decision:
DEC-011 — Email transazionali con Resend (Mailpit in locale)

Date:
2026-11-18

Context:
Servono email di conferma, reset, prenotazione e promemoria. Web3Forms non è adatto (è per form di contatto).

Decision:
Resend in produzione dietro un'interfaccia IEmailSender; Mailpit via SMTP in development; fake nei test.

Alternatives:
Brevo; solo SMTP.

Motivation:
Free tier sufficiente per l'MVP (3.000 al mese, 100 al giorno), SDK .NET, provider sostituibile grazie all'interfaccia.

Status:
Approved
```

```text
Decision:
DEC-012 — Promemoria tramite cron GitHub Actions + endpoint protetto

Date:
2026-11-18

Context:
Su Render free l'istanza va in pausa: un BackgroundService non gira mentre dorme.

Decision:
Workflow schedulato ogni 15 minuti che chiama POST /api/jobs/send-reminders con il segreto
X-Job-Secret; invio idempotente tramite ReminderSentAt.

Alternatives:
BackgroundService/Hangfire (richiede un'istanza sempre attiva, quindi a pagamento); pg_cron (non chiama HTTP).

Motivation:
Gratuito; funziona anche con l'istanza in pausa (la sveglia); tiene parzialmente calda l'app.

Status:
Approved
```

```text
Decision:
DEC-013 — Tipi TypeScript generati dall'OpenAPI

Date:
2026-11-18

Context:
Rischio di divergenza tra DTO C# e tipi frontend.

Decision:
openapi-typescript genera src/types/api.gen.ts dal documento OpenAPI dell'API; la CI fallisce
se il file generato non è aggiornato. Le chiamate restano con Axios.

Alternatives:
Tipi scritti a mano (divergono); client generato completo come Orval o NSwag (più dipendenze, sostituisce Axios).

Motivation:
Unica fonte di verità per il contratto, costo minimo, Axios resta il client.

Status:
Approved
```

```text
Decision:
DEC-014 — Test di integrazione con Testcontainers (Postgres reale)

Date:
2026-11-18

Context:
Exclusion constraint, global filter e migrazioni non si testano con il provider InMemory né con SQLite.

Decision:
WebApplicationFactory + Testcontainers.PostgreSql in xUnit, in locale e in CI.

Alternatives:
EF InMemory (non applica i vincoli); DB condiviso di test (fragile).

Motivation:
I test girano sullo stesso motore della produzione; i vincoli di sicurezza critici vengono verificati davvero.

Status:
Approved
```

```text
Decision:
DEC-015 — Lingua UI italiana con i18n predisposta

Date:
2026-11-18

Context:
Clienti italiani; inglese possibile in futuro.

Decision:
react-i18next con solo "it"; codici d'errore stabili dal backend tradotti dal client; template email localizzabili.

Alternatives:
IT + EN subito; testi hardcoded.

Motivation:
Costo iniziale basso, traduzione futura senza refactoring.

Status:
Approved
```

```text
Decision:
DEC-016 — Direzione visuale C "Brand del tenant"

Date:
2026-11-18

Context:
Tre direzioni proposte: A Bottega (calda/serif), B Clinica pulita (minimale), C Brand del tenant.

Decision:
Base neutra (stile B) e design token CSS caricati per tenant: colore primario e logo.
Il colore primario scelto viene validato automaticamente (contrasto WCAG AA del testo su primario,
con fallback a un colore accessibile). La personalizzazione del brand passa da nice-to-have a MVP.

Alternatives:
A (caratterizzata ma meno universale); B (più veloce, ma tutte le attività appaiono uguali).

Motivation:
Coerente con il multi-tenant: ogni attività riconosce la propria pagina, quindi il prodotto è più vendibile.

Status:
Approved
```

```text
Decision:
DEC-017 — Formato dei commit

Date:
2026-11-18

Context:
Il formato dei commit era da definire nel profilo.

Decision:
`tipo: descrizione in italiano` con tipi feat | fix | docs | refactor | test | chore.

Alternatives:
Solo descrizione in italiano.

Motivation:
Storico leggibile e filtrabile, compatibile con changelog automatici.

Status:
Approved
```

```text
Decision:
DEC-018 — Stili centralizzati in design token (colori, font, raggi) facilmente sostituibili

Date:
2026-11-18

Context:
Massimo vuole poter cambiare idea su colori e font senza toccare i componenti.

Decision:
Un unico file `apps/web/src/styles/tokens.css` definisce tutte le variabili CSS (--bk-*):
colori del brand Bookly, colori semantici (success, warning, danger), famiglie di font, raggi.
Tailwind v4 le espone come utility tramite `@theme inline` (es. `bg-primary`, `font-heading`),
quindi i componenti usano solo nomi semantici e mai valori esadecimali o font diretti.
I font sono self-hosted (@fontsource) e importati in un solo file (`src/styles/fonts.css`).
Il brand del tenant sovrascrive a runtime solo le variabili --bk-tenant-* sul layout pubblico.
Regola ESLint/review: niente colori arbitrari (`bg-[#...]`) nei componenti.

Alternatives:
Valori diretti nelle classi Tailwind (veloce ma cambiare colore richiede modifiche ovunque);
tema JS (CSS-in-JS: runtime più pesante, non necessario).

Motivation:
Cambiare palette o font = modificare una riga in un file; compatibile con il brand per tenant (DEC-016).

Status:
Approved
```

```text
Decision:
DEC-019 — Sidebar admin costruita lato server da tabelle dedicate

Date:
2026-11-18

Context:
Massimo vuole che la navigazione dell'area admin e piattaforma arrivi dal server, da un archivio dedicato.

Decision:
Schema Postgres dedicato `ui` nello stesso database: tabelle `ui.navigation_items`
(key, label_key i18n, icon, route, area admin|platform, sort_order, parent_id, is_enabled)
e `ui.navigation_item_roles` (item, ruolo: Owner | Staff | SuperAdmin).
Dati iniziali da seed/migrazione; il SuperAdmin può abilitare, disabilitare e riordinare le voci.
`GET /api/navigation?area=admin` restituisce solo le voci abilitate per il ruolo dell'utente
nel tenant corrente. Il frontend le disegna: icone da una allowlist (registry lucide-react),
route che devono esistere nel router client (voci sconosciute ignorate, test di coerenza).
Il filtro della sidebar è solo UX: ogni endpoint resta autorizzato sul backend.

Alternatives:
Database separato (secondo progetto Neon, secondo DbContext: più isolato ma più complesso);
menu definito nel codice frontend (più semplice ma non configurabile dal server);
override del menu per tenant (rimandato: non serve all'MVP).

Motivation:
Menu configurabile senza deploy, unica sorgente dei permessi di visualizzazione, costo zero.

Status:
Approved
```

```text
Decision:
DEC-020 — TypeScript 6.0 + ESLint (invece di TypeScript 7 + oxlint del template Vite)

Date:
2026-11-18

Context:
A novembre 2026 il template ufficiale `create-vite` usa TypeScript 7 (compilatore nativo in Go)
e oxlint al posto di ESLint. La preferenza permanente di Massimo è ESLint + Prettier.
typescript-eslint 8.x supporta TypeScript fino a < 6.1.

Decision:
Mantengo ESLint + Prettier (preferenza di Massimo) e quindi fisso TypeScript ~6.0.
La regola custom contro i colori hardcoded (DEC-018) è scritta in ESLint.

Alternatives:
TypeScript 7 + oxlint: type-check e lint molto più veloci, ma niente regole type-aware equivalenti
a typescript-eslint e niente regola custom DEC-018 senza plugin JS.

Motivation:
Preferenza di Massimo, ecosistema di regole più maturo. Il passaggio a TS 7 è tracciato in TD-004.

Status:
Approved (preferenza permanente) — alternativa da rivalutare
```

```text
Decision:
DEC-021 — Nessuna enumerazione degli account; niente login automatico dopo la registrazione

Date:
2026-11-18

Context:
Registrazione, login e recupero password non devono rivelare se un'email è già registrata
(OWASP A07). Un login automatico dopo la registrazione renderebbe distinguibili i due casi.

Decision:
- register, forgot-password e resend-confirmation rispondono sempre 202.
  Se l'email esiste già, il titolare riceve un'email "hai già un account" con il link di reset.
- login risponde lo stesso 401 `auth.invalid_credentials` per email sconosciuta, password errata
  e account bloccato (lockout dopo 5 tentativi per 15 minuti).
- Dopo la registrazione l'utente conferma l'email e poi accede; il wizard conserva la selezione.
- Il link di reset conferma anche l'email (dimostra il possesso della casella).

Alternatives:
Errore "email già in uso" + login automatico (UX più rapida, ma permette l'enumerazione).

Motivation:
Privacy dei clienti delle attività e resistenza ad attacchi di credential stuffing.

Status:
Approved (scelta tecnica di Claude nello Step 3, reversibile)
```

```text
Decision:
DEC-022 — Email via SMTP con MailKit (Mailpit in sviluppo, Resend SMTP in produzione)

Date:
2026-11-18

Context:
DEC-011 sceglie Resend. Resend offre anche un endpoint SMTP standard.

Decision:
Un unico IEmailSender SMTP (MailKit). Sviluppo: Mailpit (localhost:1025). Produzione:
smtp.resend.com:465, utente "resend", password = API key. Timeout di 15 s; un errore di invio
viene registrato nei log ma non interrompe il flusso (l'utente può chiedere un nuovo invio).

Alternatives:
SDK HTTP di Resend (dipendenza in più, codice diverso fra sviluppo e produzione).

Motivation:
Stesso codice in tutti gli ambienti, provider sostituibile cambiando solo la configurazione.

Status:
Approved (specifica DEC-011)
```

```text
Decision:
DEC-023 — Tenant attivo dell'area admin: header X-Bookly-Tenant validato + store Zustand

Date:
2026-11-18

Context:
Un utente può essere Owner/Staff di più attività. Le rotte admin devono sapere su quale tenant
lavorare senza mai fidarsi di un valore del client (DEC-006).

Decision:
- Il client invia l'id del tenant attivo nell'header `X-Bookly-Tenant`.
- Il server (TenantMembershipResolver) lo accetta solo se l'utente ha una membership attiva su
  quel tenant; senza header serve una sola membership. Il tenant risolto alimenta il filtro EF.
- Policy `TenantMember`, `TenantOwner`, `PlatformAdmin` applicate sugli endpoint.
- Frontend: il tenant attivo vive in uno store Zustand persistito (unico stato globale: lo
  usano client HTTP, sidebar e selettore di attività).

Alternatives:
Slug del tenant nell'URL admin (/admin/{slug}/...): URL più lunghi e route del menu non statiche;
cookie di sessione con il tenant (stato lato server in più).

Motivation:
Semplice, verificato a ogni richiesta, compatibile con il menu dal server (DEC-019).

Status:
Approved (scelta tecnica di Claude nello Step 4, reversibile)
```

```text
Decision:
DEC-024 — Calendario del wizard: react-day-picker con i design token (invece della CLI shadcn/ui)

Date:
2026-11-18

Context:
Proposto shadcn/ui per il date picker (accessibilità e tastiera complesse). Il Calendar di shadcn è
un wrapper di react-day-picker che usa le proprie variabili di tema (--primary, --accent,
--muted-foreground…), che non esistono nel nostro sistema: la palette Tailwind è ridotta ai soli
token semantici (DEC-018).

Decision:
Usare direttamente react-day-picker (v10, la stessa libreria del Calendar shadcn): locale it,
settimana da lunedì, giorni non disponibili disabilitati, stile solo con classi dei nostri token
(componente DatePicker). Nessuna CLI shadcn, nessun secondo set di variabili.

Alternatives:
shadcn/ui Calendar (richiede di mappare il suo tema sui nostri token e porta clsx/tailwind-merge);
calendario custom (navigazione da tastiera e ARIA da riscrivere).

Motivation:
Stessa accessibilità del componente shadcn, un solo sistema di token, una dipendenza in meno.

Status:
Approved (Massimo ha dato il via a shadcn per il calendario; questa è l'implementazione
equivalente senza la CLI, reversibile)
```

```text
Decision:
DEC-025 — Assenze inserite in ora locale del tenant, convertite in UTC dal server

Date:
2026-11-18

Context:
Le assenze dello staff (ferie, permessi) si inseriscono nell'area admin. Convertire nel browser
un'ora locale del tenant in UTC richiede di calcolare l'offset per quella data (ora legale) e il
browser può essere in un altro fuso (booking-domain, regole 3 e 6).

Decision:
L'API riceve data e ora locali (startDate, startTime?, endDate, endTime?): senza orari l'assenza
copre giornate intere [inizio 00:00, giorno dopo la fine 00:00). Il server converte per data con
lo stesso helper della disponibilità (AvailabilityCalculator.ToUtc) e restituisce gli istanti con
l'offset del tenant.

Alternatives:
DateTimeOffset calcolato dal frontend (logica DST duplicata nel browser, rischio di errori con
fusi diversi dal tenant).

Motivation:
Una sola implementazione della conversione, testata anche sul cambio d'ora di marzo.

Status:
Approved (dettaglio implementativo dello Step 8)
```

```text
Decision:
DEC-026 — Logo del tenant: cache con rivalidazione (no-cache + ETag)

Date:
2026-11-18

Context:
Il logo pubblico era servito con max-age=3600: dopo un nuovo caricamento la pagina pubblica
avrebbe mostrato il logo vecchio fino a un'ora.

Decision:
Cache-Control "public, no-cache" con ETag: il browser rivalida a ogni visita e riceve 304 se il
logo non è cambiato. L'area admin aggiunge anche un parametro di versione dopo l'upload.

Alternatives:
URL versionato (?v=) anche sulla pagina pubblica (richiede di esporre la data del logo nell'API).

Motivation:
Logo aggiornato subito, costo trascurabile (richiesta condizionale di pochi byte).

Status:
Approved (dettaglio implementativo dello Step 8)
```

```text
Decision:
DEC-027 — Calendario admin: regole delle azioni dell'attività e avvisi di disdetta

Date:
2026-11-18

Context:
Step 9: il titolare (e lo staff sui propri appuntamenti) sposta, annulla e chiude gli appuntamenti.
La skill booking-domain chiede che ogni spostamento ripassi dalla validazione di disponibilità e
lascia al tenant la scelta su come essere avvisato delle disdette dei clienti.

Decision:
- Sposta: stesso id, stessa durata e buffer; nuova data/ora locale convertita dal server; deve
  stare negli orari di lavoro dell'operatore, fuori dalle assenze, nel futuro; la sovrapposizione
  la blocca il vincolo del database (409). Preavviso minimo e orizzonte NON si applicano
  all'attività. Il promemoria viene azzerato. Email al cliente.
- Annulla: sempre possibile su un appuntamento confermato, con motivo facoltativo (mostrato al
  cliente nell'email).
- Completato / Non presentato: solo dopo l'inizio. Gli stati finali non tornano a Confermato.
- Staff: vede e gestisce solo i propri appuntamenti; non può spostarli su un collega (403).
- Disdetta del cliente: email al titolare e all'operatore con accesso, disattivabile nelle
  impostazioni (Tenant.NotifyOnCustomerCancellation, default attivo).

Alternatives:
Permettere al titolare di forzare orari fuori turno (rimandato: si può aggiungere una fascia).

Motivation:
Stesse garanzie della prenotazione online, nessun appuntamento fuori orario per errore.

Status:
Approved (dettaglio implementativo dello Step 9)
```

```text
Decision:
DEC-028 — Piattaforma: creazione attività, inviti ai titolari e primo super-admin

Date:
2026-11-18

Context:
Step 10: il super-admin crea le attività e ne invita i titolari; serve anche un modo sicuro per
avere il primo super-admin in produzione senza accesso a una shell (Render free).

Decision:
- Nuova attività = tenant + invito del titolare. Email nuova: account senza password e link
  /invito valido 7 giorni (token Identity dedicato "Invitation", legato al security stamp: smette
  di valere appena la password è impostata). Il link conferma l'email; all'attivazione si accetta
  l'informativa e si entra direttamente nell'area dell'attività. Email già registrata: diventa
  titolare e riceve un avviso. Reinvitare un titolare in attesa re-invia il link.
- Slug: 3–40 caratteri a-z 0-9 e trattini, parole riservate escluse, unico (409).
- Sospensione: pagina pubblica 404, prenotazioni bloccate, area admin non accessibile; dati
  conservati; riattivabile.
- Il super-admin vede solo dati aggregati (operatori, servizi), mai appuntamenti o clienti.
- Primo super-admin: Platform__SuperAdminEmails in configurazione. All'avvio il ruolo viene dato
  solo ad account esistenti con email confermata (registrarsi con quell'indirizzo non basta);
  il ruolo non viene mai tolto automaticamente.

Alternatives:
Comando CLI one-off (non disponibile senza shell sul piano gratuito); seed con password in
configurazione (segreto in più da gestire).

Motivation:
Nessuna password condivisa: ogni titolare sceglie la propria, e il possesso della casella email
è sempre verificato.

Status:
Approved (dettaglio implementativo dello Step 10)
```

```text
Decision:
DEC-029 — Promemoria: regole d'invio e idempotenza

Date:
2026-11-18

Context:
Step 11: promemoria email ~24 h prima (booking-domain), eseguito da un cron di GitHub Actions
ogni 15 minuti (DEC-012, TD-002), con run che possono ritardare, ripetersi o sovrapporsi.

Decision:
- Si invia per appuntamenti Confermati che iniziano entro le prossime 24 ore, di attività attive,
  prenotati almeno 12 ore prima (altrimenti la conferma appena ricevuta basta).
- Ogni appuntamento viene "prenotato" con un UPDATE condizionale su ReminderSentAt prima di
  inviare l'email: due run sovrapposti non mandano mai due email. Se l'invio fallisce il campo
  torna NULL e il run successivo riprova. Uno spostamento azzera ReminderSentAt (Step 9).
- POST /api/jobs/send-reminders con segreto X-Job-Secret (≥ 32 caratteri, confronto a tempo
  costante), senza antiforgery; senza segreto configurato l'endpoint risponde 404.
- L'email indica fino a quando si può disdire online, oppure il telefono dell'attività se la
  finestra di disdetta è già chiusa.

Alternatives:
BackgroundService con PeriodicTimer (non gira mentre l'istanza Render free è in pausa: TD-002).

Motivation:
Nessun doppio invio anche con run concorrenti, nessun promemoria perso per un errore SMTP.

Status:
Approved (dettaglio implementativo dello Step 11)
```

```text
Decision:
DEC-030 — GDPR: diritti dell'interessato, cancellazione con anonimizzazione e conservazione

Date:
2026-11-18

Context:
Step 12. La skill booking-domain chiede export, rettifica e cancellazione, con lo storico passato
anonimizzato (serve alle attività) e un periodo di conservazione (proposta 24 mesi).

Decision:
- Accesso/portabilità: GET /api/me/export scarica un JSON con profilo, ruoli e appuntamenti presso
  tutte le attività. Rettifica: PUT /api/me/profile (nome, cognome, telefono; l'email no, TD-006).
- Cancellazione: POST /api/me/delete con la password (ri-autenticazione). Appuntamenti futuri
  disdetti, note e motivi cancellati, legami staff e ruoli rimossi; la riga utente resta ma
  anonimizzata ("Cliente eliminato", email segnaposto @deleted.invalid, niente telefono né
  password, bloccata, security stamp rinnovato → tutte le sessioni e i link scadono). Lo storico
  resta all'attività senza contatti. Email di conferma all'indirizzo originale. I titolari di
  un'attività devono prima trasferirla (409).
- Conservazione: job giornaliero POST /api/jobs/apply-retention (cron retention.yml): note e
  motivi degli appuntamenti cancellati 24 mesi dopo l'appuntamento; account mai confermati,
  inutilizzati, cancellati dopo 30 giorni.
- Testi legali: informativa privacy e cookie, termini di servizio, come bozze (TD-005).
  Solo strumenti tecnici → nessun banner cookie.

Alternatives:
Cancellare la riga utente e gli appuntamenti (l'attività perderebbe lo storico); chiave esterna
nullable sugli appuntamenti (più modifiche al codice, nessun vantaggio per la privacy rispetto
all'anonimizzazione della riga).

Motivation:
Diritti esercitabili in autonomia, storico utile alle attività senza dati personali.

Status:
Approved (dettaglio implementativo dello Step 12)
```

```text
Decision:
DEC-031 — Hardening: header di sicurezza e CSP, meta tag delle pagine attività, Sentry, E2E

Date:
2026-11-18

Context:
Step 13 (overview §OWASP A02, §20, R7/Q4). Massimo ha confermato i meta tag server-side nell'MVP.

Decision:
- Header su ogni risposta: CSP (default-src 'self'; script-src 'self' senza unsafe-inline né
  eval; style-src con 'unsafe-inline' per le variabili CSS del tema nei style attribute e lo
  style element dei toast; img data:/blob:; frame-ancestors 'none'; object-src 'none';
  upgrade-insecure-requests fuori da Development), nosniff, X-Frame-Options DENY,
  Referrer-Policy, Permissions-Policy, COOP e CORP same-origin; HSTS 1 anno.
  Origini extra per connect-src solo da configurazione (Security:ExtraConnectSources, https).
- Compatibilità con la CSP: font mai inline come data: (assetsInlineLimit), Zod in modalità
  jitless (niente new Function), source map "hidden" e rimosse dall'immagine Docker.
- /b/{slug}: il server inserisce title, description, canonical e Open Graph (og:image = logo)
  nell'index.html; attività sconosciute o sospese → 404 con noindex. robots.txt esclude le aree
  private.
- Sentry facoltativo (Sentry__Dsn, VITE_SENTRY_DSN): nessun utente, cookie, header né query
  string (i token dei link email), niente tracing; l'SDK web è un chunk caricato solo con DSN.
- I log non contengono più oggetto e destinatario delle email (dati personali): solo il tipo.
- Rate limit anche su eliminazione account (verifica password) ed export.
- E2E Playwright in CI contro lo stack reale (build di produzione servita dall'API): prenotazione
  completa, calendario, header e meta, axe WCAG 2.1 AA, zero errori in console e violazioni CSP,
  su mobile e desktop.

Alternatives:
CSP con nonce (inutile: nessuno script inline); prerender delle pagine attività (più complesso
dell'iniezione dei meta); Sentry tunnel via API (rimandato: basta connect-src).

Motivation:
Difesa in profondità contro XSS e clickjacking verificata da test automatici, anteprime dei link
condivisi, errori di produzione visibili senza esporre dati personali.

Status:
Approved (Q4 confermata da Massimo il 2026-11-18)
```

---

```text
Decision:
DEC-032 — Pipeline di rilascio: CI verde → migrazioni → deploy hook Render → verifica

Date:
2026-11-19

Context:
Fase 4. Render free non offre il pre-deploy command, Neon free mette il compute in pausa dopo
5 minuti, e le migrazioni non devono girare all'avvio dell'app (overview §23).

Decision:
- render.yaml (Blueprint): un web service Docker free a Frankfurt, autoDeployTrigger off,
  health check di liveness (/api/health), variabili fisse nel file e segreti chiesti alla
  creazione (sync: false), Jobs__Secret generato da Render.
- deploy.yml parte con workflow_run dopo CI verde su push a main (solo da questo repo, il filtro
  di branch da solo accetterebbe PR da fork chiamate "main") o a mano su main:
  1. migration bundle EF Core applicato a Neon con il ruolo owner (endpoint diretto);
  2. deploy hook di Render con ?ref=<commit>;
  3. polling di GET /api/version finché riporta il commit (RENDER_GIT_COMMIT);
  4. smoke test: readiness, /api/auth/me = 204 (rileva il caso F4), CSP, HSTS, HTML.
  Con solo il secret del database esegue le migrazioni e basta (primo setup: lo schema esiste
  prima del primo avvio su Render).
- Segreti nell'environment GitHub "production"; BOOKLY_BASE_URL resta variabile di repo.
- A runtime l'app usa il ruolo bookly_app con solo SELECT/INSERT/UPDATE/DELETE (default
  privileges su schemi, tabelle e sequenze create dall'owner). Verificato: 28 E2E Chromium verdi
  con quel ruolo, nessun 42501; CREATE TABLE negato.
- Connessione diretta (non il pooler PgBouncer) con Maximum Pool Size=20 e Connection Idle
  Lifetime=60, per lasciare andare Neon in pausa; la retry di EF Core copre le connessioni chiuse.
- Rollback: Rollback di Render (riusa l'immagine) + restore di Neon entro 6 ore; branch Neon di
  backup prima delle migrazioni distruttive; regola expand → contract.

Alternatives:
Auto-deploy di Render a ogni push (le migrazioni andrebbero all'avvio o dopo il deploy);
migrazioni all'avvio (più istanze o crash a metà lasciano lo schema incoerente, e l'app
avrebbe bisogno dei permessi DDL); pre-deploy command di Render (solo piani a pagamento);
immagine costruita su GitHub e pubblicata su GHCR (doppio registry senza vantaggi sul free);
pooler di Neon (inutile con un'istanza sola, e le migrazioni non possono usarlo).

Motivation:
Il codice nuovo va live solo dopo test verdi e schema aggiornato, il workflow conferma che sia
proprio quel commit a rispondere, e un'eventuale SQL injection non può alterare lo schema.

Status:
Approved (PR #24 unita da Massimo, 19/11/2026)
```

---

```text
Decision:
DEC-033 — SMTP Resend sulla porta 2465 in produzione

Date:
2026-11-19

Context:
Dal 26/09/2025 i web service free di Render bloccano il traffico in uscita verso le porte SMTP
25, 465 e 587: le prime email di produzione non partivano.

Decision:
Email__Port=2465 con TLS implicito (SslOnConnect), porta alternativa offerta da Resend.
Nessuna modifica al codice (MailKit, DEC-022).

Alternatives:
API HTTP di Resend sulla 443 (nuovo client da scrivere e testare); piano Render a pagamento
(costo fisso mensile solo per sbloccare la porta).

Motivation:
Risolve con una sola variabile, mantiene l'invio via SMTP indipendente dal provider.

Status:
Approved (PR #26 unita da Massimo, 19/11/2026)
```

---

```text
Decision:
DEC-034 — cron-job.org come pianificatore di promemoria e retention

Date:
2026-11-19

Context:
In produzione il cron di GitHub Actions ogni 15 minuti è partito 2 volte in 18 ore (TD-002):
promemoria in ritardo o persi, e l'istanza Render free non resta sveglia.

Decision:
cron-job.org (gratuito) chiama POST /api/jobs/send-reminders ogni 15 minuti e
/api/jobs/apply-retention ogni giorno, con l'header X-Job-Secret e le notifiche dei fallimenti
attive. I workflow GitHub restano come riserva e per l'avvio manuale: gli endpoint sono
idempotenti (claim con UPDATE condizionale), quindi due pianificatori non producono doppioni.
Nessuna modifica al codice.

Alternatives:
Solo GitHub Actions (irregolare); BackgroundService nell'app (non gira mentre Render free è in
pausa, DEC-012); piano Render a pagamento con BackgroundService (costo fisso).

Motivation:
Puntualità dei promemoria e istanza sveglia a costo zero. Rischio accettato: il segreto dei job
è custodito da un terzo; può solo avviare job idempotenti, l'account ha la verifica in due
passaggi e il segreto si ruota come gli altri (docs/deploy.md §9).

Status:
Approved (Massimo, 19/11/2026)
```

---

```text
Decision:
DEC-035 — Promemoria solo in orario diurno, retention al mattino

Date:
2026-11-19

Context:
Con DEC-034 cron-job.org chiamava i promemoria ogni 15 minuti anche di notte. Ogni chiamata
sveglia Neon per 5 minuti (CU-ore gratuite) e tiene accesa l'istanza Render, ma gli appuntamenti,
e quindi i loro promemoria a 24 ore, cadono in orario di negozio. La retention alle 03:43 trovava
l'app in pausa e rischiava il timeout di 30 secondi di cron-job.org.

Decision:
- Promemoria: minuti 0, 15, 30, 45 dalle 7 alle 21 (Europe/Rome), ultima chiamata 21:45.
  Precisione invariata di giorno (tra 24 h e 23 h 45 min prima); un appuntamento dopo le 21:45
  riceve il promemoria alle 7:00 del giorno prima.
- Retention: ogni giorno alle 07:20, quando i promemoria hanno già svegliato l'app.
- Workflow GitHub di riserva allineati (05-20 UTC; retention 06:20 UTC).

Alternatives:
Ogni 15 minuti h24 (spreco di notte); ogni ora (promemoria meno precisi e Render in pausa di giorno,
quindi attese per i clienti).

Motivation:
Circa il 35% di CU-ore Neon e metà delle ore Render in meno, senza perdere puntualità di giorno.
Costo accettato: di notte il primo visitatore aspetta il risveglio dell'app (TD-001).

Status:
Approved (Massimo, 19/11/2026)
```

---

```text
Decision:
DEC-036 — Backup notturno del database con test di ripristino

Date:
2026-11-20

Context:
Neon free ripristina solo le ultime 6 ore: un errore scoperto il giorno dopo (cancellazione,
migrazione sbagliata, bug che corrompe dati) non sarebbe recuperabile.

Decision:
Workflow GitHub Actions `Backup`, ogni notte e a mano:
- pg_dump 17 (formato custom) con la connessione owner già salvata per le migrazioni
  (DATABASE_MIGRATION_CONNECTION, convertita da Npgsql a variabili libpq da uno script testato);
- ripristino di prova in un PostgreSQL 17 usa e getta: senza storico delle migrazioni il run fallisce;
  il riepilogo mostra i conteggi di attività, appuntamenti e utenti;
- cifratura AES-256 (gpg simmetrico) con BACKUP_PASSPHRASE, perché gli artifact di un repo
  pubblico sono scaricabili da qualsiasi utente GitHub;
- artifact conservato 30 giorni. Ripristino documentato in docs/deploy.md §9.

Alternatives:
Solo il restore di Neon (6 ore); piano Neon a pagamento (fino a 7-30 giorni, costo fisso);
storage esterno S3/R2 (un altro account e altre credenziali); backup senza test di ripristino
(si scopre che non funziona quando serve).

Motivation:
30 giorni di storico a costo zero, con la prova ogni notte che il backup si ripristina davvero.
Limite accettato: il cron di GitHub può ritardare o saltare una notte (TD-002).

Status:
Approved (Massimo, 20/11/2026)
```

---

```text
DEC-037 — Appuntamenti inseriti dall'attività e rubrica clienti

Date:
2026-11-20

Context:
Le attività prendono molti appuntamenti per telefono o di persona, spesso da clienti senza
account Bookly. Finora ogni appuntamento richiedeva un account (CustomerId obbligatorio).

Decision:
- Nuova tabella TenantCustomers (per attività): nome, cognome, telefono (+ cifre normalizzate
  per ricerca e anti-doppioni), email facoltativa. L'attività è titolare di questi dati.
- Appointment: CustomerId facoltativo + TenantCustomerId, con vincolo nel database
  CK_Appointments_OneCustomer (esattamente uno dei due); Origin (Online/Business),
  CreatedByUserId e NotifyCustomer (email di conferma, promemoria e modifiche).
- POST /api/admin/appointments: titolare per tutti, staff solo per sé; niente preavviso né
  orizzonte; fuori orario o durante un'assenza serve allowOutsideHours (422
  admin.outside_working_hours, la UI chiede conferma); sovrapposizioni sempre bloccate dal
  vincolo (409); niente orari nel passato.
- Cliente: un account che ha già prenotato presso l'attività, una voce della rubrica o un nuovo
  cliente (stesso nome e telefono = stessa voce). Un account mai visto dall'attività non si
  può agganciare né trovare: la ricerca non rivela gli utenti della piattaforma.
- GET /api/admin/customers?q=: rubrica + account che hanno prenotato qui (min 2 caratteri).
- Email solo se c'è un indirizzo e l'attività lascia attiva la casella; senza account il link
  porta alla pagina dell'attività e per disdire si chiama l'attività.
- Retention: le voci della rubrica senza appuntamenti negli ultimi 24 mesi vengono anonimizzate.
- Migrazione compatibile con la versione precedente (default Online e NotifyCustomer = true).

Alternatives:
Dati del cliente scritti sull'appuntamento (niente rubrica: clienti abituali da riscrivere);
account "ombra" senza password (la piattaforma creerebbe account a persone che non l'hanno
chiesto, email obbligatoria); solo orari liberi come online (non copre il cliente dopo la chiusura).

Motivation:
Copre il caso più frequente delle attività locali senza obbligare il cliente a registrarsi,
mantiene la garanzia anti-sovrapposizione nel database e separa chiaramente i dati di cui è
titolare l'attività da quelli dell'account Bookly.

Status:
Approved (Massimo, 20/11/2026)
```

---

```text
DEC-038 — Pagina "Clienti" (rubrica e clienti con account)

Date:
2026-11-20

Context:
La rubrica dell'attività (DEC-037) si alimentava solo dal dialog "Nuovo appuntamento": nessun
modo di correggere una voce né di rispondere alle richieste GDPR di chi non ha un account (TD-008).

Decision:
- Pagina "Clienti" solo per i titolari: elenco unico con la rubrica e gli account che hanno già
  prenotato presso l'attività (in sola lettura: i loro dati li gestiscono loro dal profilo),
  ricerca e filtro, numero di appuntamenti, ultima visita e prossimo appuntamento.
- Scheda cliente a due schede: "Dati" e "Appuntamenti". Un cliente abituale può avere centinaia
  di appuntamenti, quindi la scheda riceve solo i conteggi (totali, prossimi, passati, completati,
  non presentati, annullati, ultima visita, prossimo) e gli appuntamenti arrivano a pagine di 10
  (prossimi dal più vicino, passati dal più recente) con "Mostra altri". Il dialog ha altezza fissa.
- Voci della rubrica: correzione (stesse regole del nuovo cliente), "Scarica dati" (JSON con
  anagrafica, appuntamenti e note: diritto di accesso) e "Cancella dati" (diritto all'oblio).
- La cancellazione anonimizza la voce, cancella le note dei suoi appuntamenti e annulla quelli
  futuri senza email (motivo interno "Dati del cliente cancellati"); lo storico passato resta
  come "Cliente anonimo".
- API: GET /api/admin/customers/list, GET .../address-book/{id} e .../account/{id},
  GET .../{address-book|account}/{id}/appointments?when=upcoming|past&page=&pageSize=10,
  PUT e DELETE .../address-book/{id}, GET .../address-book/{id}/export (tutti TenantOwner).
  Un account che non ha mai prenotato presso l'attività risponde 404.
- L'elenco unisce le due fonti in memoria e poi pagina: dimensioni da attività locale.
- Voce di menu "Clienti" (solo titolari) subito dopo "Calendario" (migrazione CustomersPage).
  Interfaccia: schede su telefono e tablet, tabella da 1024 px; dialog a due schede ad altezza fissa.

Alternatives:
Solo la rubrica (il titolare non vedrebbe in un posto solo tutti i suoi clienti); cancellazione
fisica (perderebbe lo storico e i conti dell'attività); bloccare la cancellazione finché esistono
appuntamenti futuri (un passaggio in più per il titolare).

Motivation:
Chiude lo step 1 e dà al titolare, che è il titolare del trattamento, gli strumenti per gestire
accesso, rettifica e cancellazione dei clienti senza account.

Status:
Approved (Massimo, 20/11/2026)
```


---

```text
Decision:
DEC-039 — Sospensione con annullamento degli appuntamenti futuri e avviso ai clienti

Date:
2026-11-23

Context:
La sospensione di un'attività (DEC-028) blocca pagina pubblica, prenotazioni e area dell'attività,
ma lascia confermati gli appuntamenti futuri: i clienti si presentano a un'attività chiusa senza
saperlo. Massimo ha scelto il miglioramento n. 11 e ha deciso le regole il 23/11/2026; il dialog
è stato prototipato in Claude Design («Bookly – Sospensione attività») e approvato.

Decision:
- Dialog di sospensione: il super-admin vede solo il numero di appuntamenti futuri confermati
  (GET /api/platform/tenants/{id}/future-appointments → { count }), mai chi né quando. Con
  appuntamenti sceglie tra «Sospendi e annulla N appuntamenti futuri» e «Sospendi soltanto»;
  nessuna scelta è preselezionata e confermare senza scegliere mostra un errore. Senza
  appuntamenti resta solo «Sospendi». Se il conteggio fallisce, «Riprova» e niente sospensione.
- PUT /api/platform/tenants/{id}/status con cancelFutureAppointments=true (solo con Suspended,
  altrimenti 400 platform.cancel_requires_suspension): in una transazione l'attività diventa
  Suspended, gli appuntamenti Confirmed con inizio futuro diventano CancelledByBusiness (senza
  motivo) e le email vanno in coda. Un appuntamento cambiato nel frattempo dà 409
  booking.concurrent_update e non cambia nulla.
- Email ai clienti: una per cliente, con l'elenco dei suoi appuntamenti annullati, solo per gli
  appuntamenti con NotifyCustomer e un'email. Template nuovo e neutro: niente «sospesa», niente
  motivo, niente link alla pagina pubblica (è 404), pulsante «Chiama» col telefono dell'attività se
  c'è. Nessuna email a chi ha solo appuntamenti passati.
- Email a ogni titolare: riepilogo (appuntamenti annullati, clienti avvisati) e tabella dei clienti
  da chiamare (nome, telefono, data e ora) per gli appuntamenti senza email o con avvisi disattivati.
- Coda: tabelle TenantSuspensions e SuspensionNotices. Le righe contengono solo id e contatori:
  nomi, indirizzi e date si leggono al momento dell'invio, così un dato cancellato nel frattempo
  non parte (la riga diventa Skipped). Ordine: riepiloghi ai titolari, poi clienti dal primo
  appuntamento più vicino.
- Invio in background, a blocchi e idempotente: ogni email si prenota con un UPDATE condizionale
  (come i promemoria, DEC-012) prima di partire. Un errore ferma il giro e la riprova dopo 5 min,
  30 min, 2 h, poi ogni 6 h; dopo 8 tentativi l'email risulta non inviata. Limite di 80 email di
  sospensione al giorno UTC (Resend free: 100 al giorno in tutto, TD-009): oltre, l'invio riprende
  il giorno dopo.
- Chi invia: un BackgroundService nell'app, svegliato subito dalla sospensione, all'avvio e ogni
  10 minuti mentre l'app è sveglia; più POST /api/jobs/send-suspension-notices (20 secondi al
  massimo per chiamata) dal workflow GitHub «Suspension notices» tre volte al giorno e,
  facoltativo, da cron-job.org (docs/deploy.md §6).
- Piattaforma: la scheda di un'attività sospesa mostra lo stato degli avvisi dell'ultima
  sospensione (in invio, in pausa per il limite giornaliero, in pausa dopo un errore, completati;
  solo conteggi) e si aggiorna ogni 5 secondi durante l'invio. La riattivazione non ripristina
  gli appuntamenti annullati.

Alternatives:
Annullare sempre (il super-admin può voler sospendere per poche ore senza toccare nulla); mostrare
l'elenco degli appuntamenti nel dialog (contro la minimizzazione: il super-admin non consulta gli
appuntamenti); inviare tutte le email nella richiesta (lenta e soggetta al limite di Resend); solo
il job pianificato (con Render free in pausa le email partirebbero tardi); un'email per
appuntamento (più email, più quota).

Motivation:
I clienti non trovano un'attività chiusa senza preavviso e il titolare sa chi chiamare. La coda con
soli id evita copie di dati personali; prenotazione condizionale, riprova e limite giornaliero
rendono l'invio sicuro con il piano gratuito di Resend.
Rischio accettato: una prenotazione online partita pochi millisecondi prima della sospensione può
essere salvata dopo il conteggio della transazione e restare confermata; è molto improbabile e il
titolare la vede nel calendario alla riattivazione.

Status:
Approved (Massimo, 23/11/2026)
```

---

```text
Decision:
DEC-040 — Email al titolare per ogni nuova prenotazione online

Date:
2026-11-23

Context:
Il titolare scopre le prenotazioni online solo aprendo il calendario. Massimo ha scelto il
miglioramento n. 2 e ha deciso le regole il 23/11/2026, chiedendo di riusare il meccanismo delle
disdette (DEC-027). Interruttore ed email sono stati prototipati in Claude Design
(«Bookly – Avviso nuova prenotazione») e approvati.

Decision:
- Quando: solo per le prenotazioni del cliente dalla pagina pubblica (BookingService.BookAsync).
  Gli appuntamenti inseriti dall'attività dal calendario (DEC-037) non mandano avvisi.
- Destinatari: come le disdette, i titolari e il login dell'operatore dell'appuntamento. Un'email
  per persona (il titolare che è anche l'operatore ne riceve una). Si scrive solo a chi è ancora
  membro dell'attività e non ha eliminato l'account: la regola, in un metodo condiviso, vale ora
  anche per le disdette.
- Interruttore: nuovo, Tenant.NotifyOnOnlineBooking, separato da NotifyOnCustomerCancellation e
  attivo di default, anche per le attività esistenti (la migrazione mette true). Nelle
  Impostazioni i due interruttori stanno nel nuovo pannello «Avvisi via email».
- Email OnlineBookingNotice: oggetto «Nuova prenotazione: <cliente>, <data e ora>»; tabella con
  servizio, data e ora, operatore, telefono (se c'è, link tel:), email (link mailto:) e nota (se
  c'è). Pulsante «Apri il calendario» su /admin?data=AAAA-MM-GG, il giorno dell'appuntamento nel
  fuso dell'attività.
- Frequenza: un'email per ogni prenotazione, subito, inviata nella richiesta dopo la conferma al
  cliente. Un errore d'invio viene solo registrato nel log: la prenotazione resta salvata e gli
  altri destinatari ricevono comunque l'email (booking-domain: notifications).

Alternatives:
Solo i titolari (l'operatore saprebbe della prenotazione solo dal calendario); un interruttore
unico per prenotazioni e disdette (non si potrebbe tenere solo uno dei due avvisi); spento di
default (la funzione resterebbe sconosciuta); email essenziale senza contatti (il titolare
dovrebbe aprire il calendario per richiamare il cliente); riepilogo giornaliero (quota prevedibile,
ma avviso in ritardo e un job pianificato in più); invio in coda come le email di sospensione
(DEC-039: più robusto, ma più complesso; rimandato, TD-011).

Motivation:
Il titolare e l'operatore sanno subito chi arriva e possono richiamare il cliente dall'email.
Riusare il flusso delle disdette mantiene un solo modo di avvisare l'attività.
Costi accettati: ogni prenotazione online consuma fino a 2 email in più della quota di Resend
(100 al giorno col piano free, TD-009) e la risposta alla prenotazione aspetta anche questi invii
(TD-011). Il link al calendario apre l'attività selezionata in quel momento (TD-010).

Status:
Approved (Massimo, 23/11/2026)
```

---

```text
Decision:
DEC-041 — Revisione grafica: calendario su telefono, barra di salvataggio, campi e hover

Context:
Massimo ha chiesto il 24/11/2026 un giro sull'aspetto grafico: layout, link, hover, campi di
input con un ring animato, bottoni in fondo ai form e il calendario su telefono, dove «Nuovo
appuntamento» andava su una riga a sé e i filtri occupavano circa 300 px prima del primo
appuntamento. Ha scelto le soluzioni con domande a scelta e approvato il prototipo Claude Design
«Bookly – Revisione grafica e mobile».

Decision:
- Calendario, telefono: «Nuovo appuntamento» è un pulsante «+» flottante in basso a destra
  (PageAction, anche in Servizi, Staff e nella lista attività della piattaforma: da 640 px torna
  un bottone accanto al titolo). La data tra le frecce è il campo «Vai alla data» (un input date
  trasparente la copre). Giorno/Settimana a tutta larghezza. Operatore e «Mostra annullati» sono
  in un pannello «Filtri» con bozza (Azzera / Applica), badge col numero di filtri attivi e chip
  che li tolgono. Nella vista Settimana una striscia dei 7 giorni sceglie il giorno da elencare.
- Calendario, desktop: toolbar su una riga da 1280 px; sotto, il pannello Filtri. Passando su uno
  spazio libero della griglia compare l'anteprima «+ 10:30» dello slot (solo per slot non
  passati). Nella vista Giorno le intestazioni degli operatori non sono più colorate come «oggi».
- Form lunghi (Impostazioni, Orari, Brand, Profilo): una barra «Modifiche non salvate» con
  Annulla e Salva compare solo quando c'è qualcosa da salvare; su telefono è fissa in basso, da
  640 px è una card sticky in fondo al form. Annulla riporta i valori salvati.
- Dialog e conferme su telefono: Annulla e l'azione affiancati (1/3 e 2/3) invece che impilati;
  bottom sheet con altezza in dvh e animazione di apertura.
- Campi: stile unico in components/ui/fieldStyles.ts per TextField, SelectField, TextAreaField e
  gli input scritti a mano. Bordo più scuro in hover; al focus bordo primario e ring di 3 px che
  si allarga in 150 ms (sostituisce l'outline); ring rosso negli errori; etichetta colorata al
  focus. Solo token semantici: sulle pagine pubbliche segue il brand dell'attività.
- Hover e stati: Button senza hover quando è disabilitato e con effetto pressione; variante
  ghostDanger (rosso in hover) per cestini e rimozioni; hover su link, opzioni non selezionate,
  card cliccabili e blocchi della griglia. Un padding passato a Button sostituisce quello di
  default (prima vinceva px-4 per l'ordine del CSS generato).
- Link: percorsi da paths.ts con gli helper tenantPath, bookingPath, loginPath, registerPath
  (niente percorsi scritti a mano); telHref tiene solo cifre e «+» (il telefono accetta anche
  «.», «/» e «-», non validi in un link tel:); «Vedi pagina pubblica» si apre in una nuova
  scheda come in Impostazioni; i link in una nuova scheda lo dicono agli screen reader
  (NewTabHint); il logo dell'area gestione porta al calendario, non alla landing pubblica.
- Testi: ruolo tradotto nel riquadro dell'attività («Titolare» invece di «Owner»); NotFound e
  RouteError in i18n; «Ricordami» del login con CheckboxField.

Alternatives:
Icona «+» nella riga del titolo o «+ Nuovo» compatto (scartate da Massimo per il FAB); chip dei
filtri sempre visibili in una riga scorrevole o solo riordino dei controlli (scartate per il
pannello); salvataggio solo allineato in fondo al form o barra sempre visibile (scartate per la
barra che compare con le modifiche); due navigatori della data separati per telefono e desktop
(doppioni nel DOM e nei test).

Motivation:
Su telefono il calendario mostra gli appuntamenti dal primo schermo e l'azione principale è a
portata di pollice. Le modifiche non salvate si vedono subito anche in fondo a pagine lunghe.
Campi, bottoni e link hanno stati coerenti in tutta l'app e nei brand delle attività.
La safe area di iPhone è già nei padding (env(safe-area-inset-bottom)) ma resta inattiva senza
viewport-fit=cover (TD-012).

Status:
Approved (Massimo, 24/11/2026)
```
