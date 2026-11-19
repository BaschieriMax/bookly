# Bookly

Prenotazioni online multi-tenant per attività locali: barbieri, estetiste, piccoli negozi.
Ogni attività ha la sua pagina di prenotazione con il proprio brand. I titolari gestiscono servizi, staff, orari e calendario.

> Stato: in sviluppo (MVP). Documentazione di progetto in [`docs/`](./docs).

## Stack

| Area | Tecnologie |
|---|---|
| Frontend | React 19, Vite 8, TypeScript strict, React Router v8, TanStack Query + Axios, Tailwind CSS v4, React Hook Form + Zod, react-i18next |
| Backend | .NET 10 (LTS), ASP.NET Core (Controllers), EF Core 10, ASP.NET Core Identity (cookie) |
| Database | PostgreSQL 17 |
| Test | Vitest + React Testing Library, xUnit + Testcontainers, Playwright |
| CI/CD | GitHub Actions |
| Deploy | Container unico (API + SPA) su Render, Postgres su Neon, email con Resend |

## Struttura

```text
apps/
  api/   # ASP.NET Core 10 (Bookly.sln)
  web/   # React + Vite
docs/    # overview, decision log, technical debt
```

## Sviluppo locale

Prerequisiti: Node 22+, .NET SDK 10, Docker.

```bash
# servizi di supporto: Postgres + Mailpit
docker compose up -d

# frontend (http://localhost:5173, proxy /api → :5080)
cd apps/web
npm ci
npm run dev

# backend (http://localhost:5080) — in Development applica le migrazioni all'avvio
cd apps/api
dotnet tool restore
dotnet run --project src/Bookly.Api
```

Migrazioni EF Core (da `apps/api`):

```bash
dotnet ef migrations add <Nome> --project src/Bookly.Api --output-dir Data/Migrations
dotnet ef database update --project src/Bookly.Api
```

Test di integrazione: usano Testcontainers (serve Docker). Senza Docker si può puntare a un Postgres esistente:
`BOOKLY_TEST_POSTGRES="Host=localhost;Database=postgres;Username=...;Password=..." dotnet test` (crea e cancella un database temporaneo).

Mailpit (email in sviluppo): http://localhost:8025

In Development il backend crea dati demo (attività `barberia-demo`) con questi account,
password `bookly-demo-2026`:

| Account | Ruolo |
|---|---|
| `admin@bookly.local` | SuperAdmin della piattaforma |
| `titolare@bookly.local` | Owner di Barberia Demo |
| `staff@bookly.local` | Staff di Barberia Demo |
| `cliente@bookly.local` | Cliente |

Tipi TypeScript dell'API: la build del backend aggiorna `apps/web/openapi/bookly-api.json`,
poi `npm run gen:api` (in `apps/web`) rigenera `src/types/api.gen.ts`. La CI fallisce se non sono allineati.

## Test end-to-end (Playwright)

Girano contro lo stack reale: l'API serve la build di produzione della SPA (stessa origine, CSP
attiva) su un database con i dati demo. Controllano il flusso di prenotazione, l'accessibilità
(axe, WCAG 2.1 AA) e che non ci siano errori in console o violazioni CSP, su mobile e desktop.

```bash
cd apps/web && npm run build
mkdir -p ../api/src/Bookly.Api/wwwroot && cp -r dist/. ../api/src/Bookly.Api/wwwroot/
cd ../api/src/Bookly.Api && Auth__LoginPermitPerMinute=1000 dotnet run   # database con i dati demo
cd apps/web && npx playwright install chromium && npm run e2e
```

In CI li esegue il job `E2E` (report e tracce come artifact se falliscono).

## Primo super-admin (produzione)

1. Registrati sul sito con la tua email e confermala dal link ricevuto.
2. Imposta la variabile `Platform__SuperAdminEmails__0=<la tua email>` sul servizio e riavvialo.
3. All'avvio l'API ti assegna il ruolo SuperAdmin (solo se l'email è confermata, DEC-028). Da
   `/platform/tenant` crei le attività e inviti i titolari.

## Promemoria email

Il workflow `.github/workflows/reminders.yml` chiama ogni 15 minuti `POST /api/jobs/send-reminders`
(segreto nell'header `X-Job-Secret`). Il promemoria parte circa 24 ore prima, una sola volta, e non
viene inviato per prenotazioni fatte a meno di 12 ore dall'appuntamento. Per attivarlo:

1. genera un segreto di almeno 32 caratteri (`openssl rand -base64 48`);
2. impostalo come `Jobs__Secret` sul servizio;
3. su GitHub aggiungi il secret `BOOKLY_JOB_SECRET` (stesso valore) e la variabile
   `BOOKLY_BASE_URL`.

Senza segreto configurato l'endpoint risponde 404. Per provarlo in locale:
`curl -X POST localhost:5080/api/jobs/send-reminders -H "X-Job-Secret: <segreto>"`.

## Personalizzare stili e font

Colori, font e raggi stanno **solo** in `apps/web/src/styles/tokens.css` (variabili `--bk-*`).
Tailwind li espone come classi semantiche (`bg-primary`, `text-muted`, `font-heading`).
Per cambiare palette o font basta modificare quel file. Per aggiungere una nuova famiglia di font, importarla in `apps/web/src/styles/fonts.css`.
Vedi DEC-018 in [`docs/decision-log.md`](./docs/decision-log.md).

## Convenzioni

- Codice, nomi e commenti in inglese.
- Commit in italiano: `tipo: descrizione` (`feat`, `fix`, `docs`, `refactor`, `test`, `chore`).
- `main` protetto: si lavora su branch e si integra con pull request a CI verde.

## Protezione di `main` (da configurare una volta su GitHub)

Settings → Rules → Rulesets → **New branch ruleset**, target `main`:

- Restrict deletions e Block force pushes
- Require a pull request before merging
- Require status checks to pass: `Web (lint, typecheck, test, build)`, `API (build, test)`, `Docker image`, `Analyze (csharp)`, `Analyze (javascript-typescript)`, `Analyze (actions)`
- Require branches to be up to date before merging

Settings → Code security: attiva **Dependabot alerts**, **Dependabot security updates**, **Secret scanning** con **Push protection** e **Private vulnerability reporting**.

## Documentazione

- [Project overview](./docs/project-overview.md)
- [Decision log](./docs/decision-log.md)
- [Technical debt](./docs/tech-debt.md)
