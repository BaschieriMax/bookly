# Project Overview — Bookly

Data: 2026-11-18 · Dimensione: **medio-grande** · Stato: **Approvato** (2026-11-18) · UI approvata (2026-11-18)
Repository: `BaschieriMax/bookly` (monorepo)

---

## 1. PROJECT OVERVIEW

Bookly è una web app **multi-tenant** per le prenotazioni online delle attività locali (barbieri, estetiste, piccoli negozi). Ogni attività ha una pagina pubblica (`/b/{slug}`) da cui i clienti registrati prenotano un servizio con un operatore. Il titolare gestisce servizi, staff, orari, assenze e calendario. Il super-admin della piattaforma (Massimo) attiva, sospende e configura le attività.

Un'unica applicazione e un unico deploy servono più attività, con i dati isolati per tenant.

## 2. GOALS

- Prenotazione completa da mobile in **meno di 60 secondi**, da utente già registrato.
- **Zero doppie prenotazioni**, garantite dal database e non solo dal codice.
- **Zero accessi ai dati di un altro tenant**, verificato da test automatici.
- Costo di hosting **0 €/mese** finché si resta nei piani gratuiti.
- Onboarding di una nuova attività in **meno di 10 minuti**, fatto dal super-admin.
- Prodotto dimostrabile e vendibile ai lead del Lead Engine, e progetto da portfolio full-stack.

## 3. TARGET USERS

| Utente | Contesto | Dispositivo prevalente |
|---|---|---|
| Cliente finale | Prenota dal telefono, spesso in mobilità | Mobile (≥ 80%) |
| Titolare (Owner) | Gestisce agenda e impostazioni, in negozio o a casa | Tablet / desktop, a volte mobile |
| Operatore (Staff) | Consulta i propri appuntamenti del giorno | Mobile / tablet |
| Super-admin | Onboarding e supporto ai tenant | Desktop |

Competenze tecniche basse per clienti e titolari: la UX deve essere semplice e guidata.

## 4. USER JOURNEYS

**J1 — Prenotazione (cliente)**
1. Apre `/b/sfumo-barber` (link da Instagram, Google o QR code).
2. Sceglie il servizio, poi l'operatore (oppure "qualsiasi").
3. Sceglie il giorno e vede gli slot liberi.
4. Se non è autenticato, fa login o si registra: il wizard conserva la selezione.
5. Conferma e riceve un'email di conferma con il link per gestire o disdire.
6. Riceve un promemoria email 24 ore prima.

**J2 — Disdetta (cliente)**: Area personale → Appuntamenti → Disdici. È consentita solo entro la finestra di disdetta del tenant (es. fino a 12 ore prima).

**J3 — Gestione agenda (titolare)**: Calendario giorno/settimana → appuntamento → sposta, annulla o segna no-show. Il cliente riceve un'email a ogni modifica.

**J4 — Configurazione (titolare)**: Servizi (durata, buffer, prezzo) → Staff (servizi offerti) → Orari settimanali per operatore, con più fasce al giorno → Assenze e ferie.

**J5 — Onboarding (super-admin)**: crea il tenant (nome, slug, fuso orario) → invita il titolare via email → il titolare imposta la password e completa la configurazione.

## 5. FEATURES

**Must-have (MVP)**
- Multi-tenancy con slug, isolamento dei dati, sospensione dei tenant.
- Account con conferma email, login, logout, reset password.
- Catalogo servizi: durata, buffer, prezzo indicativo, attivo/disattivo.
- Staff multipli, con associazione operatore ↔ servizi.
- Orari di lavoro settimanali per operatore (più fasce al giorno) e assenze.
- Calcolo degli slot disponibili.
- Prenotazione, disdetta e spostamento.
- Calendario admin giorno/settimana.
- Stati dell'appuntamento: confermato, disdetto dal cliente, annullato dall'attività, completato, no-show.
- Email transazionali: conferma account, reset password, conferma prenotazione, modifica, disdetta, promemoria 24h.
- Area cliente: storico appuntamenti, profilo, export dei dati, cancellazione account.
- Dashboard super-admin: elenco tenant, creazione, sospensione, invito del titolare.
- Brand per tenant: logo e colore primario, con verifica automatica del contrasto (DEC-016).
- Pagine legali: privacy policy e termini.

**Nice-to-have (dopo l'MVP)**
- Passkey (supportate da Identity in .NET 10).
- Inglese (l'infrastruttura i18n c'è già).
- Esportazione `.ics` / aggiunta al calendario.
- Statistiche base per il titolare (appuntamenti per servizio, tasso di no-show).
- Lista d'attesa.

**Fuori scope**
- Pagamenti online o caparre.
- Notifiche SMS o WhatsApp.
- App mobile nativa.
- Sincronizzazione con Google Calendar.

## 6. PAGES

| Route | Scopo | Accesso |
|---|---|---|
| `/` | Landing della piattaforma (cos'è Bookly, contatto) | Pubblica |
| `/b/:slug` | Pagina dell'attività: info, servizi, CTA "Prenota" | Pubblica |
| `/b/:slug/prenota` | Wizard di prenotazione (servizio → operatore → slot → conferma) | Pubblica; conferma solo da autenticato |
| `/login`, `/registrati` | Autenticazione | Ospite |
| `/password-dimenticata`, `/reimposta-password`, `/conferma-email` | Recupero password e conferma email | Ospite |
| `/account/appuntamenti` | Storico e prossimi appuntamenti, disdetta | Customer |
| `/account/profilo` | Dati personali, export dei dati, cancellazione account | Autenticato |
| `/admin` | Calendario giorno/settimana | Owner, Staff (lo Staff vede solo i propri appuntamenti) |
| `/admin/servizi` | CRUD servizi | Owner |
| `/admin/staff` | CRUD operatori e servizi offerti | Owner |
| `/admin/orari` | Orari settimanali e assenze | Owner (lo Staff vede i propri) |
| `/admin/impostazioni` | Dati dell'attività, finestra di disdetta, intervallo degli slot | Owner |
| `/platform/tenant` | Elenco, creazione e sospensione tenant, inviti | SuperAdmin |
| `/privacy`, `/termini` | Documenti legali | Pubblica |

Nota: le URL visibili sono in italiano. Codice, route name e chiavi i18n sono in inglese.

## 7. FRONTEND ARCHITECTURE

**Stack**: React 19 + Vite 8 (Rolldown) + TypeScript strict, ESLint + Prettier, React Router v8 (data mode con `createBrowserRouter`, import da `react-router`), TanStack Query v5 + Axios, React Hook Form + Zod per i form con validazione, Tailwind CSS v4, react-i18next (solo `it` per ora), react-hot-toast, lucide-react. Zustand non c'è: lo stato server sta in TanStack Query e la sessione arriva da `GET /api/auth/me`, anch'essa in cache.

**Routing e layout**
- `PublicLayout`: landing, pagine dell'attività, legali.
- `AuthLayout`: login, registrazione, recupero password; reindirizza se già autenticato.
- `AccountLayout`: area cliente, richiede autenticazione.
- `AdminLayout`: sidebar, richiede il ruolo Owner o Staff sul tenant corrente.
- `PlatformLayout`: richiede SuperAdmin.
- Ogni layout ha un `errorElement` (`RouteError`). Le pagine si caricano in lazy loading tramite `withSuspense(...)` con fallback centralizzato `<PageSpinner />`.
- Le guardie (`RequireAuth`, `RequireRole`) servono solo alla UX: l'autorizzazione vera è sul backend.

**Data fetching**
- Un client Axios con `baseURL: "/api"` e `withCredentials`. Axios legge il cookie `XSRF-TOKEN` e invia l'header `X-XSRF-TOKEN` sulle richieste che modificano dati.
- Un interceptor mappa 401 → logout lato client con redirect a `/login?redirect=...`, 403 → toast "Non autorizzato" e 5xx → toast generico.
- I tipi delle API sono **generati dall'OpenAPI** del backend (`openapi-typescript`) in `src/types/api.gen.ts`, mai scritti a mano.
- `staleTime` di default 5 minuti. Disponibilità degli slot e calendario usano `staleTime: 0` e vengono invalidati dopo ogni mutazione.
- Query key centralizzate per feature (`bookingKeys.availability(slug, serviceId, date)`).

**Form**: React Hook Form + Zod per login, registrazione, servizi, orari e impostazioni. Gli errori di validazione del backend (`ProblemDetails.errors`) vengono mappati sui campi.

**Componenti riutilizzabili** (custom, Tailwind): `Button`, `Input`, `Select`, `Dropdown`, `Modal`, `Card`, `Badge`, `EmptyState`, `DataTable` (semplice), `FormField`, `PageHeader`.
**Proposta shadcn/ui** solo per **Calendar/DatePicker**: il calcolo delle settimane, la navigazione da tastiera e l'accessibilità sono complessi e reinventarli non porta valore. Va confermata in fase UI.
**Calendario admin**: componente custom (griglia oraria giorno/settimana con CSS grid), perché le librerie di calendario complete sono pesanti per quello che serve qui. Da rivalutare se emergono il drag & drop o viste mensili complesse.

**Sidebar lato server (DEC-019)**: `AdminLayout` e `PlatformLayout` disegnano la sidebar da `GET /api/navigation?area=...` (hook `useNavigation`, `staleTime` 5 min). Ogni voce ha `icon` (risolta da una allowlist `iconRegistry` di lucide-react) e `route` (deve esistere nel router: le voci sconosciute vengono ignorate e loggate in sviluppo; un test verifica la coerenza con il seed).

**Gestione errori**: `RouteError` per route, toast per gli errori di mutazione, stati `loading / empty / error` progettati per ogni lista.

## 8. BACKEND ARCHITECTURE

**Stack**: .NET 10 LTS, ASP.NET Core 10 con **Controllers**, EF Core 10 + Npgsql, ASP.NET Core Identity, OpenAPI 3.1 nativo + Scalar (solo in Development), rate limiting integrato, Resend SDK, Serilog con output JSON.

**Struttura** (semplice, senza Clean Architecture, CQRS o Repository):

```text
apps/api/src/Bookly.Api/
├── Controllers/     # Auth, Public, Bookings, Me, Admin*, Platform, Jobs
├── Services/        # AvailabilityService, BookingService, TenantService, EmailService, ReminderService
├── Entities/        # Tenant, AppUser, StaffMember, Service, WorkingHours, TimeOff, Appointment...
├── DTOs/            # Request/Response record, mai entity esposte
├── Data/            # AppDbContext, configurazioni, migrazioni, seed
├── Tenancy/         # ITenantContext, middleware di risoluzione del tenant
├── Infrastructure/  # Email (Resend/SMTP), template email, clock (TimeProvider)
└── Program.cs
```

**Risoluzione del tenant**
- Route pubbliche e di prenotazione: dallo slug nell'URL (`/api/public/tenants/{slug}/...`).
- Route admin: dal tenant su cui l'utente ha una membership (claim `tenant_id`), mai da un parametro del client.
- `ITenantContext` (scoped) è la base dei **global query filter** EF Core (`e => e.TenantId == tenantContext.TenantId`) su tutte le entity tenant-scoped.

**Validazione**: DataAnnotations e controlli di dominio nei Services (es. slot ancora libero, entro la finestra di disdetta). Risposte d'errore uniformi con **ProblemDetails** (RFC 9457) e codici stabili (`booking.slot_unavailable`) che il client traduce.

**Errori**: `IExceptionHandler` globale. Le eccezioni attese diventano 4xx con codice; quelle inattese diventano 500 senza dettagli verso il client, con log completo lato server. L'OWASP 2025 ha aggiunto la categoria **A10 Mishandling of Exceptional Conditions**: ogni chiamata esterna (email, DB) ha timeout e una gestione esplicita del fallimento.

**Tempo**: `TimeProvider` iniettato, così i test controllano l'orologio. Gli istanti si salvano in UTC (`timestamptz`). Il fuso del tenant (`Europe/Rome`) si usa solo per calcolare gli orari locali e gestire l'ora legale.

**Promemoria**: endpoint `POST /api/jobs/send-reminders`, protetto da un segreto in header, chiamato da un cron di GitHub Actions ogni 15 minuti (vedi DEC-012). L'invio è idempotente grazie a `ReminderSentAt`.

## 9. DATABASE

**PostgreSQL 17** (Neon in produzione, container in locale). Migrazioni EF Core versionate nel repo.

**Modello principale**

```text
Tenant(Id, Slug UQ, Name, TimeZone, Status[Active|Suspended], Phone, Address,
       CancellationWindowHours, SlotIntervalMinutes, BrandPrimaryColor?, CreatedAt)
TenantLogo(TenantId PK, ContentType, Data bytea ≤ 200 KB, UpdatedAt)

AppUser : IdentityUser<Guid>(FirstName, LastName, PhoneNumber, PrivacyAcceptedAt, CreatedAt)
TenantMembership(TenantId, UserId, Role[Owner|Staff])          PK(TenantId, UserId)

StaffMember(Id, TenantId, DisplayName, UserId?, IsActive)
Service(Id, TenantId, Name, DurationMinutes, BufferMinutes, PriceCents?, IsActive)
StaffService(StaffMemberId, ServiceId)                           PK composta
WorkingHours(Id, TenantId, StaffMemberId, DayOfWeek, StartLocal time, EndLocal time)
TimeOff(Id, TenantId, StaffMemberId, StartUtc, EndUtc, Reason?)

Appointment(Id, TenantId, StaffMemberId, ServiceId, CustomerId,
            StartUtc, EndUtc, BlockedUntilUtc,      -- EndUtc + buffer
            Status, CustomerNote?, ReminderSentAt?, CreatedAt, UpdatedAt, xmin)

DataProtectionKeys(...)   -- chiavi di ASP.NET Data Protection, persistenti

-- schema "ui" (DEC-019)
ui.NavigationItem(Id, Key UQ, LabelKey, Icon, Route, Area[admin|platform], SortOrder, ParentId?, IsEnabled)
ui.NavigationItemRole(NavigationItemId, Role[Owner|Staff|SuperAdmin])   PK composta
```

**Vincolo anti-doppia-prenotazione** (DEC-009):

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE appointments ADD CONSTRAINT ex_appointments_no_overlap
  EXCLUDE USING gist (
    staff_member_id WITH =,
    tstzrange(start_utc, blocked_until_utc, '[)') WITH &&
  ) WHERE (status = 'Confirmed');
```

Se due richieste concorrenti puntano allo stesso slot, la seconda fallisce con errore `23P01`, che diventa 409 `booking.slot_unavailable`. Neon supporta `btree_gist`.

**Indici**: `Tenant.Slug` (unique), `Appointment(TenantId, StaffMemberId, StartUtc)`, `Appointment(CustomerId, StartUtc)`, `Appointment(Status, StartUtc) WHERE ReminderSentAt IS NULL` per il job dei promemoria.

**Query pattern**: letture in `AsNoTracking()` con proiezione diretta sui DTO. Calcolo degli slot = fasce di lavoro − assenze − appuntamenti confermati, per un giorno e un operatore alla volta (poche righe).

**Concorrenza**: `xmin` come token di concorrenza ottimistica sugli update di `Appointment`.

## 10. AUTHENTICATION

**Tipo scelto da Massimo**: cookie HttpOnly con ASP.NET Core Identity (DEC-005).

- Cookie di sessione `__Host-bookly.auth`: `HttpOnly`, `Secure`, `SameSite=Lax`, path `/`, nessun `Domain`. Sliding expiration di 14 giorni ("ricordami") oppure solo per la sessione del browser.
- **Antiforgery**: un cookie `XSRF-TOKEN` leggibile da JS e l'header `X-XSRF-TOKEN` validato su tutte le richieste che modificano dati. Il token viene rigenerato dopo login e logout.
- In ASP.NET Core 10 gli endpoint API con autenticazione a cookie non reindirizzano più alla pagina di login: restituiscono direttamente 401/403. È il comportamento giusto per una SPA.
- **Revoca immediata**: il security stamp di Identity viene validato ogni 5 minuti, oppure subito dopo cambio password o "esci da tutti i dispositivi".
- **Password**: hasher di Identity (PBKDF2), minimo 10 caratteri. Lockout dopo 5 tentativi falliti per 15 minuti.
- **Conferma email obbligatoria** prima di poter prenotare. Link di conferma e reset con scadenza breve (reset: 1 ora).
- **Data Protection keys** persistite su Postgres: senza, a ogni riavvio del container su Render tutti gli utenti verrebbero disconnessi e i token di antiforgery diventerebbero invalidi.
- Endpoint custom (`AuthController`) costruiti su `SignInManager`/`UserManager` invece di `MapIdentityApi`, che non gestisce membership di tenant né inviti.

Account **globali**: un cliente usa lo stesso account per prenotare presso attività diverse.

## 11. AUTHORIZATION

| Ruolo | Ambito | Può |
|---|---|---|
| SuperAdmin | Piattaforma (ruolo Identity) | Gestire i tenant, invitare i titolari. Non vede gli appuntamenti dei tenant (minimizzazione) |
| Owner | Tenant (membership) | Tutto sul proprio tenant |
| Staff | Tenant (membership) | Vedere e gestire solo i propri appuntamenti, orari e assenze |
| Customer | Globale | Prenotare, vedere e disdire solo i propri appuntamenti, export e cancellazione dei propri dati |

- Policy ASP.NET Core: `TenantOwner`, `TenantMember`, `PlatformAdmin`.
- I controlli di ownership (es. "appuntamento del cliente corrente") stanno nei Services, non solo negli attributi.
- Il global query filter isola i tenant. La regola "lo Staff vede solo i propri appuntamenti" è un filtro aggiuntivo nel service.
- **Test obbligatori** per ogni endpoint admin e cliente: utente di un altro tenant → 404, ruolo insufficiente → 403, anonimo → 401.

## 12. API CONTRACT

Prefisso `/api`. JSON. Errori in formato `ProblemDetails` con `code`. Le richieste che modificano dati richiedono `X-XSRF-TOKEN`. Le rotte admin usano il tenant indicato dall'header `X-Bookly-Tenant` (id), sempre verificato sulle membership dell'utente (DEC-023).

| Metodo | Route | Auth | Note |
|---|---|---|---|
| GET | `/auth/me` | Opz. | Utente corrente + membership, 204 se anonimo |
| POST | `/auth/register` | Anonimo | Rate limited |
| POST | `/auth/login` | Anonimo | Rate limited, lockout |
| POST | `/auth/logout` | Auth | |
| POST | `/auth/confirm-email` · `/auth/resend-confirmation` | Anonimo | Rate limited |
| POST | `/auth/forgot-password` · `/auth/reset-password` | Anonimo | Risposta identica che l'email esista o no |
| POST | `/auth/accept-invite` | Anonimo | Token d'invito del titolare |
| GET | `/public/tenants/{slug}` | Pubblico | 404 se il tenant è sospeso |
| GET | `/public/tenants/{slug}/services` | Pubblico | Con gli operatori abilitati |
| GET | `/public/tenants/{slug}/availability?serviceId&staffId?&date` | Pubblico | Slot liberi del giorno, rate limited |
| POST | `/tenants/{slug}/appointments` | Customer (email confermata) | 201 · 409 `booking.slot_unavailable` |
| GET | `/me/appointments` | Customer | Prossimi e passati |
| POST | `/me/appointments/{id}/cancel` | Customer | 422 `booking.cancellation_window_passed` |
| GET | `/me/export` | Auth | JSON con i dati personali (GDPR art. 15/20) |
| DELETE | `/me` | Auth | Anonimizza gli appuntamenti passati, cancella l'account |
| GET | `/admin/appointments?from&to&staffId?` | Owner/Staff | |
| PATCH | `/admin/appointments/{id}` | Owner/Staff | Sposta (stessi vincoli di disponibilità) |
| POST | `/admin/appointments/{id}/cancel` · `/no-show` · `/complete` | Owner/Staff | |
| GET/POST/PUT/DELETE | `/admin/services[/{id}]` | Owner | |
| GET/POST/PUT/DELETE | `/admin/staff[/{id}]` | Owner | |
| GET/PUT | `/admin/staff/{id}/working-hours` | Owner, Staff (se stesso) | Sostituzione completa della settimana |
| GET/POST/DELETE | `/admin/staff/{id}/time-off[/{id}]` | Owner, Staff (se stesso) | |
| GET/PUT | `/admin/settings` | Owner | |
| GET/POST | `/platform/tenants` | SuperAdmin | |
| POST | `/platform/tenants/{id}/suspend` · `/activate` · `/invite-owner` | SuperAdmin | |
| POST | `/jobs/send-reminders` | Header `X-Job-Secret` | Idempotente, escluso dall'antiforgery |
| GET | `/navigation/admin` | Owner/Staff | Voci della sidebar per il ruolo nel tenant corrente (DEC-019) |
| GET | `/navigation/platform` | SuperAdmin | Voci della sidebar della piattaforma |
| GET | `/platform/navigation` | SuperAdmin | Tutte le voci, con ruoli e stato |
| PATCH | `/platform/navigation/{id}` | SuperAdmin | Abilita/disabilita, riordina |
| GET | `/health` | Pubblico | Liveness + ping al DB |

Il contratto completo e sempre aggiornato è l'OpenAPI generato (`/openapi/v1.json`), esplorabile con Scalar in Development.

## 13. UI / UX

- **Mobile-first** per il flusso pubblico: wizard a step con barra di avanzamento, una decisione per schermata, CTA fissa in basso su mobile.
- **Admin**: desktop e tablet first con sidebar, ma il calendario "oggi" deve funzionare su mobile per lo Staff.
- Ogni lista e pagina ha gli stati loading (skeleton), empty (con CTA), error (con riprova) e forbidden/not found.
- Feedback: toast per le azioni, conferma esplicita per le azioni distruttive (annulla appuntamento, elimina servizio).
- Testi chiari e brevi, in italiano (`design:ux-copy` per errori e stati vuoti).

## 14. DESIGN DIRECTIONS

Proposte: **A — Bottega** (avorio, terracotta, serif), **B — Clinica pulita** (minimale, blu-verde), **C — Brand del tenant** (base neutra + colore primario e logo per attività).

**Scelta: C** (DEC-016). I token `--color-primary`, `--color-primary-fg` e il logo arrivano da `GET /public/tenants/{slug}` e vengono applicati come variabili CSS sul layout dell'attività. L'admin e la piattaforma usano il brand neutro di Bookly. Il prototipo si fa in Claude Design; l'integrazione nel codice avviene solo dopo la conferma di Massimo. Prototipo **approvato** il 2026-11-18: https://claude.ai/artifact/TaKc2HFsTSb1K883kMC6Vz

**Personalizzazione degli stili (DEC-018)**: tutti i colori, i font e i raggi sono variabili CSS in `apps/web/src/styles/tokens.css`, esposte a Tailwind con `@theme inline`. I componenti usano solo classi semantiche (`bg-primary`, `text-muted`, `font-heading`). Per cambiare palette o font si modifica solo quel file (più `fonts.css` per aggiungere una famiglia).

Dark mode: **no per l'MVP** (ASSUNZIONE A6). I token sono comunque variabili CSS, così aggiungerla in seguito costa poco.

## 15. RESPONSIVE STRATEGY

Breakpoint Tailwind standard (`sm 640`, `md 768`, `lg 1024`, `xl 1280`). Mobile-first.
Punti critici:
- **Griglia degli slot**: chip a 3 colonne su mobile, 5-6 su desktop.
- **Calendario admin**: su mobile vista "giorno" a lista verticale; da `md` la griglia oraria; da `lg` la vista settimana.
- **Tabelle admin** (servizi, staff): diventano card sotto `md`.
- **Modali**: a schermo intero su mobile, centrate da `md`.

Verifica a 375, 768, 1280 e 1536 px prima di chiudere ogni pagina.

## 16. ACCESSIBILITY

Obiettivo **WCAG 2.2 AA**: HTML semantico, gerarchia dei titoli, focus visibile, wizard e calendario navigabili da tastiera, label ed errori dei form collegati (`aria-describedby`), contrasto ≥ 4.5:1, touch target ≥ 44px, `prefers-reduced-motion`. Gli slot sono `button` veri con stato annunciato. Audit con `design:accessibility-review` in Fase 3, più controlli automatici con axe in Playwright.

## 17. PERFORMANCE

- Code splitting per route (lazy). Il bundle dell'admin non viene mai scaricato dal flusso pubblico.
- Target sulla pagina pubblica dell'attività (mobile 4G): LCP < 2.5 s, CLS < 0.1, INP < 200 ms.
- Font self-hosted con `font-display: swap`, al massimo 2 famiglie.
- Asset statici con hash e `Cache-Control: immutable`; `index.html` con `no-cache`.
- API: proiezioni sui DTO, `AsNoTracking`, compressione Brotli/Gzip.
- **Limite noto**: il cold start di Render free (30-60 s dopo 15 minuti di inattività) è fuori dal nostro controllo. Vedi Rischi R1.

## 18. SECURITY

Livello scelto: **Standard**, mappato su OWASP Top 10:2025.

| OWASP 2025 | Contromisura |
|---|---|
| A01 Broken Access Control | Policy per ruolo, global query filter per tenant, controlli di ownership nei service, test di accesso negato |
| A02 Security Misconfiguration | Security headers (CSP restrittiva senza `unsafe-inline` per gli script, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors 'none'`), Scalar solo in Development, errori senza dettagli in produzione |
| A03 Software Supply Chain Failures | Lockfile committati, `npm ci`, Dependabot (npm, NuGet, Actions, Docker), CodeQL, `npm audit` e `dotnet list package --vulnerable` in CI, GitHub Actions pinnate per SHA, immagine Docker base ufficiale |
| A04 Cryptographic Failures | HTTPS ovunque, cookie `Secure`, hashing di Identity, segreti solo in env/secret |
| A05 Injection | Solo EF Core e query parametrizzate, nessun SQL concatenato; React fa l'escape, niente `dangerouslySetInnerHTML` |
| A06 Insecure Design | Vincolo DB anti-overlap, finestra di disdetta lato server, minimizzazione dei dati |
| A07 Authentication Failures | Lockout, rate limiting, conferma email, password minimo 10 caratteri, revoca tramite security stamp |
| A08 Software/Data Integrity Failures | Antiforgery, build riproducibile in CI, deploy solo da `main` con CI verde |
| A09 Logging & Alerting Failures | Log strutturati senza PII o token, eventi di sicurezza loggati (login falliti, lockout, accessi negati) |
| A10 Mishandling of Exceptional Conditions | Exception handler globale, timeout e gestione dei fallimenti per DB ed email, transazioni sulle operazioni multi-step |

**Rate limiting** (fixed/sliding window integrato): login e registrazione 5/min per IP, recupero password 3/15 min, disponibilità 60/min per IP, prenotazione 10/min per utente.

La security review completa (checklist di `auth-security.md`) si esegue in Fase 3.

## 19. COMPLIANCE, i18n, OBSERVABILITY

**GDPR**
- Dati trattati: nome, cognome, email, telefono, appuntamenti, note facoltative. Nessun dato di categoria particolare. Il campo note avvisa di non inserire dati sanitari.
- Ruoli privacy: ogni attività è **titolare** dei dati dei propri clienti, Bookly è **responsabile** del trattamento. Serve un DPA/contratto con ogni tenant (testo da far verificare a un professionista).
- Diritti degli interessati: export JSON, rettifica dal profilo, cancellazione con anonimizzazione degli appuntamenti passati (servono all'attività per lo storico).
- Conservazione: appuntamenti anonimizzati dopo 24 mesi (ASSUNZIONE A5).
- **Cookie**: solo tecnici (auth, antiforgery) e nessun analytics, quindi **niente banner** secondo le linee guida del Garante. Cookie policy informativa nel footer.
- Fornitori terzi: Render (hosting), Neon (DB), Resend (email), GitHub. Le regioni UE vanno verificate e preferite al deploy.
- I testi di privacy policy e termini sono bozze da far validare.

**i18n**: react-i18next con namespace per feature, solo `it`. Date e orari con `Intl.DateTimeFormat` nel fuso del tenant. Il backend restituisce codici d'errore stabili, che il client traduce.

**Observability**
- Serilog in JSON su stdout (log di Render), con correlation id per richiesta.
- `/health` usato dal health check di Render.
- Error tracking frontend e backend con **Sentry**, piano free: limiti da verificare in Fase 4, scrubbing delle PII attivo.

**Email transazionali**: Resend in produzione (piano free: 3.000 email al mese, massimo 100 al giorno). Mailpit in locale. Template HTML versionati nel repo e localizzati. SPF, DKIM e DMARC sul dominio di invio (vedi domanda aperta Q2).

## 20. TESTING

| Livello | Strumento | Cosa |
|---|---|---|
| Unit backend | xUnit + `FakeTimeProvider` | `AvailabilityService` (fasce, buffer, assenze, cambio ora legale, slot nel passato), regole di disdetta |
| Integration backend | xUnit + `WebApplicationFactory` + **Testcontainers (Postgres reale)** | Endpoint, vincolo anti-overlap in concorrenza, **isolamento tra tenant**, 401/403/404, antiforgery |
| Unit/componenti frontend | Vitest + React Testing Library + MSW | Form, wizard, stati loading/empty/error, guardie di route |
| E2E | Playwright (+ axe) | J1 prenotazione completa, J2 disdetta, J3 spostamento da admin, login/logout |
| Manuale | Scalar | Esplorazione delle API in Development |

Copertura mirata alle parti critiche (disponibilità, prenotazione, autorizzazione), senza inseguire una percentuale.

## 21. GIT

- Monorepo su GitHub `BaschieriMax/bookly`. `main` protetto: si entra solo con PR e CI verde.
- Branch brevi: `feat/...`, `fix/...`, `chore/...`.
- **Commit in italiano**, formato `tipo: descrizione` (DEC-017), es. `feat: aggiunge calcolo slot disponibili`.
- Tag semantici (`v0.1.0` per il primo MVP rilasciato).

## 22. DOCKER

**Sì.**
- `docker-compose.yml` per lo sviluppo: Postgres 17 + Mailpit. API e web girano nativi per avere hot reload.
- `Dockerfile` multi-stage per la produzione:
  1. Node: build di `apps/web`.
  2. .NET SDK: publish di `apps/api`.
  3. Runtime `aspnet:10.0` con la build web in `wwwroot`.
- L'immagine runtime include `tzdata`, necessario per `Europe/Rome`. Le immagini *chiseled* non lo includono.
- I test di integrazione usano Testcontainers, quindi in CI serve Docker (disponibile sui runner Ubuntu di GitHub).

## 23. DEPLOYMENT

| Componente | Provider | Costo | Limiti rilevanti |
|---|---|---|---|
| App (API + SPA) | Render — Web Service free (Docker) | 0 € | Pausa dopo 15 min di inattività, cold start 30-60 s, 512 MB RAM, banda ridotta (da riverificare) |
| Database | Neon — Free | 0 € | 1 GB per progetto, 100 CU-ore al mese, scale-to-zero |
| Email | Resend — Free | 0 € | 3.000 al mese, 100 al giorno, 1 dominio |
| Cron promemoria | GitHub Actions `schedule` | 0 € | Ritardi possibili di qualche minuto nei picchi |

**Quando pagare**: con il primo cliente pagante conviene il piano Render a pagamento più economico, per eliminare il cold start dalla pagina pubblica. Oltre 100 email al giorno serve Resend Pro (circa 20 $/mese). I prezzi vanno verificati in Fase 4.

**CI/CD (GitHub Actions)**
- `ci.yml` su ogni PR: lint e typecheck del web, test web, build web; build e test dell'API con Testcontainers; verifica che il client OpenAPI generato sia aggiornato; audit delle dipendenze.
- `codeql.yml`: analisi C# e TypeScript.
- `deploy.yml` su `main`: build dell'immagine, poi deploy hook Render. Le migrazioni EF si applicano con un **migration bundle** eseguito come step separato prima dello switch, non all'avvio dell'app.
- `e2e.yml`: Playwright su PR verso `main` (contro docker compose).
- `reminders.yml`: cron ogni 15 minuti → `POST /api/jobs/send-reminders`.

**Rollback**: si rifà il deploy dell'immagine precedente da Render. Le migrazioni sono progettate per essere retrocompatibili (expand → contract). Prima di ogni migrazione distruttiva si crea un branch Neon come backup istantaneo.

## 24. ENVIRONMENTS

| Ambiente | URL | DB | Email | Segreti |
|---|---|---|---|---|
| Development | `localhost:5173` (Vite, proxy `/api` → `localhost:5080`) | Postgres in Docker | Mailpit | `dotnet user-secrets`, `.env.local` |
| Test (CI) | — | Testcontainers | Fake in memoria | GitHub Secrets (nessuno reale) |
| Production | `bookly-xxxx.onrender.com` (dominio custom opzionale) | Neon | Resend | Env vars di Render, GitHub Secrets per il job secret |

Variabili principali: `ConnectionStrings__Default`, `Resend__ApiKey`, `Email__From`, `Jobs__Secret`, `App__PublicBaseUrl`, `Sentry__Dsn`, `VITE_SENTRY_DSN`. Nel repo c'è solo `.env.example`, senza valori reali.

## 25. PROJECT STRUCTURE

```text
bookly/
├── apps/
│   ├── api/
│   │   ├── Bookly.sln
│   │   ├── src/Bookly.Api/                # vedi §8
│   │   └── tests/
│   │       ├── Bookly.Api.UnitTests/
│   │       └── Bookly.Api.IntegrationTests/
│   └── web/
│       ├── index.html
│       ├── vite.config.ts
│       └── src/
│           ├── app/              # router.tsx, providers.tsx, layouts/, withSuspense.tsx
│           ├── features/
│           │   ├── auth/
│           │   ├── booking/      # pagina attività + wizard
│           │   ├── account/
│           │   ├── admin-calendar/
│           │   ├── admin-catalog/  # servizi + staff
│           │   ├── admin-schedule/ # orari + assenze
│           │   ├── admin-settings/
│           │   └── platform/
│           ├── components/       # UI riutilizzabili
│           ├── services/         # apiClient.ts (Axios)
│           ├── types/            # api.gen.ts (generato)
│           ├── i18n/             # it/*.json
│           ├── utils/            # date/timezone helpers
│           └── styles/           # tailwind entry + token CSS
├── e2e/                          # Playwright
├── docs/                         # questo documento, decision-log, tech-debt
├── .github/
│   ├── workflows/                # ci, codeql, deploy, e2e, reminders
│   └── dependabot.yml
├── docker-compose.yml
├── Dockerfile
├── .env.example
└── README.md
```

## 26. IMPLEMENTATION PLAN

Ogni step chiude con: build verde, lint e typecheck, test, commit e PR.

| Step | Nome | Obiettivo | Dipende da |
|---|---|---|---|
| 0 | Scaffolding monorepo | Struttura, Vite + React + TS + Tailwind con design token (DEC-018), .NET 10 sln, docker-compose, ESLint/Prettier, README, CI minima per verificare le build | — |
| 1 | CI base | `ci.yml`, `codeql.yml`, Dependabot, branch protection (indicazioni per Massimo) | 0 |
| 2 | Dati e migrazioni | Entity, DbContext, global filter per tenant, exclusion constraint, schema `ui` + seed della navigazione, seed demo | 0 |
| 3 | Auth & Identity | Cookie, antiforgery, Data Protection su DB, register/login/confirm/reset, rate limiting, email (Mailpit) | 2 |
| 4 | OpenAPI → tipi TS + navigazione | Generazione dei tipi, client Axios, `useMe`, guardie di route, layout, `GET /api/navigation` + sidebar dal server | 3 |
| 5 | Disponibilità | `AvailabilityService` + test (ora legale, buffer, assenze) + endpoint pubblici | 2 |
| 6 | Prenotazione cliente | Endpoint di booking (409 in concorrenza), area cliente, disdetta, email | 4, 5 |
| — | **UI/UX** | Direzioni → prototipo Claude Design → conferma di Massimo | Può partire in parallelo dallo step 1 |
| 7 | Frontend pubblico | Pagina attività, wizard, auth UI, area cliente, con il design approvato | 6 + UI |
| 8 | Admin: catalogo e orari | Servizi, staff, orari, assenze, impostazioni (API + UI) | 7 |
| 9 | Admin: calendario | Viste giorno/settimana, sposta, annulla, no-show | 8 |
| 10 | Piattaforma | SuperAdmin: tenant, sospensione, invito del titolare | 3 |
| 11 | Promemoria | Endpoint job + workflow cron + idempotenza | 6 |
| 12 | GDPR & legali | Export, cancellazione/anonimizzazione, pagine legali, retention | 6 |
| 13 | Hardening | Security headers/CSP, Sentry, logging, a11y, E2E Playwright | 7-12 |
| 14 | Collaudo (Fase 3) | Checklist QA + Production Readiness | 13 |
| 15 | Release (Fase 4) | Render + Neon + Resend, migration bundle, smoke test | 14 |

## 27. RISKS

| ID | Rischio | Prob. | Impatto | Mitigazione |
|---|---|---|---|---|
| R1 | Cold start di Render free: il cliente aspetta 30-60 s alla prima apertura | Alta | Medio | Il cron ogni 15 min tiene l'istanza sveglia in parte; il frontend mostra lo stato "sto avviando"; passare al piano a pagamento con il primo cliente reale (TD-001) |
| R2 | Leak di dati tra tenant | Bassa | **Critico** | Global query filter + tenant dal claim + test di integrazione dedicati per ogni endpoint |
| R3 | Bug di fuso orario e ora legale negli slot | Media | Alto | UTC nel DB, `TimeZoneInfo` IANA, test sui cambi d'ora di marzo e ottobre |
| R4 | Doppia prenotazione in concorrenza | Bassa | Alto | Exclusion constraint + test concorrente |
| R5 | Free tier modificati o ridotti dai provider | Media | Medio | Container standard e Postgres standard: migrazione a costo basso. Verifica in Fase 4 |
| R6 | Email nello spam | Media | Medio | Dominio di invio con SPF, DKIM e DMARC (richiede un dominio, Q2) |
| R7 | SEO limitata delle pagine attività con una SPA | Media | Medio | Il server inietta title, meta e Open Graph per `/b/{slug}` nell'`index.html` (Q4) |
| R8 | Limite di 100 email al giorno di Resend | Bassa (MVP) | Medio | Monitorare l'uso; Resend Pro quando serve |
| R9 | Complessità di Docker e CI per un livello junior in DevOps | Media | Basso | Ogni step DevOps spiegato e documentato nel README |

## 28. ASSUMPTIONS

```text
ASSUNZIONE A1
Sto assumendo: account cliente globali (uno per persona, valido su tutti i tenant).
Motivazione: il cliente non si registra di nuovo per ogni attività; meno duplicati.

ASSUNZIONE A2
Sto assumendo: un appuntamento = un servizio con un operatore (niente pacchetti multi-servizio nell'MVP).
Motivazione: semplifica il calcolo degli slot; i pacchetti si aggiungono dopo.

ASSUNZIONE A3
Sto assumendo: intervallo slot di default 15 minuti, configurabile per tenant.
Motivazione: standard per barbieri ed estetiste.

ASSUNZIONE A4
Sto assumendo: finestra di disdetta di default 12 ore, configurabile per tenant.
Motivazione: compromesso tipico del settore.

ASSUNZIONE A5
Sto assumendo: appuntamenti anonimizzati dopo 24 mesi.
Motivazione: minimizzazione GDPR; da validare con un professionista.

ASSUNZIONE A6
Sto assumendo: niente dark mode nell'MVP.
Motivazione: costo di design e test doppio; i token CSS la rendono aggiungibile dopo.

ASSUNZIONE A7
Sto assumendo: nessun analytics nell'MVP.
Motivazione: niente cookie banner e meno trattamenti da dichiarare.

ASSUNZIONE A9
Sto assumendo: logo del tenant salvato su Postgres (bytea, massimo 200 KB, solo PNG/WebP, niente SVG per il rischio XSS) e servito con cache HTTP.
Motivazione: il disco di Render free è effimero; evita di aggiungere un object storage per un solo file per tenant.

ASSUNZIONE A8
Sto assumendo: il nome "Bookly" è provvisorio.
Motivazione: è solo il nome del repo; il brand si decide con le direzioni visuali.
```

## 29. OPEN QUESTIONS

| ID | Domanda | Chi | Blocca |
|---|---|---|---|
| Q1 | Il repo `BaschieriMax/bookly` è creato? Va collegato a questa sessione | Massimo | Step 0 |
| Q2 | Dominio: Massimo lo compra in Fase 4 (serve a Resend per inviare email reali) | Massimo | Step 15 |
| Q4 | Iniezione server-side dei meta tag per la SEO delle pagine attività: la vuoi nell'MVP? | Massimo | Step 7 |
| Q5 | shadcn/ui per il solo DatePicker/Calendar del wizard: ok? | Massimo | Step 7 |

## 30. DECISION LOG

Vedi [`decision-log.md`](./decision-log.md).

## 31. TECHNICAL DEBT

Vedi [`tech-debt.md`](./tech-debt.md).

---

**Manutenzione (Fase 5)**: Dependabot settimanale, revisione mensile del tech debt e dei free tier, backup tramite i branch Neon prima delle migrazioni, monitoraggio di Sentry e dei log di Render.
