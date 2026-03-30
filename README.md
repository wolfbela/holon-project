# Holon - Customer Support Ticketing System

A full-stack customer support ticketing system where customers can browse products, create support tickets, and have real-time conversations with support agents. Built as a modern, polished web application with role-based access, real-time notifications, and analytics dashboard.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [WebSocket Events](#websocket-events)
- [Authentication & Authorization](#authentication--authorization)
- [Notification System](#notification-system)
- [Pages & Features](#pages--features)
- [UI/UX Design](#uiux-design)
- [Extra Features](#extra-features)
- [Setup Instructions](#setup-instructions)
- [Deployment](#deployment)
- [Environment Variables](#environment-variables)
- [Seed Data](#seed-data)

---

## Overview

Holon is a 4+ page web application that simulates a real customer support ticketing system. Each ticket is related to a product fetched from the [Fake Store API](https://api.escuelajs.co/api/v1/products).

The application serves two types of users:

- **Customers**: Browse products, create support tickets from product pages, track their tickets, and have conversations with support agents.
- **Admins (Agents)**: View all tickets on a dashboard with KPIs and charts, respond to customer tickets, manage ticket status and priority, and manage the support team.

---

## Tech Stack

| Layer                      | Technology                       | Why                                                                       |
| -------------------------- | -------------------------------- | ------------------------------------------------------------------------- |
| **Frontend**               | Next.js (App Router)             | File-based routing, SSR, middleware for auth, one-click Vercel deploy     |
| **UI Components**          | shadcn/ui                        | Consistent, accessible, customizable component library                    |
| **Styling**                | Tailwind CSS                     | Utility-first, rapid styling, pairs perfectly with shadcn                 |
| **Backend**                | Node.js + Express                | Separate server as required, REST API, Socket.io integration              |
| **Database**               | PostgreSQL                       | Relational model fits tickets/replies/users, strong typing with Kysely    |
| **Query Builder**          | Kysely                           | Fully type-safe SQL queries, lightweight (no code generation like Prisma) |
| **Validation**             | Zod + React Hook Form            | Shared validation schemas between client and server, type inference       |
| **Auth**                   | JWT + bcrypt                     | Stateless authentication, role-based access control                       |
| **Real-time**              | Socket.io                        | WebSocket with auto-reconnection, rooms for ticket-level updates          |
| **Email**                  | Resend                           | Modern email API, simple integration, free tier (100 emails/day)          |
| **Charts**                 | shadcn/ui charts (Recharts)      | Consistent with design system, dark mode support built-in                 |
| **Package Manager**        | Yarn (workspaces)                | Monorepo workspace support, fast installs                                 |
| **Local DB**               | Docker Compose (PostgreSQL only) | One command database setup, no local PostgreSQL install needed            |
| **Hosting (Frontend)**     | Vercel                           | Native Next.js support, free tier                                         |
| **Hosting (Backend + DB)** | Railway                          | No cold starts, backend + PostgreSQL in one project                       |

---

## Architecture

### Monorepo Structure

```
holon-project/
├── client/                  # Next.js frontend
│   ├── app/                 # App Router pages
│   │   ├── (auth)/          # Login, Register (public)
│   │   ├── (customer)/      # Customer-facing pages
│   │   │   ├── products/    # Product catalog
│   │   │   │   └── [id]/    # Product detail page
│   │   │   └── my-tickets/  # Customer tickets
│   │   │       └── [id]/    # Ticket detail + conversation
│   │   ├── (admin)/         # Admin-facing pages
│   │   │   ├── dashboard/   # KPIs + charts
│   │   │   ├── tickets/     # All tickets table
│   │   │   │   └── [id]/    # Ticket detail + conversation
│   │   │   ├── products/    # Products table (simple)
│   │   │   └── team/        # Manage admin users
│   │   └── page.tsx         # Landing page
│   ├── components/          # Reusable UI components
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # Utilities, API client, socket client
│   └── styles/              # Global styles
├── server/                  # Express backend
│   ├── src/
│   │   ├── routes/          # API route handlers
│   │   ├── middleware/      # Auth, validation, error handling
│   │   ├── services/        # Business logic
│   │   ├── db/              # Kysely setup, migrations, seed
│   │   ├── socket/          # Socket.io event handlers
│   │   ├── email/           # Resend email templates
│   │   └── index.ts         # Express + Socket.io server entry
│   └── package.json
├── shared/                  # Shared code between client & server
│   └── types/
│       ├── ticket.ts        # Ticket interfaces + Zod schemas
│       ├── reply.ts         # Reply interfaces + Zod schemas
│       ├── user.ts          # User interfaces + Zod schemas
│       ├── notification.ts  # Notification interfaces + Zod schemas
│       └── api.ts           # Request/Response shapes
├── docker-compose.yml       # PostgreSQL for local development
├── package.json             # Root workspace config
├── pnpm-workspace.yaml      # Workspace definition
└── README.md
```

### Data Flow

```
Customer Browser ──► Next.js (Vercel) ──► Express API (Railway) ──► PostgreSQL (Railway)
                                    ◄──── Socket.io (real-time) ◄────
                                    ──► Fake Store API (products proxy)
                                    ──► Resend (email notifications)
```

---

## Database Schema

### Table: `users`

| Column     | Type         | Constraints                            |
| ---------- | ------------ | -------------------------------------- |
| id         | UUID         | PRIMARY KEY, DEFAULT gen_random_uuid() |
| email      | VARCHAR(255) | UNIQUE, NOT NULL                       |
| name       | VARCHAR(255) | NOT NULL                               |
| password   | VARCHAR(255) | NOT NULL (bcrypt hashed)               |
| role       | VARCHAR(20)  | NOT NULL ('customer' / 'admin')        |
| created_at | TIMESTAMP    | DEFAULT NOW()                          |
| updated_at | TIMESTAMP    | DEFAULT NOW()                          |

### Table: `tickets`

| Column       | Type         | Constraints                                            |
| ------------ | ------------ | ------------------------------------------------------ |
| id           | UUID         | PRIMARY KEY, DEFAULT gen_random_uuid()                 |
| display_id   | VARCHAR(20)  | UNIQUE, NOT NULL (format: TK-0001)                     |
| user_id      | UUID         | FOREIGN KEY → users(id), NOT NULL                      |
| email        | VARCHAR(255) | NOT NULL                                               |
| name         | VARCHAR(255) | NOT NULL                                               |
| product_id   | INTEGER      | NOT NULL (Fake Store API product ID)                   |
| product_name | VARCHAR(255) | NOT NULL (cached from API)                             |
| subject      | VARCHAR(255) | NOT NULL                                               |
| message      | TEXT         | NOT NULL                                               |
| status       | VARCHAR(20)  | NOT NULL, DEFAULT 'open' ('open' / 'closed')           |
| priority     | VARCHAR(20)  | NOT NULL, DEFAULT 'medium' ('low' / 'medium' / 'high') |
| created_at   | TIMESTAMP    | DEFAULT NOW()                                          |
| updated_at   | TIMESTAMP    | DEFAULT NOW()                                          |

### Table: `replies`

| Column      | Type        | Constraints                                           |
| ----------- | ----------- | ----------------------------------------------------- |
| id          | UUID        | PRIMARY KEY, DEFAULT gen_random_uuid()                |
| ticket_id   | UUID        | FOREIGN KEY → tickets(id) ON DELETE CASCADE, NOT NULL |
| user_id     | UUID        | FOREIGN KEY → users(id), NOT NULL                     |
| author_type | VARCHAR(20) | NOT NULL ('customer' / 'agent')                       |
| message     | TEXT        | NOT NULL                                              |
| created_at  | TIMESTAMP   | DEFAULT NOW()                                         |

### Table: `notifications`

| Column     | Type         | Constraints                                             |
| ---------- | ------------ | ------------------------------------------------------- |
| id         | UUID         | PRIMARY KEY, DEFAULT gen_random_uuid()                  |
| user_id    | UUID         | FOREIGN KEY → users(id) ON DELETE CASCADE, NOT NULL     |
| type       | VARCHAR(30)  | NOT NULL ('new_ticket' / 'new_reply' / 'ticket_closed') |
| ticket_id  | UUID         | FOREIGN KEY → tickets(id) ON DELETE CASCADE, NOT NULL   |
| message    | VARCHAR(500) | NOT NULL                                                |
| read       | BOOLEAN      | DEFAULT false                                           |
| created_at | TIMESTAMP    | DEFAULT NOW()                                           |

### Relationships

```
users (1) ──── (N) tickets
users (1) ──── (N) replies
users (1) ──── (N) notifications
tickets (1) ──── (N) replies
tickets (1) ──── (N) notifications
```

---

## API Endpoints

Base URL: `/api`

### Auth

| Method | Endpoint         | Auth          | Description                     |
| ------ | ---------------- | ------------- | ------------------------------- |
| POST   | `/auth/register` | Public        | Register a new customer account |
| POST   | `/auth/login`    | Public        | Login, returns JWT token        |
| GET    | `/auth/me`       | Authenticated | Get current user from token     |

**POST `/auth/register`** — Request body:

```json
{
  "email": "customer@example.com",
  "name": "John Doe",
  "password": "securepassword"
}
```

Role is always `customer`. Admins are created via seed or admin panel.

**POST `/auth/login`** — Request body:

```json
{
  "email": "customer@example.com",
  "password": "securepassword"
}
```

Response: JWT token + user object (id, email, name, role).

---

### Tickets

| Method | Endpoint         | Auth          | Description                              |
| ------ | ---------------- | ------------- | ---------------------------------------- |
| POST   | `/tickets`       | Customer      | Create a new ticket                      |
| GET    | `/tickets`       | Authenticated | List tickets (admin: all, customer: own) |
| GET    | `/tickets/:id`   | Authenticated | Get single ticket with replies           |
| PUT    | `/tickets/:id`   | Authenticated | Update ticket (status, priority)         |
| DELETE | `/tickets/:id`   | Admin         | Delete a ticket                          |
| GET    | `/tickets/stats` | Admin         | Dashboard analytics data                 |

**POST `/tickets`** — Request body:

```json
{
  "product_id": 1,
  "product_name": "Fjallraven Backpack",
  "subject": "Product arrived damaged",
  "message": "The zipper on my backpack was broken when it arrived..."
}
```

Email and name are pulled from the authenticated user's JWT. Generates a sequential `display_id` (TK-0001). Sets `status='open'` and `priority='medium'` by default.

**GET `/tickets`** — Query parameters:

| Param    | Type   | Description                                                  |
| -------- | ------ | ------------------------------------------------------------ |
| status   | string | Filter by status: `open`, `closed`                           |
| priority | string | Filter by priority: `low`, `medium`, `high`                  |
| search   | string | Search by subject or customer name                           |
| sort     | string | Sort field: `created_at`, `updated_at`, `priority`, `status` |
| order    | string | Sort direction: `asc`, `desc`                                |
| page     | number | Page number (default: 1)                                     |
| limit    | number | Items per page (default: 10)                                 |

Response includes pagination metadata:

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 42,
    "totalPages": 5
  }
}
```

**GET `/tickets/stats`** — Response:

```json
{
  "total": 42,
  "open": 28,
  "closed": 14,
  "byPriority": {
    "low": 10,
    "medium": 22,
    "high": 10
  },
  "avgResponseTime": "2h 30m"
}
```

---

### Replies

| Method | Endpoint               | Auth          | Description                  |
| ------ | ---------------------- | ------------- | ---------------------------- |
| POST   | `/tickets/:id/replies` | Authenticated | Add a reply to a ticket      |
| GET    | `/tickets/:id/replies` | Authenticated | Get all replies for a ticket |

**POST `/tickets/:id/replies`** — Request body:

```json
{
  "message": "We're sorry about the damage. We'll send a replacement right away."
}
```

`author_type` is determined from the authenticated user's role (`customer` or `agent`).

---

### Notifications

| Method | Endpoint                  | Auth          | Description                      |
| ------ | ------------------------- | ------------- | -------------------------------- |
| GET    | `/notifications`          | Authenticated | Get current user's notifications |
| PUT    | `/notifications/:id/read` | Authenticated | Mark a notification as read      |
| PUT    | `/notifications/read-all` | Authenticated | Mark all notifications as read   |

---

### Admin — Team Management

| Method | Endpoint           | Auth  | Description                |
| ------ | ------------------ | ----- | -------------------------- |
| GET    | `/admin/users`     | Admin | List all admin users       |
| POST   | `/admin/users`     | Admin | Create a new admin account |
| DELETE | `/admin/users/:id` | Admin | Remove an admin account    |

**POST `/admin/users`** — Request body:

```json
{
  "email": "agent@holon.com",
  "name": "Jane Smith",
  "password": "securepassword"
}
```

Role is automatically set to `admin`.

---

### Products (Proxy)

| Method | Endpoint        | Auth          | Description                                      |
| ------ | --------------- | ------------- | ------------------------------------------------ |
| GET    | `/products`     | Authenticated | Get all products (proxied from Fake Store API)   |
| GET    | `/products/:id` | Authenticated | Get single product (proxied from Fake Store API) |

Products are fetched from `https://api.escuelajs.co/api/v1/products` and proxied through the Express backend to provide a unified API surface and consistent error handling.

---

## WebSocket Events

### Connection

Socket.io runs on the same Express server. Clients connect with their JWT token for authentication.

### Rooms Strategy

| Room                | Purpose                | Who Joins                              |
| ------------------- | ---------------------- | -------------------------------------- |
| `user:<userId>`     | Personal notifications | Each authenticated user                |
| `ticket:<ticketId>` | Live ticket updates    | Anyone viewing that ticket detail page |
| `dashboard`         | New ticket alerts      | Admins on the dashboard page           |

### Client → Server Events

| Event          | Payload        | Description                                            |
| -------------- | -------------- | ------------------------------------------------------ |
| `join_ticket`  | `{ ticketId }` | User opens a ticket detail page, joins the ticket room |
| `leave_ticket` | `{ ticketId }` | User leaves the ticket detail page                     |

### Server → Client Events

| Event              | Payload             | Sent To                  | Description                       |
| ------------------ | ------------------- | ------------------------ | --------------------------------- |
| `new_reply`        | Reply object        | `ticket:<ticketId>` room | New reply added to a ticket       |
| `ticket_updated`   | Ticket object       | `ticket:<ticketId>` room | Ticket status or priority changed |
| `ticket_created`   | Ticket summary      | `dashboard` room         | New ticket created (admin alert)  |
| `new_notification` | Notification object | `user:<userId>` room     | Personal notification for user    |

### Real-time Flow Examples

**Customer creates a ticket:**

1. POST `/api/tickets` saves ticket to database
2. Server emits `ticket_created` to `dashboard` room → admins see it live
3. Server creates notification for all admins, emits `new_notification` to each `user:<adminId>`
4. Resend sends confirmation email to the customer

**Agent replies to a ticket:**

1. POST `/api/tickets/:id/replies` saves reply to database
2. Server emits `new_reply` to `ticket:<ticketId>` room → everyone on that page sees it
3. Server creates notification for the customer, emits `new_notification` to `user:<customerId>`
4. Resend sends email to customer with link to the ticket

**Customer replies to a ticket:**

1. POST `/api/tickets/:id/replies` saves reply to database
2. Server emits `new_reply` to `ticket:<ticketId>` room → everyone on that page sees it
3. Server creates notification for all admins, emits `new_notification` to each `user:<adminId>`

---

## Authentication & Authorization

### Flow

1. **Registration** (customers only): POST `/api/auth/register` → creates user with role `customer`
2. **Login**: POST `/api/auth/login` → validates credentials → returns JWT token
3. **Token storage**: JWT stored client-side (httpOnly cookie or localStorage)
4. **Protected routes**: Express middleware validates JWT and extracts user info
5. **Role-based access**: Middleware checks `user.role` for admin-only endpoints
6. **Frontend protection**: Next.js middleware redirects unauthenticated users to login

### Role Permissions

| Action                 | Customer         | Admin                    |
| ---------------------- | ---------------- | ------------------------ |
| Register               | Yes              | No (seed or admin panel) |
| Login                  | Yes              | Yes                      |
| Browse products        | Yes              | Yes                      |
| Create ticket          | Yes              | No                       |
| View own tickets       | Yes              | Yes (all tickets)        |
| Reply to own ticket    | Yes              | Yes (any ticket)         |
| Close/update ticket    | No               | Yes                      |
| Delete ticket          | No               | Yes                      |
| View dashboard & stats | No               | Yes                      |
| Manage team            | No               | Yes                      |
| Receive notifications  | Own tickets only | All tickets              |

### Admin Provisioning

- **Initial admin**: Created via database seed script
- **Additional admins**: Created from the admin panel (Team page)
- **No public admin registration**: Prevents unauthorized admin access

### Post-Login Redirect

| Role     | Redirect To  |
| -------- | ------------ |
| Customer | `/products`  |
| Admin    | `/dashboard` |

---

## Notification System

### In-App Notifications

- **Bell icon** in navbar (customer) / sidebar header (admin) with unread count badge
- Click bell → dropdown list of notifications
- Each notification links to the relevant ticket
- "Mark all as read" action

### Email Notifications (Resend)

| Trigger          | Recipient | Email Content                         |
| ---------------- | --------- | ------------------------------------- |
| Ticket created   | Customer  | Confirmation with ticket ID (TK-XXXX) |
| Agent replies    | Customer  | Reply preview + link to ticket        |
| Customer replies | Admin(s)  | Reply preview + link to ticket        |
| Ticket closed    | Customer  | Closure confirmation                  |

### Notification Types

| Type            | Trigger                 | Target                           |
| --------------- | ----------------------- | -------------------------------- |
| `new_ticket`    | Customer creates ticket | All admins                       |
| `new_reply`     | Someone replies         | Other party (customer or admins) |
| `ticket_closed` | Admin closes ticket     | Customer                         |

---

## Pages & Features

### Public Pages

#### Landing Page (`/`)

- Hero section with app description
- Feature highlights
- "Login" and "Register" call-to-action buttons
- Clean, professional first impression

#### Login Page (`/login`)

- Email + password form
- Link to registration
- Redirects based on role after login

#### Registration Page (`/register`)

- Name + email + password form (customer role only)
- Link to login
- Redirects to `/products` after registration

---

### Customer Pages

**Navbar:** `[Logo: Holon] [Products] [My Tickets] ---- [Bell] [Avatar/Logout]`

#### Products Catalog (`/products`)

- Grid layout of product cards fetched from the Fake Store API (via proxy)
- Each card displays: product image, title, price, category
- Visually appealing cards with hover effects
- Category filter
- Click card → navigate to product detail page

#### Product Detail (`/products/:id`)

- Full product page: large image, title, description, price, category
- Simulates a product/buying page
- **"Create Ticket" button** → opens a modal with ticket creation form
- Product is pre-selected in the form (product_id and product_name auto-filled)
- Modal form fields: Subject, Message (email and name from auth)
- On submit: ticket created, success toast, modal closes

#### My Tickets (`/my-tickets`)

- List/table of customer's own tickets
- Displays: ticket ID (TK-XXXX), subject, product name, status badge, priority badge, date
- Filter by status (open/closed)
- Click ticket → navigate to ticket detail

#### Ticket Detail (`/my-tickets/:id`)

- Ticket information: ID, status, priority, date created
- Product info: name, image (fetched from API)
- Subject and original message
- **Conversation thread**: chat-bubble style, customer messages on one side, agent messages on the other, with timestamps
- **Reply input**: text field + submit button to add a reply as customer
- Real-time: new replies appear live via Socket.io

---

### Admin Pages

**Sidebar:**

```
┌──────────────────────┐
│  Holon     [Bell] [Avatar]
│──────────────────────│
│  Dashboard           │
│  Tickets             │
│  Products            │
│  Team                │
│──────────────────────│
│  Logout              │
└──────────────────────┘
```

#### Dashboard (`/dashboard`)

- **KPI stat cards**: Total tickets, Open tickets, Closed tickets, Avg response time
- **Pie/donut chart**: Tickets by status (open vs closed)
- **Bar chart**: Tickets by priority (low, medium, high)
- **Recent tickets**: Quick list of latest tickets
- All data from `GET /api/tickets/stats`

#### Tickets (`/tickets`)

- Table view of ALL tickets from all customers
- Columns: Ticket ID, Customer Name, Subject, Product, Status, Priority, Date
- **Search**: by subject or customer name
- **Filters**: by status (open/closed), by priority (low/medium/high)
- **Sorting**: click column headers to sort
- **Pagination**: navigate between pages
- Click row → navigate to ticket detail

#### Ticket Detail (`/tickets/:id`)

- Same layout as customer ticket detail but with admin actions:
  - **Close ticket** button (changes status to 'closed')
  - **Reopen ticket** button (if closed)
  - **Change priority** (low/medium/high dropdown)
- Reply input sends as `author_type='agent'`
- Real-time updates via Socket.io

#### Products (`/products`)

- Simple **table view** (not the pretty cards — data-focused for admin)
- Columns: ID, Image thumbnail, Title, Price, Category
- Fetched from Fake Store API via proxy

#### Team (`/team`)

- Table of all admin users: Name, Email, Date Added
- **"Add Admin" button** → form modal (name, email, password)
- **Delete admin** action (with confirmation)

---

## UI/UX Design

### Design Direction

**Clean & Minimal with tasteful color accents.** White space, subtle borders, muted backgrounds with one or two strong accent colors for interactive elements, status badges, and CTAs.

### Design System (shadcn/ui)

- All components from shadcn/ui for consistency
- Tailwind CSS for custom styling
- Dark mode toggle (shadcn native theme support)
- Consistent spacing, typography, and color usage

### UX Patterns

| Pattern               | Implementation                                                                  |
| --------------------- | ------------------------------------------------------------------------------- |
| **Loading states**    | Skeleton loaders (shadcn `<Skeleton>`) for content, button spinners for actions |
| **Error handling**    | Toast notifications for action errors, inline form errors under fields          |
| **Empty states**      | Illustrative messages ("No tickets yet", "No notifications")                    |
| **Error boundary**    | Fallback UI if a page fails to load                                             |
| **Success feedback**  | Toast notifications for successful actions                                      |
| **Form validation**   | Real-time inline errors via Zod + React Hook Form                               |
| **Responsive design** | Mobile-friendly layouts, collapsible sidebar on mobile                          |

### Wow Effects

- **Smooth page transitions** with framer-motion
- **Skeleton loaders** instead of generic spinners
- **Toast notifications** for all user actions
- **Chat-bubble style** conversation thread (left/right aligned by role, different colors)
- **Dark mode toggle** with smooth transition
- **Hover effects** on product cards and table rows
- **Badge colors** for status (green=open, gray=closed) and priority (blue=low, yellow=medium, red=high)

---

## Extra Features

Beyond the base 4-page requirement:

| Feature                 | Description                                                  |
| ----------------------- | ------------------------------------------------------------ |
| **Authentication**      | Full JWT auth with customer/admin roles                      |
| **Dark Mode**           | System-wide theme toggle                                     |
| **Ticket Priority**     | Low/Medium/High with color-coded badges                      |
| **Search**              | Search tickets by subject or customer name                   |
| **Filters**             | Filter by status and priority                                |
| **Sorting**             | Sort by any column on tables                                 |
| **Pagination**          | Paginated tables and lists                                   |
| **Real-time Updates**   | Socket.io for live replies and notifications                 |
| **Notification System** | In-app bell + email notifications via Resend                 |
| **Dashboard Analytics** | KPI cards + charts (status distribution, priority breakdown) |
| **Team Management**     | Admin can add/remove other admin users                       |
| **Landing Page**        | Professional landing page for first impression               |
| **Product Detail Page** | Full product page with integrated ticket creation            |
| **Email Notifications** | Ticket confirmation and reply alerts via Resend              |

---

## Setup Instructions

### Prerequisites

- Node.js (v18+)
- Yarn
- Docker & Docker Compose (for local PostgreSQL)

### Local Development

1. **Clone the repository**

   ```bash
   git clone https://github.com/<your-username>/holon-project.git
   cd holon-project
   ```

2. **Start the database**

   ```bash
   docker compose up -d
   ```

3. **Install dependencies**

   ```bash
   yarn install
   ```

4. **Set up environment variables**

   ```bash
   cp .env.example .env
   ```

   Fill in the required values (see [Environment Variables](#environment-variables)).

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

   This starts both the Next.js frontend and Express backend concurrently.
   - Frontend: `http://localhost:3000`
   - Backend: `http://localhost:5000`

---

## Deployment

### Frontend — Vercel

1. Connect the GitHub repository to Vercel
2. Set the root directory to `client/`
3. Add environment variables in Vercel dashboard
4. Deploy

### Backend + Database — Railway

1. Create a new Railway project
2. Add a PostgreSQL service (click "Add Database")
3. Add a Node.js service pointing to the `server/` directory
4. Set environment variables in Railway dashboard
5. Railway auto-detects Node.js, runs `npm start`
6. Backend and database communicate via Railway's internal network

---

## Environment Variables

### Client (`client/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

### Server (`server/.env`)

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/agilite

# Auth
JWT_SECRET=your-jwt-secret-here
JWT_EXPIRES_IN=7d

# Email (Resend)
RESEND_API_KEY=your-resend-api-key

# Fake Store API
FAKE_STORE_API_URL=https://api.escuelajs.co/api/v1

# Server
PORT=5000
CLIENT_URL=http://localhost:3000
```

### Docker Compose (`docker-compose.yml`)

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=agilite
```

---

## Seed Data

The seed script (`yarn seed`) creates the following default data:

### Default Admin Account

```
Email:    admin@holon.com
Password: admin123
```

### Sample Customers

```
Email:    customer1@example.com
Password: customer123

Email:    customer2@example.com
Password: customer123
```

### Sample Data

- 5-10 tickets across different statuses (open/closed) and priorities (low/medium/high)
- Multiple replies per ticket to demonstrate conversation threads
- Notifications for both admin and customer accounts

---

## Validation Schemas (Shared)

All validation schemas are defined with Zod in `shared/types/` and used on both client (React Hook Form) and server (Express middleware).

### Ticket Creation Schema

```typescript
{
  product_id: z.number().positive(),
  product_name: z.string().min(1),
  subject: z.string().min(1).max(255),
  message: z.string().min(1).max(5000)
}
```

### Reply Schema

```typescript
{
  message: z.string().min(1).max(5000);
}
```

### Registration Schema

```typescript
{
  email: z.string().email(),
  name: z.string().min(1).max(255),
  password: z.string().min(6).max(100)
}
```

### Login Schema

```typescript
{
  email: z.string().email(),
  password: z.string().min(1)
}
```

---

## Ticket ID Format

Tickets use a human-readable sequential format: **TK-0001**, **TK-0002**, etc.

- Generated server-side on ticket creation
- UUID remains the internal primary key
- Display ID is shown in the UI, emails, and URLs for a professional support system feel

---

## License

This project was built as a home assignment for Agilite Full Stack Developer position.
