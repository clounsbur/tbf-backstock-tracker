# Warehouse Inventory Mapping App

Internal warehouse MVP using Express, TypeScript, Prisma, PostgreSQL, and a small React frontend.

For this MVP, Supabase is used only as the managed PostgreSQL provider. The app does not use Supabase client libraries.

## Supabase Setup

1. Create a Supabase project.
2. In Supabase, open the database connection settings and copy the Postgres connection strings.
3. Create `.env` from `.env.example`.
4. Set:
   - `DATABASE_URL` to the pooled/session connection string for Prisma Client runtime traffic.
   - `DIRECT_URL` to the direct database connection string for Prisma CLI commands.

Example shape:

```env
DATABASE_URL="postgresql://postgres.<PROJECT_REF>:<PASSWORD>@aws-0-<REGION>.pooler.supabase.com:5432/postgres?pgbouncer=true&connection_limit=10&schema=public"
DIRECT_URL="postgresql://postgres:<PASSWORD>@db.<PROJECT_REF>.supabase.co:5432/postgres?schema=public"
PORT=4000
```

## Database Workflow

Install dependencies:

```bash
npm install
```

Generate Prisma Client:

```bash
npm run prisma:generate
```

Create and apply the first migration:

```bash
npm run prisma:migrate -- --name init
```

For later hosted-environment deploys, apply committed migrations with:

```bash
npm run prisma:migrate:deploy
```

Seed the demo warehouse data:

```bash
npm run prisma:seed
```

Run the live database smoke test:

```bash
npm run smoke:db
```

The smoke test verifies that the seed created seven active backstock areas, that inbound suggestions rank usable non-overflow space ahead of temporary overflow, and that an invalid front-home-slot move is rejected.

## Running Locally

Run the backend API in one terminal:

```bash
npm run dev:api
```

Run the React frontend in a second terminal:

```bash
npm run dev:web
```

Local URLs:

- Backend API: `http://localhost:4000/api`
- Frontend: `http://127.0.0.1:5173`

The frontend reads `VITE_API_BASE_URL` and defaults to `http://localhost:4000/api`.

Build both API and frontend:

```bash
npm run build
```

Key MVP routes:

- `GET /api/locations`
- `GET /api/pallets`
- `GET /api/skus`
- `GET /api/skus/search?q=100220`
- `POST /api/moves`
- `GET /api/moves`
- `GET /api/move-destinations?palletId=...`
- `GET /api/suggestions/inbound-placement?partNumber=100220&palletQty=2`

Frontend MVP screens:

- `/floor-map`
- `/sku-search`
- `/move-pallet`
- `/inbound-suggestions`

## Supabase + Prisma Notes

- Keep Express + Prisma as the only backend data access path for now.
- Use Supabase as managed Postgres, not as the app client SDK layer.
- Prisma supports `directUrl` in `schema.prisma`; this lets Prisma Client use `DATABASE_URL` while migrations and admin CLI operations use `DIRECT_URL`.
- Prefer the pooled/session Supabase URL for the running API to avoid exhausting Postgres connections.
- Prefer the direct URL for migrations. Migration workflows need stable database sessions and should not depend on transaction-pooling behavior.
- If the direct URL is not reachable from your network because of IPv6 or firewall limitations, set `DIRECT_URL` to the Supabase session-pooler URI for `prisma migrate deploy`. Avoid the transaction pooler for Prisma migrations.
- Keep `connection_limit` conservative for the API until real warehouse usage is known.
- Supabase Row Level Security is powerful, but this backend connects with database credentials through Prisma. Application authorization should be handled in the Express layer unless/until a later auth phase changes that architecture.
