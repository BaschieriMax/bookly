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
