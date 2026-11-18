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
Possibili ritardi di alcuni minuti; dipendenza da GitHub per una funzione di prodotto.

Soluzione futura:
Con un'istanza sempre attiva, spostare la logica in un BackgroundService con PeriodicTimer
(la logica del service resta la stessa, cambia solo il trigger).

Priorità:
Bassa
```

## Revisione

Il log si rivede a ogni release e nella manutenzione mensile. Un debito con priorità `Alta` non può restare aperto alla release senza una decisione esplicita di Massimo registrata nel Decision Log.
