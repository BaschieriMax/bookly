# Bookly — Report di collaudo (Step 14)

Data: 19 novembre 2026 · Branch: `qa/collaudo` · Riferimenti: `docs/project-overview.md`, skill
full-stack-project-architect (Fase 3, Production Readiness).

Ambienti usati:

- **Stack locale realistico**: API in Release che serve la build di produzione della SPA, Postgres
  17 con i dati demo, server SMTP locale per leggere le email. Database ricreato da zero.
- **Build Production** (`dotnet publish` come nel Dockerfile, `ASPNETCORE_ENVIRONMENT=Production`,
  proxy simulato con `X-Forwarded-Proto: https`).
- **CI**: job Web, API, E2E (Chromium mobile e desktop, Firefox, WebKit su profilo iPhone),
  immagine Docker con smoke test, CodeQL.

## 1. Esito per requisito (overview §4–§6)

| Requisito | Esito | Come è stato verificato |
|---|---|---|
| J1 Prenotazione (servizio → operatore → giorno → slot → conferma) | ✅ | E2E Playwright su 4 browser; prova manuale da ospite |
| J1.4 Login a metà wizard con selezione conservata | ✅ | Prova manuale: dopo il login la conferma mostra servizio, operatore e orario scelti; prenotazione riuscita |
| J1.5 Email di conferma con link di gestione | ✅ | Email letta dal server SMTP locale |
| J1.6 Promemoria 24 h, una sola volta | ✅ | Integration test (concorrenza, retry), prova dal vivo (Step 11) |
| J2 Disdetta entro la finestra, telefono oltre | ✅ | E2E (disdetta), integration test (422 oltre la finestra) |
| J3 Calendario giorno/settimana, sposta, annulla, no-show, email al cliente | ✅ | Integration test, E2E del calendario, prova dal vivo (Step 9) |
| J4 Servizi, staff, orari a più fasce, assenze | ✅ | Integration test, unit test UI, axe sulle pagine |
| J5 Onboarding super-admin con invito del titolare | ✅ | Integration test, prova dal vivo con email (Step 10) |
| Multi-tenancy, isolamento, sospensione | ✅ | Integration test 404/403 per ogni endpoint admin e cliente |
| Account: conferma email, login, logout, reset password | ✅ | Integration test; conferma da link verificata dal vivo |
| Brand per tenant con controllo del contrasto | ✅ | Unit test, prova dal vivo (Step 8) |
| Area cliente: storico, profilo, export, cancellazione | ✅ | Integration test, prova dal vivo (Step 12) |
| Pagine legali | ⚠️ | Presenti ma **bozze** (TD-005, da chiudere prima della release) |

## 2. Checklist di collaudo (Fase 3)

| Area | Esito | Note |
|---|---|---|
| UI: stati loading/empty/error/success | ✅ | Errore di rete ora con messaggio dedicato e pulsante **Riprova** (F2) |
| Responsive 320/390/768/1024/1366 | ✅ | Nessuno scroll orizzontale dopo la correzione della pagina Brand (F3) |
| Accessibilità | ✅ | axe **WCAG 2.2 AA** su tutte le pagine principali, 0 violazioni serie o critiche; focus visibile; ordine di tabulazione corretto nel wizard; link isolati ≥ 44 px (F5) |
| Performance | ✅ | Pagina attività su 4G lento (1,6 Mbps, 150 ms, CPU 4×): **LCP 2,4 s, CLS 0,05**, 279 KB trasferiti. Su 4G normale LCP 1,4 s. Il bundle admin non viene scaricato dal flusso pubblico |
| API | ✅ | Con ~10.000 appuntamenti: disponibilità p50 7 ms, giorni del mese 9 ms, calendario settimana 12 ms, 6 settimane 27 ms (p95 45 ms) |
| Database | ✅ | Migrazioni applicate da zero; indici su tutte le query principali; vincolo anti-sovrapposizione |
| Autenticazione | ✅ | Login, logout, lockout dopo 5 tentativi, cookie HttpOnly/Secure/SameSite, revoca con security stamp |
| Autorizzazione | ✅ | Accessi negati testati per Customer, Staff, Owner di altro tenant, SuperAdmin |
| Error handling | ✅ | ProblemDetails con `code`; 401/403/404/409/422/429 coperti dai test; pagina errore con segnalazione a Sentry |
| Sicurezza | ✅ | Vedi §3 |
| Test automatici | ✅ | API 90 integration + 14 unit; Web 77; E2E 14 scenari × 4 browser |
| Compatibilità browser | ✅ | Chromium (mobile e desktop), Firefox, WebKit/Safari su iPhone in CI. Edge = Chromium |
| Configurazione | ✅ | Opzioni validate all'avvio; `.env.example` completo; nessun segreto nel repository |
| Build di produzione | ✅ | Immagine Docker con smoke test; asset Brotli, cache immutabile, niente source map |
| Privacy/legale | ⚠️ | Funzioni GDPR complete; testi legali da validare (TD-005) |

## 3. Security review

| Controllo | Esito |
|---|---|
| Autenticazione e autorizzazione | ✅ policy per ruolo e tenant, 404 tra tenant |
| XSS | ✅ nessun `dangerouslySetInnerHTML`; meta tag codificati; CSP senza script inline né eval |
| CSRF | ✅ antiforgery su tutte le richieste che modificano dati; cookie SameSite=Strict |
| Injection | ✅ solo EF Core parametrizzato, nessun SQL concatenato |
| CORS | ✅ non abilitato: stessa origine (DEC-010) |
| HTTPS e header | ✅ HSTS 1 anno, CSP, nosniff, frame DENY, Referrer/Permissions-Policy, COOP/CORP |
| Segreti | ✅ fuori dal repository; solo valori di sviluppo locali e del database usa e getta della CI |
| Password | ✅ hashing Identity (PBKDF2), minimo 10 caratteri |
| Token | ✅ conferma email 48 h, invito 7 giorni, reset Identity; invalidati dal security stamp |
| Rate limiting | ✅ login, registrazione, reset, prenotazioni, pagine pubbliche, eliminazione account, export, job |
| Dati sensibili nelle risposte | ✅ nessun hash, stamp o token nei DTO; contatti dei clienti eliminati nascosti |
| Logging | ✅ niente password, token o dati personali (corretto nello Step 13) |
| Dipendenze | ✅ `npm audit` 0 vulnerabilità (anche dev: TD-003 chiuso); NuGet senza pacchetti vulnerabili |
| Enumerazione utenti | ✅ registrazione e reset rispondono allo stesso modo se l'email esiste |
| Secondo fattore | ⚠️ assente per SuperAdmin e Owner (nuovo TD-007) |

## 4. Problemi trovati e corretti in questo step

| ID | Problema | Correzione |
|---|---|---|
| F1 | Gli asset con hash di Vite erano serviti con `no-cache` (MapStaticAssets non riconosce gli hash di Vite): ogni visita li rivalidava | `Cache-Control: public, max-age=31536000, immutable` su `/assets/*`, `no-cache` sull'HTML; controllato da E2E e smoke test Docker |
| F2 | Con API irraggiungibile la pagina attività e l'admin mostravano solo "Qualcosa è andato storto" senza via d'uscita | Messaggio "Connessione assente…" e pulsante **Riprova** (pagina attività e tutte le pagine admin) |
| F3 | Pagina Brand a 320 px: 5 px di scroll orizzontale (i `fieldset` hanno larghezza minima intrinseca) | `min-w-0` sui fieldset |
| F4 | In Production senza `ReverseProxy__Enabled=true`, dietro il proxy HTTPS, `/api/auth/me` risponde 500 (cookie Secure su richiesta vista come HTTP) | Warning all'avvio, sezione "impostazioni obbligatorie" nel README; da includere nella checklist di deploy (Step 15) |
| F5 | Link isolati sotto i 24 px di altezza (WCAG 2.5.8): "Password dimenticata?", telefono e link legali della pagina attività, link pubblico nella pagina Attività | Area cliccabile di 44 px |

## 5. Non verificato o fuori dal nostro controllo

- **Safari reale su iPhone**: coperto con WebKit in CI, non su un dispositivo fisico. Consigliato
  un giro manuale sul tuo iPhone dopo il deploy.
- **Cold start di Render free** (30–60 s dopo 15 minuti di inattività, TD-001): il cron dei
  promemoria ogni 15 minuti tiene il servizio sveglio, ma va verificato in produzione.
- **Recapito email reale** (SPF/DKIM con Resend sul dominio): si verifica nello Step 15.
- **Lettore di schermo** (VoiceOver/TalkBack): verificati ruoli e nomi accessibili con axe, non
  una sessione manuale con lettore di schermo.

## 6. Production Readiness

```text
PRODUCTION READINESS
Build production:       OK — immagine Docker con smoke test, asset Brotli e cache immutabile
Test:                   OK — 104 API, 77 Web, E2E su Chromium/Firefox/WebKit
Lint:                   OK — ESLint, Prettier, TreatWarningsAsErrors
Error handling:         OK — ProblemDetails con code, Riprova sugli errori di rete, Sentry opzionale
Sicurezza:              OK con riserva — manca il secondo fattore per SuperAdmin/Owner (TD-007)
Responsive:             OK — 320–1366 px senza scroll orizzontale
Accessibilità:          OK — axe WCAG 2.2 AA senza violazioni serie; manca prova con lettore di schermo
Performance:            OK — LCP 2,4 s su 4G lento, CLS 0,05; API sotto 50 ms (p95) con 10.000 appuntamenti
Configurazione:         OK con riserva — ReverseProxy__Enabled obbligatorio in produzione (F4)
Database:               OK — migrazioni da zero, indici, vincolo anti-sovrapposizione
Autenticazione/Autorizzazione: OK
Deployment readiness:   Da completare nello Step 15 (Render, Neon, Resend, dominio, bundle delle migrazioni)
Debito tecnico aperto:  TD-001, TD-002, TD-004, TD-005 (alta, testi legali), TD-006, TD-007
Verdetto:               Pronto con riserve — la release con clienti reali richiede i testi legali
                        validati (TD-005) e la configurazione di produzione dello Step 15.
```
