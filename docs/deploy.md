# Rilascio in produzione — Bookly

Runbook di messa in produzione e di esercizio (DEC-032). Servizi: **Neon** (database), **Resend**
(email), **Render** (app), **GitHub Actions** (migrazioni e deploy), **cron-job.org** (promemoria e
retention). Tutti a costo zero.

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
| Render free | 750 ore/mese di istanza, pausa dopo 15 min senza traffico, 512 MB RAM, 500 minuti di build/mese | cron-job.org chiama l'app ogni 15 minuti dalle 7 alle 22, quindi di giorno resta sveglia e di notte va in pausa (~470 ore al mese). Ogni deploy costa 5-8 minuti di build |
| Neon free | 100 CU-ore/mese, 1 GB, scale-to-zero dopo 5 min fisso, restore istantaneo entro 6 ore | Con compute fisso a 0,25 CU e i promemoria ogni 15 minuti solo di giorno si stimano 40-60 CU-ore/mese. Il restore copre solo le ultime 6 ore: per il resto ci sono i backup notturni (30 giorni) |
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
   sezione 8.

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
6. **Backup notturno** (DEC-036): nell'environment `production` aggiungi il secret
   **`BACKUP_PASSPHRASE`**, una frase di almeno 24 caratteri generata dal password manager e salvata
   **anche lì**: senza di lei i backup non si possono aprire. Poi **Actions → Backup → Run
   workflow**: deve finire in verde con il riepilogo del test di ripristino.

Da qui in poi ogni merge su `main` con CI verde va in produzione da solo.

## 6. cron-job.org — promemoria e retention

Il cron di GitHub Actions è irregolare (nelle prime 18 ore è partito 2 volte invece di ~70, TD-002):
la pianificazione la fa **cron-job.org**, gratuito, che chiama gli stessi endpoint. I workflow
`Reminders` e `Retention` di GitHub restano come riserva e per l'avvio manuale: gli endpoint sono
idempotenti, quindi due chiamate ravvicinate non mandano email doppie.

1. Registrati su <https://cron-job.org> e conferma l'email. In **Settings** attiva la verifica in due
   passaggi: l'account conterrà il segreto dei job.
2. **Cronjobs → Create cronjob**, scheda **Common**:
   - Title: `Bookly promemoria`
   - URL: `https://<servizio>.onrender.com/api/jobs/send-reminders`
   - Execution schedule: **Custom** — minuti `0, 15, 30, 45`, ore **dalle 7 alle 21**, tutti i giorni
     (DEC-035: ultima chiamata alle 21:45, di notte nessuna)
3. Scheda **Advanced**:
   - Request method: **POST**
   - Headers → **Add**: Key `X-Job-Secret`, Value = `Jobs__Secret` di Render (lo stesso di
     `BOOKLY_JOB_SECRET` su GitHub)
   - Time zone: `Europe/Rome`
4. Scheda **Notifications**: attiva l'avviso per esecuzione fallita (dopo 2-3 fallimenti di fila)
   e per il ritorno alla normalità.
5. **Test run**: deve rispondere **200** con un JSON tipo `{"sent":0,"failed":0}`. **404** = segreto
   non configurato su Render; **401** = header o valore sbagliato. Poi **Create**.
6. Ripeti per la retention: Title `Bookly retention`, URL `…/api/jobs/apply-retention`, POST, stesso
   header, schedule **Every day** alle **07:20**: i promemoria hanno già svegliato l'app.

**Perché questi orari (DEC-035).** Il promemoria non ha un orario suo: ogni chiamata invia quelli
degli appuntamenti che iniziano entro 24 ore, quindi ogni 15 minuti significa un promemoria tra 24 ore e
23 ore e 45 minuti prima. Gli appuntamenti sono in orario di negozio e lo sono anche i loro
promemoria: di notte le chiamate non servirebbero, sveglierebbero solo Neon (CU-ore) e Render (ore
d'istanza). Un appuntamento che inizia dopo le 21:45 riceve il promemoria alle 7:00 del giorno prima.

Alla prima chiamata del mattino l'app può essere in pausa (TD-001) e superare il timeout di 30 secondi
di cron-job.org: la richiesta la sveglia comunque e quella dopo riesce. Fallimenti isolati alle 7:00
sono normali, più di tre di fila no (vedi problemi frequenti).

**Avvisi di sospensione (DEC-039, facoltativo).** Quando il super-admin sospende un'attività e
annulla gli appuntamenti futuri, le email partono subito dall'app. Questo endpoint serve solo a
riprenderle dopo il limite giornaliero (80 al giorno) o un errore del server di posta, se nel
frattempo Render è andato in pausa. Il workflow GitHub `Suspension notices` lo chiama già tre volte al
giorno. Per avere più puntualità aggiungi un cronjob: Title `Bookly avvisi sospensione`, URL
`…/api/jobs/send-suspension-notices`, POST, stesso header, schedule **Every day** alle **07:25**. Ogni
chiamata invia per al massimo 20 secondi e lascia il resto all'app, quindi resta sotto il timeout.
Risposta attesa: `{"sent":0,"failed":0,"skipped":0,"dailyLimitReached":false}`.

## 7. Primo super-admin e collaudo in produzione

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

## 8. Dominio (quando lo acquisti)

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

## 9. Esercizio

### Rollback del codice
Render → **Events/Deploys** → deploy precedente riuscito → **Rollback**. È immediato (riusa
l'immagine). Il workflow successivo su `main` riporterà la versione nuova: correggi prima il bug.

### Rollback del database
- Neon free permette il **restore** del branch a un istante delle **ultime 6 ore**: Console →
  **Branches → Restore**.
- Oltre le 6 ore servono i **backup notturni** (sotto).
- Prima di una migrazione **distruttiva** (drop di colonne o tabelle, cambi di tipo) crea un branch
  di backup: Console → **Branches → New branch** da quello di produzione, nome
  `backup-<data>`. Cancellalo dopo aver verificato il rilascio (il piano free ha un numero
  limitato di branch).

### Backup notturni (DEC-036)

Ogni notte il workflow **Backup** salva il database con `pg_dump`, lo **ripristina in un PostgreSQL
di prova** (un backup che non si ripristina fa fallire il workflow), lo cifra con AES-256 e lo tiene
**30 giorni** tra gli artifact di GitHub. Il riepilogo di ogni esecuzione mostra quante attività,
appuntamenti e utenti contiene.

- Il repo è pubblico e i suoi artifact li scarica qualsiasi utente GitHub: per questo il file è
  cifrato, e la `BACKUP_PASSPHRASE` non va mai scritta altrove che nel password manager.
- Il cron di GitHub può partire in ritardo o saltare una notte (TD-002): controlla ogni tanto che in
  **Actions → Backup** ci siano esecuzioni recenti, o lancialo a mano prima di operazioni rischiose.

**Ripristinare un backup**

1. **Actions → Backup** → l'esecuzione del giorno voluto → **Artifacts** → scarica lo zip ed
   estrai `bookly-db-<data>.dump.gpg`.
2. Decifra (GnuPG; su Windows Gpg4win) e inserisci la passphrase quando la chiede:

   ```bash
   gpg --output bookly.dump --decrypt bookly-db-<data>.dump.gpg
   ```

3. **Prima su un branch di prova**: Neon → **Branches → New branch**, poi copia la sua connection
   string (formato URL `postgresql://…`) e ripristina con PostgreSQL 17:

   ```bash
   pg_restore --clean --if-exists --no-owner --dbname "<URL del branch>" bookly.dump
   ```

   Controlla i dati dal SQL Editor del branch.
4. Se è tutto giusto, ripeti il comando sul branch di produzione, oppure fai di quel branch la
   produzione (Neon: **Set as default**) e aggiorna le connection string su Render e GitHub.
5. Se dopo il ripristino l'app dà errori `42501 permission denied`, riassegna i permessi a
   `bookly_app` con il blocco SQL della sezione 10.

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
| `Jobs__Secret` | Render (nuovo valore ≥ 32 caratteri), GitHub `BOOKLY_JOB_SECRET` e l'header dei due job di cron-job.org, insieme |
| Deploy hook | Render → Settings → Regenerate → GitHub `RENDER_DEPLOY_HOOK_URL` |
| `BACKUP_PASSPHRASE` | Nuova frase nel password manager e su GitHub. I backup già fatti restano cifrati con la vecchia: conservala finché non scadono (30 giorni) |

### Error tracking (facoltativo, DEC-031)
Crea un progetto su Sentry (regione EU) e imposta su Render `Sentry__Dsn`, `Sentry__Environment=production`,
`Security__ExtraConnectSources__0=https://o<id>.ingest.de.sentry.io` e, per il frontend,
`VITE_SENTRY_DSN`: Render passa le variabili d'ambiente al build Docker come build arg, serve un
rebuild.

## 10. Problemi frequenti

| Sintomo | Causa probabile | Soluzione |
|---|---|---|
| Smoke: `/api/auth/me returned 500` | `ReverseProxy__Enabled` assente o `false` | Ripristinalo a `true` (è nel Blueprint) |
| L'app non parte, log con `OptionsValidationException` | Variabile mancante (`Email__From`, `App__PublicBaseUrl`) o `Jobs__Secret` sotto 32 caratteri | Correggi la variabile su Render |
| Readiness 503 | Connection string errata o Neon non raggiungibile | Verifica host, utente, password e `SSL Mode=VerifyFull` |
| Migrazioni: `permission denied` | Secret con l'utente `bookly_app` invece dell'owner | `DATABASE_MIGRATION_CONNECTION` usa l'owner |
| App: `42501 permission denied for table/schema` | Default privileges mancanti (SQL eseguito dopo le migrazioni o con un altro ruolo) | Riesegui il blocco SQL della sezione 1 e in più: `GRANT USAGE ON SCHEMA ui TO bookly_app; GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public, ui TO bookly_app; GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public, ui TO bookly_app;` |
| Deploy: versione non live dopo 20 minuti | Build fallita o minuti di build finiti | Log del deploy su Render |
| cron-job.org: fallimenti di fila | 401: segreto diverso da `Jobs__Secret`; 404: segreto non impostato su Render; timeout: app in avvio | Correggi l'header o la variabile su Render; i timeout isolati si risolvono alla chiamata dopo |
| Email non arrivano | Dominio non verificato: Resend consegna solo all'email dell'account | Usa quell'indirizzo o verifica il dominio (sezione 8) |
| Email non partono, nei log timeout verso `smtp.resend.com` | Render free blocca le porte SMTP 25, 465 e 587 | `Email__Port=2465` (TLS implicito, già nel Blueprint) |
| Prima pagina lenta (30-60 s) | Istanza Render in pausa | Normale sul piano free (TD-001): di giorno il cron dei promemoria la tiene sveglia, di notte no. Se succede di giorno, controlla che i job di cron-job.org siano attivi e verdi |
