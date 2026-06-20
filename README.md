# PCP Backend — Phase 1 (Products API)

A fresh Express + PostgreSQL backend for Plant Center Peshawar, built as a
separate project alongside your existing Firebase version. Nothing here
touches your live site.

## What's in this phase

Just products: list, get one, create, update, delete. Orders and admin
login (auth) come in phase 2, once this is running and tested.

## Setup

**1. Get a free Postgres database (2 minutes, no install needed)**
- Go to https://neon.tech and sign up (free tier).
- Create a project. It'll show you a connection string that looks like:
  `postgresql://user:password@host/dbname`
- Copy it.

**2. Configure this project**
```bash
cd backend
cp .env.example .env
```
Open `.env` and paste your Neon connection string in as `DATABASE_URL`.

**3. Install dependencies**
```bash
npm install
```

**4. Create the tables**
Open your Neon project in the browser — it has a built-in SQL editor.
Paste the entire contents of `schema.sql` in there and run it. This
creates all 6 tables (products, product_images, product_colors, orders,
order_items, admin_users).

**5. Load your existing 12 products**
```bash
npm run seed
```
This reads the same product data you already have in Firestore's
`DEFAULT_PRODUCTS` and inserts it into Postgres properly split across
`products`, `product_images`, and `product_colors`.

**6. Run the server**
```bash
npm run dev
```
You should see `Backend running on http://localhost:5000`.

## Test it

```bash
curl http://localhost:5000/api/health
curl http://localhost:5000/api/products
curl http://localhost:5000/api/products/1
```

You should get back JSON that looks just like what `getProducts()` used
to return from Firestore — same shape, just a different source.

## What's next

Once you've confirmed this works (products load, you can add one with a
POST request), tell me and we'll add:
1. The `orders` endpoints (placing an order, admin viewing/updating status)
2. JWT-based admin login (replacing Firebase Auth's `signInWithEmailAndPassword`)
3. The Next.js frontend that actually calls this API
