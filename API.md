# API de ive-store

Base: `http://localhost:3000/api` · Todo el dinero va en **centavos** (`34900` = $349.00) · Los ids son **strings**.

Errores siempre con esta forma:

```json
{ "error": { "code": "INSUFFICIENT_STOCK", "message": "Texto para mostrar", "details": {} } }
```

La sesión viaja en cookies `httpOnly` (el front usa `credentials: "include"` en cada fetch).
🔒 = requiere sesión. Si responde `401` con `code: "TOKEN_EXPIRED"`, llama a `POST /auth/refresh` y reintenta.

## Auth — `/auth`

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| POST | `/auth/check-email` | `{ email }` | `{ available: boolean }` |
| POST | `/auth/register` | `{ firstName, lastName, email, password }` | `201 { user }` + cookies (sesión iniciada) |
| POST | `/auth/login` | `{ email, password, remember? }` | `{ user }` + cookies |
| POST | `/auth/refresh` | — (cookie) | `{ user }` + cookies nuevas |
| POST | `/auth/logout` | — | `204` |
| GET 🔒 | `/auth/me` | — | `{ user }` |

`user = { id, email, firstName, lastName, role }` · Errores: `EMAIL_TAKEN` (409), `INVALID_CREDENTIALS` (401), `VALIDATION_ERROR` (400).

## Catálogo

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/categories` | `{ categories: [{ id, name, slug, children: [...] }] }` |
| GET | `/products` | `{ items, page, limit, total, totalPages }` |
| GET | `/products/filters` | `{ sizes, colors, minPriceCents, maxPriceCents }` |
| GET | `/products/:slug` | `{ product: { id, slug, name, description, priceCents, category, images, colors, sizes, variants } }` |
| GET | `/products/:slug/related?limit=4` | `{ items }` |

Query de `/products`: `category` (slug; incluye subcategorías), `size=M,L`, `color=negro,gris`, `minPriceCents`, `maxPriceCents`, `q` (búsqueda), `sort=newest|price_asc|price_desc`, `page`, `limit` (máx. 48).

`variant = { id, sku, size, color, priceCents, stock }`

## Bolsa 🔒 — `/cart`

| Método | Ruta | Body |
|---|---|---|
| GET | `/cart` | — |
| POST | `/cart/items` | `{ variantId, quantity }` (suma a lo que ya había) |
| PATCH | `/cart/items/:variantId` | `{ quantity }` (cantidad exacta) |
| DELETE | `/cart/items/:variantId` | — |
| POST | `/cart/merge` | `{ items: [{ variantId, quantity }] }` (bolsa de invitado al iniciar sesión) |

Todas regresan `{ cart: { items, itemCount, subtotalCents, shipping: { freeFromCents, remainingForFreeCents, standardCents } } }`.

## Direcciones 🔒 — `/addresses`

| Método | Ruta | Body |
|---|---|---|
| GET | `/addresses` | — |
| POST | `/addresses` | `{ recipientName, phone, street, extNumber, intNumber?, neighborhood, city, state, postalCode, isDefault? }` |
| PATCH | `/addresses/:id/default` | — |
| DELETE | `/addresses/:id` | — |

## Pedidos 🔒 — `/orders`

| Método | Ruta | Notas |
|---|---|---|
| POST | `/orders` | Header **`Idempotency-Key`** (ej. `crypto.randomUUID()`). Body: `{ addressId }` **o** `{ address, saveAddress? }`, más `shippingMethod: "standard" \| "express"` y `paymentToken` |
| GET | `/orders` | Mis pedidos |
| GET | `/orders/:id` | Detalle (solo si es tuyo) |

Tokens de pago de prueba: `tok_success`, `tok_declined`, `tok_insufficient_funds`.
Errores: `CART_EMPTY` (400), `PAYMENT_DECLINED` (402), `INSUFFICIENT_STOCK` (409, con `details`).

Envío: estándar $99, **gratis desde $999**; express $149.

## Usuarios de prueba (después de `npm run db:reset`)

- `demo@ive.store` / `Demo1234!`
- `admin@ive.store` / `Admin123!` (rol admin)
