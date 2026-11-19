# Rilascio in produzione — Bookly

Runbook di messa in produzione e di esercizio (DEC-032). Servizi: **Neon** (database), **Resend**
(email), **Render** (app), **GitHub Actions** (migrazioni, deploy, promemoria). Tutti a costo zero.

Segui le sezioni **nell'ordine**: lo schema del database deve esistere prima del primo avvio
dell'app su Render.

## Come funziona il rilascio

```text
push su main ──► CI (web, api, e2e, image, codeql) ──► verde?
                                                        │
                                       Deploy (deploy.yml, environment "production")
                                       1. migration bundle EF Core → Neon (ruolo owner)
                                       2. deploy hook Render con ?ref=<commit>
                                       3. attende /api/version == commit (max 20 min)
                                       4. smoke: readiness, /api/auth/me 204, CSP, HSTS, HTML
```

- Render **non** fa deploy da solo a ogni push (`autoDeployTrigger: off` in `render.yaml`): lo
  avvia il workflow solo dopo CI verde e migrazioni applicate.
- Le migrazioni non partono all'avvio dell'app. Per qualche minuto la versione precedente gira sul
  nuovo schema: ogni migrazione deve essere **retrocompatibile** (expand → contract, vedi sotto).
- L'app usa a runtime un ruolo Postgres **senza permessi DDL** (`bookly_app`): può leggere e
  scrivere dati ma non creare o eliminare tabelle. Le migrazioni usano il ruolo owner.

## Limiti dei piani gratuiti da tenere a mente

| Servizio | Limite | Effetto su Bookly |
|---|---|---|
| Render free | 750 ore/mese di istanza, pausa dopo 15 min senza traffico, 512 MB RAM, 500 minuti di build/mese | Il cron dei promemoria chiama l'app ogni 15 minuti, quindi resta quasi sempre sveglia (~744 ore in un mese da 31 giorni): **un solo servizio free** per account. Ogni deploy costa 5-8 minuti di build |
| Neon free | 100 CU-ore/mese, 1 GB, scale-to-zero dopo 5 min fisso, restore istantaneo entro 6 ore | Con compute fisso a 0,25 CU e i promemoria ogni 15 minuti si stimano 60-80 CU-ore/mese. Il restore copre solo le ultime 6 ore |
| Resend free | 3.000 email/mese, 100/giorno, 1 dominio | Senza dominio verificato invia **solo** all'email dell'account Resend. Render free blocca le porte SMTP standard: si usa la **2465** |

Verifica i limiti attuali sui siti dei provider prima di andare live con clienti veri.

## 1. Neon — database

1. Registrati su <https://neon.com> (va bene l'accesso con GitHub).
2. **New project**: nome `bookly`, Postgres **17**, regione **AWS Europe Central 1 (Frankfurt)**
   (la stessa di Render: latenza minima).
3. **Compute**: nelle impostazioni del compute del branch `production`/`main` imposta dimensione
   minima e massima a **0,25 CU**. Con l'autoscaling fino a 2 CU le CU-ore gratuite finiscono
   prima.
4. Apri **SQL Editor** (database `neondb`) ed esegui, sostituendo la password: deve avere almeno
   12 caratteri con maiuscole, minuscole, numeri e un simbolo. Usa solo lettere, numeri, `-` e `_`,
   così non serve quotarla nella connection string. Generala con un password manager e salvala lì.

   ```sql
   -- Runtime role for the app: data only, no DDL (DEC-032)
   CREATE ROLE bookly_app WITH LOGIN PASSWORD '<PASSWORD_APP>';
   GRANT CONNECT ON DATABASE neondb TO bookly_app;
   GRANT USAGE ON SCHEMA public TO bookly_app;

   -- Every schema, table and sequence the migrations will create gets the grants automatically
   ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner GRANT USAGE ON SCHEMAS TO bookly_app;
   ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO bookly_app;
   ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner GRANT USAGE, SELECT ON SEQUENCES TO bookly_app;
   ```

   Se il ruolo owner del progetto non si chiama `neondb_owner`, usa il nome che vedi in
   **Roles**. Questo passaggio va fatto **prima** delle migrazioni.
5. In **Connect** (dashboard del progetto) disattiva **Connection pooling** e copia host,
   database e utente owner (menu **Role**: `neondb_owner`). Le connection string vanno in formato
   Npgsql, non in formato URL `postgresql://` (`sslmode=require` → `SSL Mode=VerifyFull`, più
   severo; `channel_binding=require` → `Channel Binding=Require`):

   | Uso | Dove va | Valore |
   |---|---|---|
   | Migrazioni (owner) | GitHub, secret `DATABASE_MIGRATION_CONNECTION` | `Host=<ep-xxx>.eu-central-1.aws.neon.tech;Database=neondb;Username=neondb_owner;Password=<PASSWORD_OWNER>;SSL Mode=VerifyFull;Channel Binding=Require` |
   | App (runtime) | Render, `ConnectionStrings__Default` | `Host=<ep-xxx>.eu-central-1.aws.neon.tech;Database=neondb;Username=bookly_app;Password=<PASSWORD_APP>;SSL Mode=VerifyFull;Channel Binding=Require;Maximum Pool Size=20;Connection Idle Lifetime=60` |

   - Endpoint **diretto** (senza `-pooler` nell'host): una sola istanza dell'app non ha bisogno del
     pooler di Neon, e le migrazioni non devono passarci.
   - `Connection Idle Lifetime=60` chiude le connessioni inattive dopo un minuto, così Neon può
     andare in pausa e consumare meno CU-ore. Se una connessione cade durante la pausa, la retry
     di EF Core la riapre.

## 2. GitHub — environment e primo schema

1. Repo → **Settings → Environments → New environment** → nome `production`.
   - Facoltativo ma consigliato: **Deployment branches and tags → Selected branches → `main`**.
2. Nell'environment `production` aggiungi il secret **`DATABASE_MIGRATION_CONNECTION`** (riga
   "Migrazioni" della tabella sopra).
3. **Actions → Deploy → Run workflow** (branch `main`). Senza i dati di Render il workflow applica
   solo le migrazioni e lo segnala con una notice. Deve finire in verde.
4. Controllo facoltativo in Neon → **Tables**: devono esserci le tabelle (`Tenants`,
   `Appointments`, …) e lo schema `ui`.

## 3. Resend — email

1. Registrati su <https://resend.com> con **la stessa email che userai come super-admin**: finché
   non verifichi un dominio, Resend consegna solo a quell'indirizzo.
2. **API Keys → Create API key**: permesso **Sending access**. Copiala subito (si vede una volta
   sola): sarà `Email__Password` su Render.
3. Mittente provvisorio, senza dominio: `Bookly <onboarding@resend.dev>`. Col dominio vedi la
   sezione 7.

## 4. Render — servizio web

1. Registrati su <https://render.com> con GitHub e autorizza l'accesso al repo `bookly`.
2. **New → Blueprint** → scegli `BaschieriMax/bookly`, branch `main`. Render legge `render.yaml`
   e propone il servizio `bookly` (Docker, free, Frankfurt).
3. Compila le variabili richieste:

   | Variabile | Valore |
   |---|---|
   | `ConnectionStrings__Default` | riga "App (runtime)" della tabella Neon |
   | `App__PublicBaseUrl` | `https://bookly.onrender.com`. Se Render assegna un altro indirizzo (es. `bookly-ab12.onrender.com`), correggila dopo la creazione |
   | `Email__Password` | API key di Resend |
   | `Email__From` | `Bookly <onboarding@resend.dev>` |
   | `Platform__SuperAdminEmails__0` | la tua email (la stessa dell'account Resend) |

   Le altre (`ASPNETCORE_ENVIRONMENT`, `ReverseProxy__Enabled=true`, SMTP Resend, `Jobs__Secret`
   generato, …) le imposta il Blueprint.
4. **Apply**: Render crea il servizio e fa il primo deploy (build Docker di 5-8 minuti). Alla fine
   apri `https://<servizio>.onrender.com/api/health/ready`: deve rispondere `Healthy`.
5. Se l'URL reale è diverso da quello inserito: **Environment** → modifica `App__PublicBaseUrl`
   → **Save, rebuild, and deploy**. Serve per i link nelle email.

## 5. GitHub — collegamento a Render

1. Render → servizio `bookly` → **Settings → Deploy Hook** → copia l'URL.
   È un segreto: chiunque lo abbia può avviare deploy.
2. GitHub, environment `production` → secret **`RENDER_DEPLOY_HOOK_URL`** = l'URL copiato.
3. GitHub → **Settings → Secrets and variables → Actions**:
   - tab **Variables** → **`BOOKLY_BASE_URL`** = `https://<servizio>.onrender.com` (senza `/` finale);
   - tab **Secrets** → **`BOOKLY_JOB_SECRET`** = valore di `Jobs__Secret` (Render → Environment,
     icona dell'occhio). Lo usano i workflow dei promemoria e della retention.
4. **Actions → Deploy → Run workflow**: ora fa migrazioni (nessuna da applicare), deploy, attesa
   della versione e smoke test. Deve finire in verde.
5. **Actions → Reminders → Run workflow**: deve rispondere con un JSON e finire in verde.

Da qui in poi ogni merge su `main` con CI verde va in produzione da solo.

## 6. Primo super-admin e collaudo in produzione

1. Apri `https://<servizio>.onrender.com/registrati` e registrati con l'email di
   `Platform__SuperAdminEmails__0`.
2. Conferma l'email dal link ricevuto (mittente `onboarding@resend.dev`; controlla lo spam).
3. Render → **Manual Deploy → Restart service**: all'avvio l'account confermato riceve il ruolo
   SuperAdmin.
4. Accedi: dopo il login arrivi in **Piattaforma**. Collaudo minimo. Senza dominio Resend
   consegna **solo** all'indirizzo esatto dell'account (gli alias `+qualcosa` vengono rifiutati),
   quindi fai tutto con il tuo account:
   - [ ] crea un'attività di prova in `/platform/tenant` e aggiungi **te stesso** come titolare
     (account già esistente: ricevi l'email "sei stato aggiunto" e la voce **Gestione attività**);
   - [ ] configura servizio, operatore e orari;
   - [ ] prenota da `/b/<slug>` con lo stesso account e verifica l'email di conferma;
   - [ ] sposta e annulla dal calendario admin;
   - [ ] esporta i dati da `/account/profilo`.
5. Prima di clienti veri: testi legali validati da un professionista (**TD-005**).

## 7. Dominio (quando lo acquisti)

L'app funziona già su `onrender.com`; il dominio serve per l'immagine e per inviare email a
chiunque. Scegli nome e registrar: qualsiasi registrar va bene se il pannello DNS permette record
CNAME, TXT e MX (e A o ALIAS per il dominio principale).

**Sito su Render**
1. Render → servizio → **Settings → Custom Domains → Add**: aggiungi `tuodominio.it` e
   `www.tuodominio.it`.
2. Crea nel DNS del registrar i record che Render mostra (CNAME per `www`, A o ALIAS per il
   dominio principale). Render emette il certificato TLS da solo quando i record sono attivi.
3. Aggiorna `App__PublicBaseUrl` (Render) e `BOOKLY_BASE_URL` (GitHub) al nuovo indirizzo.

**Email con Resend**
1. Resend → **Domains → Add domain** → `tuodominio.it`, regione EU se proposta.
2. Crea nel DNS i record che Resend mostra (SPF e DKIM; di solito MX e TXT su un sottodominio
   `send` e un TXT `resend._domainkey`), poi **Verify**.
3. Aggiungi un record DMARC: TXT su `_dmarc` con valore `v=DMARC1; p=none;` (poi `quarantine`
   quando i report sono puliti).
4. Su Render: `Email__From` = `Bookly <no-reply@tuodominio.it>`.

Gli header HSTS includono i sottodomini: tutti i sottodomini web del dominio dovranno usare HTTPS.

## 8. Esercizio

### Rollback del codice
Render → **Events/Deploys** → deploy precedente riuscito → **Rollback**. È immediato (riusa
l'immagine). Il workflow successivo su `main` riporterà la versione nuova: correggi prima il bug.

### Rollback del database
- Neon free permette il **restore** del branch a un istante delle **ultime 6 ore**: Console →
  **Branches → Restore**.
- Prima di una migrazione **distruttiva** (drop di colonne o tabelle, cambi di tipo) crea un branch
  di backup: Console → **Branches → New branch** da quello di produzione, nome
  `backup-<data>`. Cancellalo dopo aver verificato il rilascio (il piano free ha un numero
  limitato di branch).

### Regola expand → contract per le migrazioni
Durante il deploy la versione precedente gira sul nuovo schema. Quindi:
1. **expand**: aggiungi colonne nullable o con default, tabelle e indici nuovi; il codice nuovo
   scrive in entrambi i formati se serve;
2. rilascia;
3. **contract**: in un rilascio successivo rimuovi ciò che non si usa più (con backup Neon prima).

Mai rinominare o eliminare una colonna nello stesso rilascio che smette di usarla.

### Ruotare un segreto
| Segreto | Dove cambiarlo |
|---|---|
| Password `bookly_app` | Neon SQL: `ALTER ROLE bookly_app WITH PASSWORD '…';` → Render `ConnectionStrings__Default` |
| Password owner | Neon → Roles → Reset password → GitHub `DATABASE_MIGRATION_CONNECTION` |
| API key Resend | Resend → nuova key → Render `Email__Password` → revoca la vecchia |
| `Jobs__Secret` | Render (nuovo valore ≥ 32 caratteri) e GitHub `BOOKLY_JOB_SECRET` insieme |
| Deploy hook | Render → Settings → Regenerate → GitHub `RENDER_DEPLOY_HOOK_URL` |

### Error tracking (facoltativo, DEC-031)
Crea un progetto su Sentry (regione EU) e imposta su Render `Sentry__Dsn`, `Sentry__Environment=production`,
`Security__ExtraConnectSources__0=https://o<id>.ingest.de.sentry.io` e, per il frontend,
`VITE_SENTRY_DSN`: Render passa le variabili d'ambiente al build Docker come build arg, serve un
rebuild.

## 9. Problemi frequenti

| Sintomo | Causa probabile | Soluzione |
|---|---|---|
| Smoke: `/api/auth/me returned 500` | `ReverseProxy__Enabled` assente o `false` | Ripristinalo a `true` (è nel Blueprint) |
| L'app non parte, log con `OptionsValidationException` | Variabile mancante (`Email__From`, `App__PublicBaseUrl`) o `Jobs__Secret` sotto 32 caratteri | Correggi la variabile su Render |
| Readiness 503 | Connection string errata o Neon non raggiungibile | Verifica host, utente, password e `SSL Mode=VerifyFull` |
| Migrazioni: `permission denied` | Secret con l'utente `bookly_app` invece dell'owner | `DATABASE_MIGRATION_CONNECTION` usa l'owner |
| App: `42501 permission denied for table/schema` | Default privileges mancanti (SQL eseguito dopo le migrazioni o con un altro ruolo) | Riesegui il blocco SQL della sezione 1 e in più: `GRANT USAGE ON SCHEMA ui TO bookly_app; GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public, ui TO bookly_app; GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public, ui TO bookly_app;` |
| Deploy: versione non live dopo 20 minuti | Build fallita o minuti di build finiti | Log del deploy su Render |
| Email non arrivano | Dominio non verificato: Resend consegna solo all'email dell'account | Usa quell'indirizzo o verifica il dominio (sezione 7) |
| Email non partono, nei log timeout verso `smtp.resend.com` | Render free blocca le porte SMTP 25, 465 e 587 | `Email__Port=2465` (TLS implicito, già nel Blueprint) |
| Prima pagina lenta (30-60 s) | Istanza Render in pausa | Normale sul piano free (TD-001); il cron dei promemoria la tiene sveglia |
