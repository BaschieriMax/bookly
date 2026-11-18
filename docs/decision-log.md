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
