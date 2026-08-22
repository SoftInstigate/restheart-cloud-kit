# Estendere il kit ai pagamenti

**Stato:** da fare. **Repo:** `restheart-cloud-kit` (core + 5 superfici adapter).
**Dipende da:** un servizio con il plugin `stripe` configurato — vedi "Blocco al rollout" in fondo.

## Perché

Il kit oggi copre `restheart-accounts` e basta: signup, login, verifica email, inviti, team,
password, consents. Un'applicazione che vende qualcosa esce dal kit nel punto esatto in cui il
lavoro si fa delicato — `fetch` a mano, gestione del token a mano, e soprattutto una manciata di
insidie del flusso di pagamento che non sono ovvie finché non si è già in produzione con gli
ordini bloccati.

`restheart-stripe` espone già tutto quello che serve. Manca lo strato che lo rende usabile senza
leggersi il codice del plugin.

## Cosa espone il server (verificato sul codice)

Tutti i path sono sul servizio del cliente, gli stessi a cui `apiFetch` parla già.

Modalità **subscriptions**:

| Endpoint | Auth | Note |
|---|---|---|
| `GET /stripe/plans` | **nessuna** nel servizio | `StripePlansService` non controlla l'autenticazione (solo `isGet`) — se un anonimo ci arriva lo decide l'ACL del deployment. Risponde `{default_plan, plans:[{id,name,description?,seats,limits?,prices}]}` |
| `GET /stripe/subscription` | autenticato | **non** richiede `canManageBilling`: un membro qualsiasi vede il piano del proprio team |
| `POST /stripe/checkout` | autenticato + `canManageBilling` | body `{plan, interval}` con `interval` ∈ `month`\|`year` → `201 {url}`. `400` se il piano non è acquistabile per quell'intervallo, **`409` se c'è già un abbonamento attivo** |
| `POST /stripe/portal` | autenticato + `canManageBilling` | → `{url}` |
| `GET/POST/DELETE /stripe/licenses` | autenticato + `canManageBilling` | `GET` → `{licensed:[userId], seats:{limit,licensed,available}}`; `POST`/`DELETE` body `{userId}`. `POST` risponde `201` concesso, `200` già licenziato, `404` non è un membro, **`409` nessun posto disponibile** |

Modalità **products**:

| Endpoint | Auth | Note |
|---|---|---|
| `POST /orders` | autenticato, oppure anonimo con `email` nel body se l'ACL lo consente | body `{items:[{productId,quantity}], email?}` → `{_id, checkout_url, secret}` |
| `GET /orders/{id}?secret=…` | anonimo con il secret | il documento ordine: `status` ∈ `pending_payment`\|`paid`\|`failed`\|`expired`, `line_items`, `amount_total`, `amount_refunded`, `currency` |
| `GET /{catalog-collection}` | secondo l'ACL | collection Mongo normale: `{_id, type, name, description, imageUrl, unitAmount, currency, purchasable, …}` |

## I tre fatti che devono modellare l'API

**1. Nessun rinnovo del token dopo un cambio di piano.** È il contrario dei consents, dove
`acceptConsents` *deve* chiamare `renewToken` perché il guard legge il JWT. Qui il risolutore ACL
`@subscription` (`SubscriptionVarResolver`) legge lo stato dal database a ogni richiesta, con una
cache che vive quanto l'exchange. Un upgrade è quindi effettivo **subito e senza rilogin**. Il kit
non deve toccare il token nel percorso dei pagamenti, e la documentazione deve dirlo — altrimenti
qualcuno copierà il pattern dei consents "per sicurezza" e introdurrà un rinnovo inutile a ogni
acquisto.

**2. Il redirect di ritorno arriva prima del webhook.** Dopo il Checkout, Stripe rimanda il
compratore alla `success-url`, ma lo stato in Mongo cambia solo quando arriva il webhook — una
connessione separata dai server di Stripe, di solito in pochi secondi, **senza alcun ordinamento
garantito rispetto al redirect**. Una pagina di billing che legge `GET /stripe/subscription`
appena atterra mostra quindi il piano *vecchio*, e l'utente che ha appena pagato vede scritto che
non ha pagato. Vale identico per gli ordini: `status` è ancora `pending_payment`.

Questo è il pezzo che ogni integrazione sbaglia e che giustifica da solo l'esistenza di questo
strato. Non è una `sleep`: serve un poll con condizione d'uscita, timeout e un esito
"non ancora, riprova" distinguibile da un errore.

**3. Checkout, Portal e licenze sono riservati a chi gestisce la fatturazione.** Rispondono `403`
a un membro semplice; `GET /stripe/subscription` no. Gli adapter conoscono già `user.team.role`,
quindi il booleano derivato costa nulla ed evita di disegnare un bottone che risponde `403` — che
per l'utente è indistinguibile da un bug.

Attenzione a un dettaglio: `DefaultSubscriptionOwnerProvider.canManageBilling()` **non** confronta
con la stringa `"owner"`, ma con il ruolo di ownership effettivo — `accountsConfig.ownership-role`,
default `owner`, sovrascrivibile per tenant con `override-accounts-ownership-role`. Un booleano
lato client che confronta con `'owner'` hardcoded è quindi corretto per la configurazione di
default e **sbagliato in silenzio** per chiunque l'abbia cambiata: mostrerebbe il bottone a chi
prende `403` e lo nasconderebbe a chi ne ha diritto. Il valore va reso configurabile nel kit, con
`'owner'` come default.

## Vincolo dominante

**Zero dipendenze nel core, e nessuna Stripe.js.** Il core è "pure TypeScript, zero dependencies"
(README) e tutto il flusso è a pagina ospitata: si riceve una `url` e ci si va. Tirare dentro
`@stripe/stripe-js` aggiungerebbe una dipendenza, un secondo modello di integrazione e una chiave
pubblicabile da configurare, per zero guadagno rispetto a `window.location.href = url`.

**Parità fra le cinque superfici.** `docs/ADAPTER_CONTRACT.md` esiste perché la deriva fra adapter
è silenziosa. Quello che si aggiunge qui va aggiunto in tutte e cinque, o in nessuna.

---

## Task 1 — core: sottoscrizioni

**File:** `packages/kit/src/payments.ts` (nuovo), `packages/kit/src/types.ts`, `packages/kit/src/index.ts`

Tipi: `Plan`, `PlanPrice`, `Subscription`, `SeatsInfo`, `Licenses` — modellati sulle risposte
reali sopra, non inventati. `Subscription.seats.limit` e `.available` sono `number | null`
(`null` = illimitato, e il server manda proprio `null`, non un sentinella).

Funzioni: `getPlans`, `getSubscription`, `createCheckoutSession`, `openBillingPortal`,
`getLicenses`, `grantLicense`, `revokeLicense`.

Due dettagli che non vanno persi nel wrapping:

- `createCheckoutSession` deve distinguere il `409` "hai già un abbonamento attivo" dagli altri
  errori. `apiFetch` rigetta con `ApiError {status,message}`, quindi il caso è già distinguibile —
  ma va **documentato nel jsdoc della funzione**, perché è la differenza fra "mostra un messaggio
  d'errore" e "mandalo al Portal per fare l'upgrade".
- `grantLicense` ha quattro esiti su tre status (`201`/`200`/`404`/`409`) e `apiFetch` rigetta solo
  gli ultimi due. Restituire un `'granted' | 'already-licensed'` invece di `void` rende il `200`
  leggibile senza guardare la rete.

**Accettazione:** i tipi compilano contro le risposte reali; una `createCheckoutSession` su un team
già abbonato produce un `ApiError` con `status: 409`; `getPlans` funziona senza sessione.

## Task 2 — core: prodotti e ordini

**File:** `packages/kit/src/orders.ts` (nuovo)

Tipi: `CatalogItem`, `Order`, `OrderStatus`, `OrderLineItem`.
Funzioni: `getCatalog(config, opts?)`, `createOrder(config, items, email?)`, `getOrder(config, id, secret?)`.

`getCatalog` è una lettura di collection normale: il nome della collection è configurabile lato
servizio (default `catalog`), quindi va parametrizzato — non hardcodato — e il default va
documentato come "quello che il servizio usa se non è stato cambiato", non come una costante del
kit.

`getOrder` con `secret` è il percorso del guest: nessuna sessione, il secret nella query string.
Con una sessione attiva il secret non serve, ma passarlo non fa danno — `apiFetch` allega comunque
il token se c'è.

**Accettazione:** un ordine creato da guest si rilegge con `_id` + `secret` senza sessione.

## Task 3 — core: attendere il webhook

**File:** `packages/kit/src/payments.ts`, `packages/kit/src/orders.ts`

Due funzioni, stessa forma:

```ts
waitForSubscription(config, predicate, opts?): Promise<Subscription>
waitForOrder(config, id, secret?, opts?): Promise<Order>
```

- `opts`: `{ timeoutMs = 30_000, intervalMs = 1_000, signal? }`.
- Backoff: intervallo fisso va bene, ma il primo tentativo deve partire **subito**, non dopo il
  primo intervallo — nella maggior parte dei casi il webhook è già arrivato quando l'utente
  atterra, e un ritardo artificiale di un secondo su un'attesa che sarebbe stata zero è la
  differenza fra "istantaneo" e "lento".
- Uscita per timeout: **non** un `throw` generico. Il timeout qui significa "il webhook non è
  ancora arrivato", che è uno stato normale e temporaneo, non un fallimento del pagamento — il
  pagamento su Stripe è andato a buon fine comunque. Restituire l'ultimo stato letto e lasciare
  al chiamante la decisione, oppure rigettare con un errore riconoscibile (`status: 0` +
  `message` dedicato, coerente con come `apiFetch` segnala "mai arrivato al servizio"). Scegliere
  una delle due e documentarla: quello che non deve succedere è che l'utente veda "pagamento
  fallito" perché un poll è scaduto.
- `signal` per annullare quando il componente si smonta.

Per gli ordini il predicato è implicito (`status !== 'pending_payment'`), per le sottoscrizioni no:
un upgrade da `free` a `pro` e un downgrade sono entrambi "il piano è cambiato", ma il chiamante
sa da cosa. `predicate: (s: Subscription) => boolean` copre entrambi e non prova a indovinare.

**Accettazione:** unit test con transport finto — risolve al primo colpo se la condizione è già
vera (nessuna attesa), risolve dopo N tentativi, rispetta il timeout, si annulla con `signal`.

## Task 4 — core: formattazione degli importi

**File:** `packages/kit/src/money.ts` (nuovo)

`formatPrice(amount, currency, locale?)`. Gli importi di Stripe sono nell'**unità minore** della
valuta: `1990` è `19,90 €` ma `500` in JPY è `500 ¥`, e in BHD (3 decimali) `19900` è `19,900`.
`Intl.NumberFormat` conosce già i decimali di ogni valuta e non è una dipendenza — è nella
piattaforma. La divisione per 100 scritta a mano nel componente è il bug che questa funzione
esiste per prevenire, ed è lo stesso che abbiamo appena corretto lato server in
`OrderEventHandler.formatAmount()`.

**Accettazione:** EUR/USD a 2 decimali, JPY a 0, BHD a 3; nessuna dipendenza aggiunta.

## Task 5 — adapter: stato reattivo

**File:** `packages/kit-ng/src/*`, `packages/kit-react/src/context.tsx`, `packages/kit-vue/src/store.ts`
(+ le due superfici SSR)

Stato, parallelo a `user`/`teams`:

| Campo | Tipo | Derivato da |
|---|---|---|
| `subscription` | `Subscription \| null` | `getSubscription` |
| `plan` | `string \| null` | `subscription.plan` |
| `isSubscribed` | `boolean` | `subscription.active` |
| `canManageBilling` | `boolean` | `user.team.role === ownershipRole` (default `'owner'`, configurabile — vedi fatto 3) |
| `seatsAvailable` | `number \| null` | `subscription.seats.available` |

Metodi: gli stessi del core, più `loadSubscription()`.

**Quando si ricarica** è la parte che conta e va decisa qui, non lasciata all'app:

- dopo `checkSession` e dopo `login` — solo se il servizio ha i pagamenti attivi (vedi sotto)
- dopo `switchTeam` — **obbligatorio**: l'abbonamento è del team, cambiare team cambia il piano;
  dimenticarlo lascia in pagina il piano del team precedente, che è peggio di non mostrarlo
- dopo `waitForSubscription` risolta
- **non** dopo `updateProfile` o `acceptConsents` — non c'entrano

**Servizio senza pagamenti.** Un servizio senza il plugin `stripe` risponde `404` su
`/stripe/*` (è così che il kill switch per-tenant si manifesta). Caricare la subscription al login
su un'app che non vende niente produrrebbe un `404` a ogni avvio, che finisce in `onError` e nei
log di chiunque stia guardando. Serve un opt-in esplicito nella config (`payments?: boolean`, o la
sola presenza di un blocco `payments`) — l'assenza è il default, e in quel caso nessuna chiamata
parte mai.

**Accettazione:** su un'app senza `payments` attivo, nessuna richiesta a `/stripe/*` in tutto il
ciclo di vita; con `payments` attivo, `switchTeam` ricarica la subscription.

## Task 6 — contratto degli adapter e test

**File:** `docs/ADAPTER_CONTRACT.md`, unit test dei quattro adapter

Nuova sezione `E. Payments`, sulla falsariga delle esistenti:

| # | Scenario | Atteso |
|---|---|---|
| E1 | bootstrap senza `payments` in config | nessuna chiamata a `/stripe/*` |
| E2 | bootstrap con `payments`, sessione valida | carica `subscription` |
| E3 | `login` | carica `subscription` nello stesso flusso |
| E4 | `switchTeam` | ricarica `subscription` |
| E5 | `logout` | azzera `subscription` |
| E6 | `canManageBilling` | `true` sse `user.team.role` è il ruolo di ownership configurato; un caso con un `ownershipRole` diverso da `'owner'` va coperto, o la regressione al confronto hardcoded non si vede |
| E7 | `checkout` che risponde `409` | l'errore arriva al chiamante con `status: 409`, lo stato non cambia |

`kit-react` resta l'implementazione di riferimento, come dice il documento. La tabella "Rollout
status" va estesa con la colonna E.

I test di integrazione del core (live, gated) hanno bisogno di un servizio con `stripe`
configurato e di chiavi Stripe di test: vanno nello stesso schema `RH_TEST_*` degli altri e
**saltati** quando la variabile non c'è, non falliti — il pattern che `helpers.ts` già usa.

## Task 7 — documentazione

**File:** `packages/kit/README.md`, `README.md`, `docs/ADAPTERS.md`

La descrizione del pacchetto (`package.json`) e l'apertura del README dicono entrambe che il kit
è "signup and login" — vanno riscritte, altrimenti chi cerca i pagamenti non guarda qui.

Una pagina che copre, nell'ordine: le due modalità, il fatto che il token non si rinnova (fatto 1),
il buco del webhook con l'esempio di `waitForSubscription` sulla pagina di ritorno (fatto 2), chi
può fare cosa (fatto 3), e il `403` di una risorsa protetta da `@subscription` — che nel kit
compare come un `ApiError` qualunque, perché `403` lo è: se un deployment vuole distinguerlo,
lo fa con una regola Guards che risponde con uno status dedicato, come già si fa con `451` per i
consents.

---

## Ordine

`Task 1` → `Task 3` → `Task 4` → `Task 2` → `Task 5` → `Task 6` → `Task 7`.

Il Task 3 subito dopo il primo perché è quello che decide la forma delle pagine di ritorno, e
quindi cosa gli adapter devono esporre. Il Task 2 (prodotti) è indipendente e può slittare senza
bloccare le sottoscrizioni.

## Fuori scope

- **Stripe.js / Elements / pagamenti embedded.** Vedi il vincolo dominante.
- **Gestione del carrello.** Lo stato del carrello è dell'applicazione; il kit prende una lista di
  item e crea l'ordine.
- **Webhook.** Sono server-side, li gestisce `restheart-stripe`.
- **Pagine pronte.** Gli starter (`restheart-cloud-starter-*`) sono repo separati: una pagina
  pricing e una billing sono un lavoro a sé, dopo che questo strato esiste.
- **Fatturazione, tasse, contabilità.** Stanno su Stripe.

## Blocco al rollout

I test di integrazione live non possono girare finché il plugin `stripe` non è abilitato su un
servizio raggiungibile. Oggi è abilitato solo in IT, e l'ambiente IT gira su immagini Docker
snapshot che vanno ricostruite dalla CI di `restheart` — vedi
`restheart-cloud-server/specs/todo/stripe-plugin-service-nodes.md`, Fase 5. Il codice del kit e
gli unit test degli adapter non dipendono da questo e possono procedere prima.

### Configurazione del servizio per i test di integrazione

I test di integrazione del core (`packages/kit/src/__tests__/integration/`) girano contro un
servizio RESTHeart Cloud reale. Per testare i pagamenti serve un servizio con il plugin `stripe`
abilitato e configurato. Le variabili d'ambiente sono le stesse degli altri test (`RH_TEST_API_URL`,
`RH_TEST_ADMIN_PASSWORD`), più una nuova per abilitare i test pagamento.

#### Variabili d'ambiente

| Variabile | Obbligatoria | Descrizione |
|---|---|---|
| `RH_TEST_API_URL` | sì | URL base del servizio (es. `https://xxx.restheart.com`) |
| `RH_TEST_ADMIN_PASSWORD` | sì | Password dell'utente `root` per le chiamate admin |
| `RH_TEST_STRIPE` | no | Se assente o vuota, i test pagamento vengono **saltati** (non falliti). Imposta a `true` solo quando il servizio ha il plugin `stripe` attivo. |

Il pattern è lo stesso già usato da `helpers.ts`: i test gated saltano silenziosamente quando la
variabile non c'è, così lo stesso codice gira in CI (dove il servizio ha stripe) e in locale (dove
spesso non ce l'ha).

#### Configurazione lato servizio (`stripe.conf`)

Il servizio di test deve avere il plugin `stripe` abilitato con almeno un piano acquistabile.
Esempio di override file:

```bash
# Master switch
/stripeConfig/enabled -> true
/stripeConfig/secret-key -> "${STRIPE_SECRET_KEY}"
/stripeConfig/webhook-secret -> "${STRIPE_WEBHOOK_SECRET}"

# Subscriptions
/stripeConfig/subscriptions/enabled -> true
/stripeConfig/subscriptions/default-plan -> free
/stripeConfig/subscriptions/success-url -> "https://test-app.example.com/billing?success=true"
/stripeConfig/subscriptions/cancel-url -> "https://test-app.example.com/billing?canceled=true"
/stripeConfig/subscriptions/portal-return-url -> "https://test-app.example.com/billing"

# Un piano free (non acquistabile) e un piano gold (acquistabile)
/stripeConfig/subscriptions/plans -> {
  "free": {
    "seats": { "mode": "capped", "max": 1 },
    "limits": { "max-projects": 3 }
  },
  "gold": {
    "price-id-monthly": "price_...",
    "price-id-annual": "price_...",
    "seats": { "mode": "capped", "max": 10 },
    "limits": { "max-projects": 50 }
  }
}

# Products (opzionale, per test ordini)
/stripeConfig/products/enabled -> true
/stripeConfig/products/default-currency -> eur
/stripeConfig/products/success-url -> "https://test-app.example.com/order?session={CHECKOUT_SESSION_ID}"
/stripeConfig/products/cancel-url -> "https://test-app.example.com/cart"

# Plugins
/stripeService/enabled -> true
/stripeInitializer/enabled -> true
/stripeWebhookService/enabled -> true
/stripeCheckoutService/enabled -> true
/stripePortalService/enabled -> true
/stripeSubscriptionService/enabled -> true
/stripePlansService/enabled -> true
/stripeCatalogCache/enabled -> true
/stripeLicensesService/enabled -> true
/ordersCheckoutInterceptor/enabled -> true
/ordersCheckoutResponseInterceptor/enabled -> true
```

Le chiavi Stripe devono essere **test keys** (`sk_test_...`, `whsec_...`), mai le live.
I `price-id-*` sono i Price ID reali dal dashboard Stripe di test — servono almeno un mensile e/o
un annuale per il piano `gold`.

#### ACL per i test

Il servizio di test deve permettere:

1. **Registrazione e login** — già configurato per gli altri test
2. **`GET /stripe/plans`** — accesso anonimo (o autenticato, dipende dall'ACL del deployment)
3. **`GET /stripe/subscription`** — accesso a qualsiasi membro del team
4. **`POST /stripe/checkout`**, **`POST /stripe/portal`**, **`GET/POST/DELETE /stripe/licenses`** — accesso solo al ruolo di ownership (default `owner`)

Se l'ACL del servizio di test usa le regole di default di RESTHeart Cloud, queste sono già
coperte. Se usa regole custom, verificare che i path `/stripe/*` non siano bloccati.

#### Cosa testano i test di integrazione pagamento

I test verificano il **flusso lato client**, non Stripe stesso:

1. `getPlans()` — legge il catalogo piani dal servizio
2. `getSubscription()` — legge lo stato della sottoscrizione del team corrente
3. `createCheckoutSession()` — crea una sessione di checkout (riceve l'URL, non lo segue)
4. `openBillingPortal()` — crea una sessione portal (riceve l'URL)
5. `getLicenses()` / `grantLicense()` / `revokeLicense()` — gestione licenze
6. `createOrder()` / `getOrder()` — flusso ordini (se products abilitato)

Non testano il pagamento effettivo su Stripe — quello lo gestisce il webhook server-side.
I test gated vanno saltati con `it.skip` o con un guard all'inizio del file quando
`RH_TEST_STRIPE` non è impostata.

---

## Tutorial: usare i pagamenti con Angular (`kit-ng`)

### 1. Configurazione

Abilita i pagamenti nella config del provider. Senza `payments: true`, nessuna chiamata a
`/stripe/*` parte mai — un servizio senza il plugin `stripe` risponderebbe `404` a ogni avvio.

```ts
// app.config.ts
import { provideRhAuth } from '@restheart-cloud/kit-ng';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRhAuth({
      apiBaseUrl: 'https://mio-servizio.restheart.com',
      payments: true,                // opt-in esplicito
      ownershipRole: 'owner',        // default, sovrascrivibile se il tenant ha un ruolo diverso
    }),
  ],
};
```

### 2. Leggere lo stato della sottoscrizione

Lo stato è reattivo — i signal si aggiornano automaticamente dopo `checkSession`, `login` e
`switchTeam`.

```ts
import { Component, inject } from '@angular/core';
import { RhPaymentsService } from '@restheart-cloud/kit-ng';

@Component({
  selector: 'app-pricing',
  template: `
    @if (payments.subscription(); as sub) {
      <p>Piano attuale: <strong>{{ sub.plan }}</strong></p>
      <p>Stato: {{ sub.active ? 'Attivo' : 'Non attivo' }}</p>
      <p>Posti: {{ sub.seats.licensed }} / {{ sub.seats.limit ?? 'illimitati' }}</p>
    } @else {
      <p>Nessun abbonamento</p>
    }
  `,
})
export class PricingComponent {
  payments = inject(RhPaymentsService);
}
```

### 3. Mostrare il catalogo piani

`getPlans()` non richiede sessione — è sicuro chiamarla da una pagina pubblica.

```ts
@Component({ /* ... */ })
export class PlansComponent {
  private payments = inject(RhPaymentsService);
  plans = signal<Plan[]>([]);

  ngOnInit() {
    this.payments.getPlans().subscribe(res => this.plans.set(res.plans));
  }
}
```

### 4. Avviare il Checkout

`createCheckoutSession` restituisce un URL — reindirizza l'utente con `window.location.href`.

```ts
checkout(planId: string, interval: 'month' | 'year') {
  this.payments.createCheckoutSession(planId, interval).subscribe({
    next: ({ url }) => window.location.href = url,
    error: (err: ApiError) => {
      if (err.status === 409) {
        // Ha già un abbonamento — mandalo al Portal per l'upgrade
        this.openPortal();
      }
    },
  });
}
```

### 5. Pagina di ritorno dal Checkout (il buco del webhook)

Dopo il redirect da Stripe, il webhook potrebbe non essere ancora arrivato. **Non** usare
`getSubscription()` direttamente — usa `waitForSubscription` con un predicato.

```ts
@Component({ /* ... */ })
export class CheckoutSuccessComponent {
  private payments = inject(RhPaymentsService);
  private route = inject(ActivatedRoute);
  status = signal<'loading' | 'success' | 'timeout'>('loading');
  subscription = signal<Subscription | null>(null);

  ngOnInit() {
    const plan = this.route.snapshot.queryParamMap.get('plan') ?? '';

    this.payments.waitForSubscription(
      sub => sub.plan === plan && sub.active,
      { timeoutMs: 30_000, intervalMs: 1_000 }
    ).subscribe({
      next: sub => {
        this.subscription.set(sub);
        this.status.set('success');
      },
      error: err => {
        if (err.name === 'WaitTimeoutError') {
          this.status.set('timeout');
          // Il pagamento è andato a buon fine su Stripe,
          // il webhook arriverà a breve. Mostra un messaggio
          // "torna tra qualche secondo" invece di un errore.
        }
      },
    });
  }
}
```

**Attenzione:** `waitForSubscription` aggiorna automaticamente il signal `subscription`
dell'adapter quando risolve — non serve chiamare `loadSubscription()` dopo.

### 6. Chi può fare cosa

```ts
@Component({ /* ... */ })
export class BillingComponent {
  payments = inject(RhPaymentsService);

  // true solo per chi ha il ruolo di ownership (default: 'owner')
  get showBillingButtons(): boolean {
    return this.payments.canManageBilling();
  }
}
```

- `getSubscription()` — chiunque nel team può chiamarla
- `createCheckoutSession()`, `openBillingPortal()`, `getLicenses()`, `grantLicense()`,
  `revokeLicense()` — solo `canManageBilling === true`

### 7. Aprire il Portal

```ts
openPortal() {
  this.payments.openBillingPortal().subscribe({
    next: ({ url }) => window.location.href = url,
    error: (err: ApiError) => {
      if (err.status === 402) {
        // Mai fatto il checkout — reindirizza al checkout invece
        this.router.navigate(['/pricing']);
      }
    },
  });
}
```

### 8. Gestire le licenze (posti)

```ts
@Component({ /* ... */ })
export class TeamBillingComponent {
  payments = inject(RhPaymentsService);
  licenses = signal<Licenses | null>(null);

  loadLicenses() {
    this.payments.getLicenses().subscribe(l => this.grantLicense(l));
  }

  grantSeat(email: string) {
    this.payments.grantLicense(email).subscribe({
      next: result => {
        // result è 'granted' o 'already-licensed'
        this.loadLicenses(); // ricarica
      },
      error: (err: ApiError) => {
        if (err.status === 409) alert('Nessun posto disponibile');
        if (err.status === 404) alert('Utente non è un membro del team');
      },
    });
  }

  revokeSeat(email: string) {
    this.payments.revokeLicense(email).subscribe(() => this.loadLicenses());
  }
}
```

### 9. Prodotti e ordini (modalità products)

```ts
// Catalogo — lettura normale, niente di speciale
this.payments.getCatalog().subscribe(items => /* ... */);

// Creare un ordine (autenticato)
this.payments.createOrder(
  [{ productId: 'SKU-1', quantity: 1 }]
).subscribe(order => {
  window.location.href = order.checkout_url;
});

// Guest checkout — passa l'email, nessuna sessione richiesta
this.payments.createOrder(
  [{ productId: 'SKU-1', quantity: 1 }],
  'buyer@example.com'
).subscribe(order => {
  // Salva order._id e order.secret per la pagina di ritorno
  window.location.href = order.checkout_url;
});

// Pagina di ritorno ordine — stesso pattern di waitForSubscription
this.payments.waitForOrder(orderId, secret).subscribe({
  next: order => {
    if (order.status === 'paid') /* mostra conferma */;
  },
  error: err => {
    if (err.name === 'WaitTimeoutError') /* "torna tra poco" */;
  },
});
```

### 10. Formattare gli importi

Gli importi di Stripe sono in unità minore (centesimi per EUR/USD, interi per JPY).

```ts
import { formatPrice } from '@restheart-cloud/kit';

formatPrice(1990, 'eur');          // "€19.90"
formatPrice(500, 'jpy', 'it-IT');  // "¥500"
formatPrice(19900, 'bhd');         // "BHD 19.900"
```

### Nota importante: nessun rinnovo del token

A differenza di `acceptConsents`, i pagamenti **non** rinnovano il token. Il risolutore ACL
`@subscription` legge lo stato dal database a ogni richiesta, non dal JWT. Un upgrade è quindi
effettivo immediatamente, senza rilogin. Non aggiungere `renewToken()` dopo un cambio di piano —
sarebbe un round trip inutile.
