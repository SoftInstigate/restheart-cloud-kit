# Gli starter configurati da `rhc`, e la documentazione che li racconta

**Status:** in corso. **Repo:** i tre starter, `restheart-website`.
**Related:** [`provisioning.md`](./provisioning.md), [`configuration.md`](./configuration.md).

Gli starter hanno tutti e tre un `rhc.setup.ts`. Quel che resta è il contorno: far sparire i
passi manuali che il setup ha reso inutili, e scrivere la documentazione che oggi non esiste.

## 1. Il seed del catalogo diventa un passo del setup

**Repo:** `restheart-cloud-starter-ecommerce`. Sostituisce `scripts/seed-catalog.mjs`.

Lo script oggi vuole `RH_API_URL` e `RH_ADMIN_PASSWORD` — la **password root** del servizio,
da procurarsi e configurare a parte. Un passo di `rhc setup` non ha bisogno di nulla: `service`
gli arriva già autenticato col JWT di servizio che il CLI conia da sé. Un passo manuale in meno
e una password in meno è esattamente il motivo per cui il setup esiste.

Lo script è già idempotente nella forma giusta — `PUT` di ogni prodotto a un `_id` noto, quindi
sovrascrive invece di duplicare.

**La decisione è il `check`, e cambia molto:**

- *"questi prodotti esistono con questi valori"* → chi modifica un prezzo demo se lo vede
  riscrivere a ogni run, e una pipeline che rilancia il setup a ogni merge riporta il catalogo
  ai dati finti in continuazione;
- *"il catalogo ha almeno un documento"* → semina una volta e poi non tocca più niente.

**Il secondo.** La configurazione la vuoi riapplicata sempre, il contenuto no. E il passo va
chiamato per quello che è — `sample catalog, if the shop is empty` — così chi adotta lo starter
sul serio sa quale riga cancellare.

**Da non perdere nel travaso:** i campi sono **snake_case** (`unit_amount`, `image_url`) e
`unit_amount` va scritto come `$numberInt`, perché `CatalogReader` rifiuta un importo non
intero. Il commento in cima allo script lo spiega e dice di non "sistemarlo": va ricopiato, non
riscritto a memoria.

## 2. I README dei tre starter

Devono riferirsi ai **package pubblicati**: `npm install -g @restheart-cloud/cli` per il
comando, `npm i -D @restheart-cloud/cli` per il file di setup. **Mai `npm link`** — è una nostra
particolarità temporanea finché il package non è su npm, non un passo del prodotto.

Nell'ecommerce c'è un blocco "Local kit development" che descrive proprio il link: va isolato
come nota temporanea nostra, o tolto.

## 3. La documentazione cloud

Pagine nuove sotto `docs/cloud/`:

| | |
|---|---|
| `tokens.adoc` | PAT contro service admin token, ruolo `cli`, emissione e revoca |
| `cli.adoc` | `rhc login/logout/setup`, il file di setup, la CI, e la nota sul clash del nome `rhc` |
| `stripe.adoc` | esiste una sezione Stripe da 10 pagine e **nessuna pagina cloud la nomina**: da lì il plugin non si scopre |

Da aggiornare: `ui-overview` (§ Admin JWT, che oggi dice che il token non lo gestisci tu — non
più vero da quando c'è `/me/tokens`), `getting-started` (Step 2), `index`, la sidebar.

**Full-Stack Example e Examples vanno riscritte sugli starter.** Oggi puntano a
`restheart-cloud-examples` e la Parte 1 crea le collection a mano con curl — cioè esattamente
ciò che `rhc setup` sostituisce.

## Il vincolo di sequenza

Entrambe le pagine nuove descrivono cose non ancora vere in produzione: i PAT vogliono lo
snapshot 9.8 e `init-admin-node.sh` sugli ambienti, e `npm i -g @restheart-cloud/cli` dà 404
finché non c'è un tag di release del kit. **La PR sul sito si merga per ultima.** Documentazione
che promette un `npm install` che va in 404 è peggio di nessuna documentazione.
