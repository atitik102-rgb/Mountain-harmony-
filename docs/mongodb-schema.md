# MountainHarmony — Schema MongoDB MVP

MongoDB tidak membutuhkan SQL migration. Koleksi berikut adalah kontrak data relasional-logis yang dipakai aplikasi. Semua dokumen memakai `id` UUID, bukan Mongo ObjectId, sehingga aman dikirim sebagai JSON.

## Koleksi dan relasi

### `users`
```js
{ id, name, email, role: "traveler" | "host" | "admin", phone, created_at }
```

### `hosts`
```js
{ id, user_id, name, location, photo, story, skills: [], rating, impact_total, verified, created_at }
```

### `packages`
```js
{ id, host_id, title, type, location, price, duration, description, active, created_at }
```
`packages.host_id` → `hosts.id`.

### `bookings`
```js
{ id, package_id, package_title, host_id, guest_name, guest_count,
  travel_date, total_amount, status: "confirmed" | "cancelled", created_at }
```
`bookings.package_id` → `packages.id`; `bookings.host_id` → `hosts.id`.

### `impact_categories`
```js
{ id, name, icon, allocation_percent, active, is_default, created_at }
```
Admin dapat menambah kategori baru melalui `POST /api/categories`. Karena booking membaca dokumen kategori aktif saat transaksi, kategori baru langsung ikut alokasi tanpa perubahan kode.

### `education_funds`
```js
{ id, booking_id, host_id, allocation_category, amount, percent,
  verified, created_at }
```
`education_funds.booking_id` → `bookings.id`; `education_funds.host_id` → `hosts.id`.

## Auto-allocation

`POST /api/bookings` menjalankan alur atomik-logis berikut: mengambil paket dan kategori default aktif, membuat booking confirmed, membuat satu dokumen `education_funds` per kategori dengan `amount = total_amount × allocation_percent / 100`, lalu menaikkan `hosts.impact_total`. Di produksi, bungkus tiga operasi tersebut dalam MongoDB transaction pada replica set untuk jaminan atomicity penuh.

## Endpoint MVP

- `GET /api` — total dampak per kategori dan jumlah booking
- `GET /api/packages`, `GET /api/hosts`, `GET /api/categories`, `GET /api/bookings`
- `POST /api/bookings` — booking + auto-allocation
- `POST /api/categories` — kategori dampak baru untuk admin
- `PUT /api/hosts/:id` — pembaruan cerita, keahlian, foto, dan lokasi host

## Struktur folder inti

```text
app/
├── api/[[...path]]/route.js  # API MongoDB + auto-allocation
├── page.js                   # landing, katalog, booking, impact tracker
├── layout.js
└── globals.css
docs/mongodb-schema.md
```