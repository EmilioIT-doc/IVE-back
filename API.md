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
| POST | `/auth/register` | ver abajo | `201 { verification }` (**todavía sin sesión**) |
| POST | `/auth/verify` | `{ email, code }` | `{ user }` + cookies (sesión iniciada) |
| POST | `/auth/verification/resend` | `{ email, channel: "email" \| "sms" }` | `{ verification }` |
| POST | `/auth/login` | `{ email, password, remember? }` | `{ user }` + cookies |
| POST | `/auth/refresh` | — (cookie) | `{ user }` + cookies nuevas |
| POST | `/auth/logout` | — | `204` |
| GET 🔒 | `/auth/me` | — | `{ user }` |

Body de registro:

```json
{
  "firstName": "Ana", "lastName": "López", "email": "ana@correo.com", "password": "********",
  "phone": "5512345678", "birthDate": "1998-04-17",
  "address": { "recipientName": "Ana López", "phone": "5512345678", "street": "Av. Juárez", "extNumber": "10",
               "intNumber": null, "neighborhood": "Centro", "city": "CDMX", "state": "CDMX", "postalCode": "06000" },
  "channel": "email"
}
```

La dirección se guarda como su dirección principal. Edad permitida: 13 a 120 años.

`verification = { email, channel, destination, expiresAt, resendAvailableAt, canUseSms }` (`destination` viene enmascarado: `a••a@correo.com`, `•••• 5678`).

**Verificación:** código de 6 dígitos, dura 10 min, 5 intentos, reenvío cada 60 s (máx. 5 por hora). Solo se guarda su hash.
Por correo sale por SMTP (en local, Mailpit: http://localhost:8025). El SMS es simulado: se imprime en la terminal del back (listo para cambiar a Twilio en `src/lib/messaging/sms.ts`). En desarrollo el código también se imprime en la terminal.

`user = { id, email, firstName, lastName, role, phone, birthDate }` · Errores: `EMAIL_TAKEN` (409), `INVALID_CREDENTIALS` (401), `ACCOUNT_NOT_VERIFIED` (403, con `details: { email, canUseSms }`), `INVALID_CODE` (400, con intentos restantes), `CODE_EXPIRED` (400), `TOO_MANY_ATTEMPTS` / `RESEND_TOO_SOON` / `TOO_MANY_CODES` (429), `ALREADY_VERIFIED` (409), `VALIDATION_ERROR` (400).

## Catálogo

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/categories` | `{ categories: [{ id, name, slug, coverUrl, coverFraming, productCount }] }` (solo visibles, en orden) |
| GET | `/products` | `{ items, page, limit, total, totalPages }` |
| GET | `/products/filters` | `{ sizes, colors, minPriceCents, maxPriceCents }` |
| GET | `/products/:slug` | `{ product: { id, slug, name, description, priceCents, compareAtCents, viewCount, gender, category: { name, slug }, images, colors, sizes, variants } }` |
| GET | `/products/:slug/related?limit=4` | `{ items }` |
| POST | `/products/:slug/views` | `{ viewCount }` — suma una vista (una por visitante cada 30 min, cookie anónima `ive_vid`) |

Query de `/products`: `category` (slug), `gender` (`mujer` y `hombre` incluyen lo unisex; `unisex` = solo unisex), `size=M,L`, `color=negro,gris`, `minPriceCents`, `maxPriceCents`, `q` (búsqueda), `sale=1` (solo ofertas), `sort=newest|price_asc|price_desc`, `page`, `limit` (máx. 48).

Cada item trae `compareAtCents` (precio "antes", `null` si no está en oferta), `ratingAverage` y `reviewCount`.

`variant = { id, sku, size, color, priceCents, stock }`

## Reseñas

| Método | Ruta | Body / Respuesta |
|---|---|---|
| GET | `/products/:slug/reviews?sort=recent\|best\|worst&page=1&limit=5` | `{ summary: { count, average, distribution }, items, mine, page, totalPages }` |
| PUT 🔒 | `/products/:slug/reviews/mine` | `{ rating: 1-5, title?, comment? }` → `{ review }` (crea o edita la tuya) |
| DELETE 🔒 | `/products/:slug/reviews/mine` | `204` |

Cualquier cuenta verificada puede reseñar; una reseña por persona por producto. `review = { id, rating, title, comment, authorName ("Ana L."), verifiedPurchase, isHidden, isMine, createdAt, updatedAt }`. `verifiedPurchase` = compró el producto (pedido pagado, enviado o entregado). Las ocultas por el admin no salen en la lista ni en el promedio; su autor sí las ve en `mine`.

## Favoritos 🔒 — `/favorites`

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/favorites` | `{ items }` (mismo formato que el catálogo) |
| PUT | `/favorites/:productId` | `204` (si ya estaba, no pasa nada) |
| DELETE | `/favorites/:productId` | `204` |

## Cupones 🔒 — `/coupons`

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| POST | `/coupons/preview` | `{ code }` | `{ coupon: { code, description, discountCents } }` sobre tu bolsa actual |

Errores: `COUPON_NOT_FOUND` (404), `COUPON_NOT_STARTED` / `COUPON_EXPIRED` / `COUPON_MIN_SUBTOTAL` (400), `COUPON_USED_UP` / `COUPON_ALREADY_USED` (409).

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
| POST | `/orders` | Header **`Idempotency-Key`** (ej. `crypto.randomUUID()`). Body: `{ addressId }` **o** `{ address, saveAddress? }`, más `shippingMethod: "standard" \| "express"`, `paymentToken` y `couponCode?` |
| GET | `/orders` | Mis pedidos |
| GET | `/orders/:id` | Detalle (solo si es tuyo) |

Tokens de pago de prueba: `tok_success`, `tok_declined`, `tok_insufficient_funds`.
Errores: `CART_EMPTY` (400), `PAYMENT_DECLINED` (402), `INSUFFICIENT_STOCK` (409, con `details`).

Envío: estándar $99, **gratis desde $999** (sobre el subtotal ya con descuento); express $149.

Con cupón, el pedido guarda `discountCents` y `couponCode`: `total = subtotal − descuento + envío`. El cupón se vuelve a validar (con candado) al cobrar.

## Administración 🔒👑 — `/admin` (solo rol `admin`)

| Método | Ruta | Body |
|---|---|---|
| GET | `/admin/products` | — (incluye productos ocultos) |
| POST | `/admin/products` | `{ categoryId, gender?: "unisex" \| "hombre" \| "mujer", name, priceCents, compareAtCents?, description?, isActive?, slug?, variants?: [{ size, color, stock, priceCents? }] }` |
| GET | `/admin/products/:id` | — |
| PATCH | `/admin/products/:id` | cualquiera de los campos de arriba (sin `variants`) |
| PUT | `/admin/products/:id/variants` | `{ variants: [{ id?, size, color, stock, priceCents?, isActive }] }` — lista completa; las que no vengan se desactivan |
| PATCH | `/admin/products/:id/images/order` | `{ ids: [...] }` — la 1ª es portada, la 2ª el hover |
| DELETE | `/admin/products/:id/images/:imageId` | — |

`compareAtCents` = precio "antes" (tachado); debe ser mayor que `priceCents`, `null` quita la oferta.

El SKU se genera solo: `P<id>-<COLOR>-<TALLA>` (ej. `P9-AZUL-MARINO-M`). Un cliente recibe `403 FORBIDDEN`.

### Cupones y reseñas

| Método | Ruta | Body |
|---|---|---|
| GET | `/admin/coupons` | — |
| POST | `/admin/coupons` | `{ code, description?, discountType: "percent" \| "fixed", discountValue, minSubtotalCents?, maxUses?, perUserLimit?, startsAt?, endsAt?, isActive? }` |
| PATCH | `/admin/coupons/:id` | `{ isActive }` |
| DELETE | `/admin/coupons/:id` | — (solo si nunca se usó: `409 COUPON_IN_USE`) |
| GET | `/admin/reviews?status=all\|visible\|hidden&page=1` | — |
| PATCH | `/admin/reviews/:id` | `{ isHidden }` |

`discountValue`: porcentaje 1–100, o centavos si es `fixed`.

### Categorías

| Método | Ruta | Body |
|---|---|---|
| GET | `/admin/categories` | — (incluye ocultas, con `productCount` y `activeProductCount`) |
| POST | `/admin/categories` | `{ name, slug?, isActive? }` (se agrega al final) |
| GET | `/admin/categories/:id` | — |
| PATCH | `/admin/categories/:id` | `{ name?, slug?, isActive? }` |
| PATCH | `/admin/categories/order` | `{ ids: [...] }` — lista completa; es el orden del home |
| DELETE | `/admin/categories/:id` | — `409 CATEGORY_NOT_EMPTY` si tiene productos |
| DELETE | `/admin/categories/:id/cover` | — quita la portada |
| PUT | `/admin/categories/:id/cover-framing` | `{ zoom: 1–3, x: 0–100, y: 0–100 }` — encuadre de la portada |
| POST | `/admin/categories/:id/uploads` | `{ files: [1 archivo] }` — portada, por el mismo flujo de pedazos de abajo |

Slugs reservados: `mujer`, `hombre`, `unisex` (son las secciones `/tienda/mujer`, etc.).

### Subida de fotos pesadas (por pedazos + cola)

Hasta **100 MB por foto** y 20 por lote. Formatos: JPG, PNG, WEBP, AVIF, TIFF, GIF y HEIC (iPhone).

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| POST | `/admin/products/:id/uploads` | `{ files: [{ fileName, size, mimeType? }] }` | `201 { chunkSize, uploads: [upload] }` |
| PUT | `/admin/uploads/:uploadId?offset=N` | binario, `Content-Type: application/octet-stream`, máx. `chunkSize` | `{ receivedBytes, sizeBytes }` |
| POST | `/admin/uploads/:uploadId/complete` | — | `202 { upload }` (queda en cola) |
| GET | `/admin/uploads/:uploadId` | — | `{ upload }` |
| DELETE | `/admin/uploads/:uploadId` | — | `204` |

`upload = { id, productId, categoryId, fileName, sizeBytes, receivedBytes, status, error: { code, message } | null, image: { id | null, url } | null }`
`status`: `uploading` → `queued` → `processing` → `ready` (o `failed` / `canceled`).

1. Abre el lote: una sesión por archivo, en el orden elegido (la 1ª será la portada).
2. Manda cada archivo en pedazos de `chunkSize` (8 MB), en orden. `offset` = bytes que ya se mandaron.
   Si responde `409 OFFSET_MISMATCH`, `details.receivedBytes` dice desde dónde seguir (así se **reanuda**).
3. `complete` → un worker la convierte a WebP (máx. 2400 px, sin metadatos) y la agrega al producto.
4. Pregunta con `GET` hasta que diga `ready` (trae `image.url`) o `failed`.

Errores: `UNSUPPORTED_IMAGE` (415, se revisan los bytes reales del 1er pedazo), `PAYLOAD_TOO_LARGE` (413),
`UPLOAD_INCOMPLETE` / `UPLOAD_CLOSED` / `UPLOAD_NOT_CANCELABLE` (409), `IMAGE_UNREADABLE` (en `upload.error`).

Los pedazos se guardan en `back/tmp/uploads/` y las fotos listas en `back/uploads/products/` (se sirven en `/uploads/products/<archivo>`).

## Fotos del inicio

| Método | Ruta | Body |
|---|---|---|
| GET | `/site-images` (público) | — → `{ images: { home_hero: { url, altText, framing, updatedAt }, home_editorial: {…} } }` |
| GET 🔒👑 | `/admin/site-images` | — (lo mismo) |
| PATCH 🔒👑 | `/admin/site-images/:slot` | `{ altText }` — descripción para lectores de pantalla |
| DELETE 🔒👑 | `/admin/site-images/:slot/image` | — quita la foto (vuelve el bloque de color) |
| PUT 🔒👑 | `/admin/site-images/:slot/framing` | `{ zoom: 1–3, x: 0–100, y: 0–100 }` — encuadre |
| POST 🔒👑 | `/admin/site-images/:slot/uploads` | `{ files: [1 archivo] }` — por el flujo de pedazos |

**Encuadre** (`framing` / `coverFraming`): no recorta el archivo; el front lo aplica con CSS
(`object-position: x% y%` + `scale(zoom)` desde ese punto). Al subir otra foto se reinicia a `{ zoom: 1, x: 50, y: 50 }`.

`slot`: `home_hero` (portada, se recomienda 2000 × 2000 px) o `home_editorial` (arriba del footer, 1600 × 1400 px).

## Usuarios de prueba (después de `npm run db:reset`)

- `demo@ive.store` / `Demo1234!`
- `admin@ive.store` / `Admin123!` (rol admin)
