# Agilite - Customer Support Ticketing System

A full-stack customer support platform where customers browse products, create support tickets, and have real-time conversations with support agents. Built with a modern stack featuring role-based access, real-time notifications, and an analytics dashboard.

---

## Key Values

- **Real-time communication** -- Live ticket conversations powered by Socket.io, with instant in-app and email notifications so no message goes unnoticed.
- **Role-based experience** -- Distinct interfaces for customers (product browsing, ticket creation) and admins (dashboard analytics, team management), each tailored to their workflow.
- **Type-safe monorepo** -- Shared Zod schemas between client and server ensure validation consistency across the entire stack, catching issues at compile time.
- **Production-ready patterns** -- JWT authentication, paginated/filterable/sortable data tables, skeleton loaders, dark mode, and responsive design out of the box.

---

## Tech Stack

| Layer        | Technology                          |
| ------------ | ----------------------------------- |
| Frontend     | Next.js (App Router), shadcn/ui, Tailwind CSS |
| Backend      | Node.js, Express, Socket.io        |
| Database     | PostgreSQL, Kysely (query builder)  |
| Validation   | Zod (shared between client/server) |
| Auth         | JWT + bcrypt                        |
| Email        | Resend                              |
| Testing      | Jest (API tests), Playwright (E2E)  |
| Package Mgr  | Yarn workspaces                     |

---

## Installation & Local Setup

### Prerequisites

- **Node.js** v18+
- **Yarn**
- **Docker & Docker Compose** (for the PostgreSQL database)

### Steps

1. **Clone the repository**

   ```bash
   git clone https://github.com/wolfbela/holon-project.git
   cd holon-project
   ```

2. **Start the database**

   ```bash
   docker compose up -d
   ```

   This launches a PostgreSQL 16 container on port 5432.

3. **Install dependencies**

   ```bash
   yarn install
   ```

4. **Configure environment variables**

   ```bash
   cp .env.example .env
   ```

   The defaults in `.env.example` work out of the box for local development. The only values you may want to customize:

   | Variable         | Default / Notes                                |
   | ---------------- | ---------------------------------------------- |
   | `DATABASE_URL`   | `postgresql://postgres:postgres@localhost:5432/agilite` (matches Docker Compose) |
   | `JWT_SECRET`     | Replace with any random string                 |
   | `RESEND_API_KEY` | Optional -- email notifications won't send without it, but the app works fine |

5. **Run database migrations**

   ```bash
   yarn db:migrate
   ```

6. **Seed the database**

   ```bash
   yarn seed
   ```

7. **Start the development servers**

   ```bash
   yarn dev
   ```

   - Frontend: http://localhost:3000
   - Backend: http://localhost:5000

---

## Admin Credentials

After running the seed (`yarn seed`), the following accounts are available:

| Role     | Email                    | Password      |
| -------- | ------------------------ | ------------- |
| Admin    | `admin@holon.com`        | `admin123`    |
| Customer | `customer1@example.com`  | `customer123` |
| Customer | `customer2@example.com`  | `customer123` |

Admins are redirected to `/dashboard`, customers to `/products`.

---

## About the Test Files

This repository intentionally includes its test suites and test artifacts (reports, results) in the codebase. They are kept to **showcase the development workflow and quality process** used throughout the project:

- **`server/tests/`** -- Jest API tests covering authentication, tickets, replies, notifications, admin endpoints, Socket.io events, and infrastructure setup (health checks, Kysely, ESLint/Prettier configuration).
- **`client/e2e/`** -- Playwright end-to-end tests covering all user-facing flows: login, registration, product catalog, ticket creation, admin dashboard, team management, routing/auth guards, and more.
- **`client/playwright-report/`** and **`client/test-results/`** -- Generated HTML reports and failure screenshots from Playwright runs.

These files demonstrate a **test-driven development approach** where features are validated through automated tests at both the API and UI level. They are left in the repository so reviewers can inspect the testing strategy, run the suites themselves, and see the coverage of the application.

### Running the tests

```bash
# API tests (Jest)
yarn test

# E2E tests (Playwright) -- requires the app to be running
cd client && npx playwright test
```

---

## Project Structure

```
holon-project/
├── client/             # Next.js frontend (App Router)
│   ├── app/            # Pages (auth, customer, admin)
│   ├── components/     # Reusable UI components
│   ├── e2e/            # Playwright E2E tests
│   └── lib/            # Utilities, API client, socket client
├── server/             # Express backend
│   ├── src/
│   │   ├── routes/     # API route handlers
│   │   ├── services/   # Business logic
│   │   ├── db/         # Kysely setup, migrations, seed
│   │   ├── socket/     # Socket.io event handlers
│   │   └── email/      # Resend email templates
│   └── tests/          # Jest API tests
├── shared/             # Shared Zod schemas & TypeScript types
├── docker-compose.yml  # PostgreSQL for local development
└── package.json        # Root workspace config
```

---

## License

This project was built as a home assignment for Agilite Full Stack Developer position.
