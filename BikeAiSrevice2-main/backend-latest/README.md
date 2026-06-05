# BikeAI Backend — Express + Prisma + MySQL (Phase 1 MVP)

Production-shaped Node/TypeScript backend that replaces the original Supabase
stack with a self-hosted MySQL database. Covers Phase 1 of the BikeAI spec:
auth, customers, vehicles, dealers, bookings, job cards, additional-work
approvals, billing/payments, and dashboard analytics.

## 1. Stack

- **Node.js 20+** / TypeScript 5
- **Express 4** with helmet, cors, rate-limit, morgan
- **Prisma ORM 5** against **MySQL 8.x**
- **JWT** auth (`bcryptjs` hashing), role-based middleware
- **Zod** request validation
- Clean layering: `config` → `middlewares` → `modules/<name>/{routes,service}` → `utils`

## 2. Folder layout

```
src/
  config/            env + prisma client
  middlewares/       auth, error, validate
  utils/             ApiError, jwt, asyncHandler
  modules/
    auth/            register, login, me
    users/           staff/admin user management
    customers/       CRM customer master
    vehicles/        OEM/model lookups + customer vehicles
    dealers/         service centers
    bookings/        service appointments + timeline
    jobcards/        digital job cards, items, approvals
    billing/         invoices + payments
    dashboard/       KPIs + live activity
  app.ts             Express app factory
  server.ts          entry point
prisma/
  schema.prisma      MySQL schema (port of the Supabase model)
  seed.ts            demo admin + OEMs + dealer
```

## 3. Setup

### 3.1 Prerequisites
- Node.js 20+
- MySQL 8.x running locally or remotely

### 3.2 Install
```bash
cp .env.example .env
# edit DATABASE_URL and JWT_SECRET
npm install
```

### 3.3 Database
Create the DB once:
```sql
CREATE DATABASE bikeai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'bikeai'@'%' IDENTIFIED BY 'bikeai';
GRANT ALL PRIVILEGES ON bikeai.* TO 'bikeai'@'%';
FLUSH PRIVILEGES;
```

Generate the Prisma client + run migrations:
```bash
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run db:seed
```

### 3.4 Run
```bash
npm run dev      # tsx watch
# or
npm run build && npm start
```

Server: `http://localhost:4000` — health check at `/health`.

### 3.5 Default credentials (from seed)
- email: `admin@bikeai.local`
- password: `Admin@12345`

## 4. Auth

All protected routes require `Authorization: Bearer <jwt>`. Get one with:
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"admin@bikeai.local","password":"Admin@12345"}'
```

Roles: `admin`, `dealer`, `service_advisor`, `technician`, `crm_executive`, `customer`.

## 5. API surface

| Method | Path                                         | Roles                       | Purpose                            |
|--------|----------------------------------------------|-----------------------------|------------------------------------|
| POST   | `/api/auth/register`                         | public                      | Create user (+ customer profile)   |
| POST   | `/api/auth/login`                            | public                      | Email/phone + password login       |
| GET    | `/api/auth/me`                               | any                         | Current user                       |
| GET    | `/api/users`                                 | admin/dealer                | List staff                         |
| POST   | `/api/users`                                 | admin/dealer                | Create staff (technician, advisor…)|
| PATCH  | `/api/users/:id`                             | admin/dealer                | Update staff                       |
| GET    | `/api/dealers`                               | public                      | List service centers               |
| POST   | `/api/dealers`                               | admin/dealer                | Create dealer                      |
| PATCH  | `/api/dealers/:id`                           | admin/dealer                | Update dealer                      |
| GET    | `/api/customers`                             | admin/dealer/advisor/crm    | Search customers                   |
| POST   | `/api/customers`                             | admin/dealer/advisor/crm    | Add walk-in customer               |
| GET    | `/api/customers/:id`                         | admin/dealer/advisor/crm    | 360° view                          |
| GET    | `/api/vehicles/oems`                         | any                         | OEM dropdown                       |
| GET    | `/api/vehicles/models?oemId=`                | any                         | Model dropdown                     |
| GET    | `/api/vehicles?customerId=`                  | any                         | Vehicles for a customer            |
| POST   | `/api/vehicles`                              | any                         | Register vehicle                   |
| GET    | `/api/bookings`                              | any                         | Filterable list                    |
| POST   | `/api/bookings`                              | any                         | Book service                       |
| PATCH  | `/api/bookings/:id/status`                   | any                         | Move through pipeline              |
| GET    | `/api/job-cards`                             | admin/dealer/advisor/tech   | Workshop queue                     |
| POST   | `/api/job-cards`                             | admin/dealer/advisor        | Open job card                      |
| PATCH  | `/api/job-cards/:id/assign`                  | admin/dealer/advisor        | Assign technician                  |
| PATCH  | `/api/job-cards/:id/status`                  | admin/dealer/advisor/tech   | Update workshop stage              |
| POST   | `/api/job-cards/:id/items`                   | admin/dealer/advisor        | Add labour/part line               |
| POST   | `/api/job-cards/:id/approvals`               | admin/dealer/advisor        | Request additional-work approval   |
| PATCH  | `/api/job-cards/approvals/:approvalId`       | admin/dealer/advisor        | Approve/reject                     |
| POST   | `/api/billing/invoices/from-job-card/:id`    | admin/dealer/advisor        | Convert job card → invoice         |
| POST   | `/api/billing/invoices/:id/payments`         | admin/dealer/advisor        | Record payment (UPI/cash/card)     |
| GET    | `/api/dashboard/overview?dealerId=`          | admin/dealer/advisor        | Today’s KPIs                       |
| GET    | `/api/dashboard/activity?dealerId=`          | admin/dealer/advisor        | Live activity feed                 |

## 6. Replacing the original Supabase calls in the frontend

The original Vite/React app talks to Supabase via `src/lib/supabase.ts`. To
point it at this backend:

```ts
// src/lib/api.ts  (replacement)
const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000/api";

function authHeaders(): HeadersInit {
  const t = localStorage.getItem("bikeai_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
  return res.status === 204 ? (undefined as T) : res.json();
}

// Examples
export const login = (identifier: string, password: string) =>
  api<{ token: string; user: any }>("/auth/login", { method: "POST", body: JSON.stringify({ identifier, password }) });

export const listBookings = (dealerId?: string) =>
  api(`/bookings${dealerId ? `?dealerId=${dealerId}` : ""}`);
```

Then delete:
- `src/lib/supabase.ts`
- `@supabase/supabase-js` from `package.json`
- everything under `supabase/`

Anywhere the old code did `supabase.from('customer_bookings').select(...)`,
swap for the matching `api('/bookings...')` call (mapping table above).

## 7. What was intentionally left out (Phase 2+)

- WhatsApp/Twilio automation engine + webhook receiver
- OTP login channel (scaffold ready in `User.phone`)
- File/storage (replace Supabase storage with S3/Cloudflare R2)
- Parts & inventory module
- AI assistant (port the original `supabase/functions/ai-chat` into a new
  `modules/ai` route hitting OpenAI directly)
- Realtime — replace Supabase realtime with Socket.IO/SSE when needed
- pg_cron-style schedulers — use BullMQ or a worker process

These plug into the same architecture without schema redesign.

## 8. Production checklist

- Set strong `JWT_SECRET` (>= 64 random chars)
- Run behind HTTPS / a reverse proxy (nginx, Caddy, Cloudflare)
- Use a managed MySQL (PlanetScale, AWS RDS, DigitalOcean) with daily backups
- Apply `prisma migrate deploy` in CI, not `migrate dev`
- Tighten `CORS_ORIGIN` to your frontend domains
- Add a logger pipeline (pino + Loki/Datadog) — morgan is for dev only
- Add an APM (Sentry) — wire into `errorHandler`
