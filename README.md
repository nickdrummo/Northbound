# Northbound

**Order Creation SaaS API** — A backend service for generating and managing standardized UBL 2.1 Order documents. Part of the SENG2021 project; designed for use by other teams as a shared API for the procurement process between Buyer and Seller parties.

---

## Table of contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the service](#running-the-service)
- [API overview](#api-overview)
- [Response format](#response-format)
- [Project structure](#project-structure)
- [Testing](#testing)
- [Deployment](#deployment)
- [Repository & support](#repository--support)

---

## Overview

Northbound provides:

- **Authentication** — User registration and login (JWT).
- **Health check** — Service status and uptime.
- **Orders** — Create orders, list them, retrieve UBL XML, **replace** an order (full payload) via **`PUT /orders/:id/change`** (or `/v1/orders/...`), **cancel** via **`POST /orders/:id/cancel`**, update **buyer/seller country** via **`PATCH /orders/:id/party-country`**, and manage **recurring** templates under **`/orders/recurring`**.
- **API documentation** — Interactive Swagger UI at `/docs`, backed by **OpenAPI 3** (`openapi.yaml`).

The API uses a **standard JSON response envelope** for success and error responses so integrating clients can handle them consistently.

---

## Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** 9+

---

## Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/CongeeZee/Northbound.git
   cd Northbound
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment** — See [Configuration](#configuration).

---

## Configuration

Create a `.env` file in the project root. The following variables are used:

| Variable | Required | Description |
| ---------- | ---------- | ------------- |
| `PORT` | No | Server port. Default: `3000`. |
| `NODE_ENV` | No | Set to `test` when running tests. |
| `JWT_SECRET` | Yes (for auth) | Secret used to sign and verify JWT tokens. Use a long, random string in production. |
| `SUPABASE_URL` | Yes (for orders) | Your Supabase project URL. |
| `SUPABASE_ANON_KEY` | Yes (for orders) | Supabase anonymous (public) key for API access. |
| `DEVEX_API_KEY` | No | [DevEx Despatch API](https://devex.cloud.tcore.network/api-docs/) key for `/orders/.../despatch` routes. |
| `DEVEX_API_BASE_URL` | No | Defaults to `https://devex.cloud.tcore.network`. |

**Example `.env` (do not commit this file):**

```env
PORT=3000
JWT_SECRET=your-secret-key-min-32-chars-for-production
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

Copy from `.env.example` if present and fill in the values. Ensure `.env` is listed in `.gitignore` (it is by default).

---

## Running the service

- **Development (TypeScript via ts-node, or run built JS):**

  ```bash
  npm run build
  npm start
  ```

  The server listens on `http://localhost:3000` (or the port set in `PORT`).

- **Production:** Run the compiled JavaScript:

  ```bash
  npm run build
  npm start
  ```

  `npm start` runs `node dist/server.js`.

---

## API overview

Base URL when running locally: **`http://localhost:3000`**. Deployed example: **`https://northbound-w6b3.onrender.com`**.

| Method | Path | Description |
| -------- | ------ | ------------- |
| **GET** | `/docs` | **Swagger UI** — Interactive API documentation. |
| **GET** | `/health` | Health check; returns status, uptime, and version. |
| **POST** | `/auth/register` | Register a new user. Body: `email`, `password`, `passwordConfirm`. |
| **POST** | `/auth/login` | Log in. Body: `email`, `password`. Returns `userID` and `token`. |
| **GET** | `/orders` or `/v1/orders` | List all orders. |
| **POST** | `/orders` or `/v1/orders/generate` | Create an order and generate UBL XML. Body: see [Order request body](#order-request-body) below. |
| **GET** | `/orders/:id` or `/v1/orders/:id` | Retrieve one order by ID (JSON). |
| **GET** | `/orders/:id/xml` or `/v1/orders/:id/xml` | Retrieve the UBL Order XML for order `id`. Returns `application/xml`. |
| **PATCH** | `/orders/:id/party-country` or `/v1/orders/:id/party-country` | Update buyer or seller **country** (ISO code); returns regenerated UBL XML. Requires Supabase. |
| **PATCH** | `/orders/:id/detail` or `/v1/orders/:id/detail` | Patch header fields (`currency`, `issue_date`, `order_note`) on a **non-recurring** order; returns regenerated UBL Order XML. Requires Supabase. |
| **POST** | `/orders/:id/response` or `/v1/orders/:id/response` | Body: `response_code` (required), optional `issue_date`, `note`. Returns UBL **OrderResponse** XML for an existing order (not stored). Requires Supabase. |
| **PUT** | `/orders/:id/change` or `/v1/orders/:id/change` | Replace the order with a **full** new payload (same shape as create); same `id`; returns updated UBL XML. Requires Supabase. |
| **POST** | `/orders/:id/cancel` or `/v1/orders/:id/cancel` | Cancel (delete) the order and its line items; returns `orderID`. Requires Supabase. |
| **POST** | `/orders/recurring` or `/v1/orders/recurring` | Create a recurring order template. |
| **PATCH** | `/orders/recurring/:id` or `/v1/orders/recurring/:id` | Partial update of a recurring order (optional fields include `currency`, schedule, parties, `order_lines`). |
| **DELETE** | `/orders/recurring/:id` or `/v1/orders/recurring/:id` | Delete a recurring order template. |
| **GET** | `/orders/despatch/list` or `/v1/orders/despatch/list` | **DevEx integration:** list Despatch Advice records for your API key (requires `DEVEX_API_KEY`). |
| **POST** | `/orders/:id/despatch` or `/v1/orders/:id/despatch` | **DevEx integration:** send this order’s UBL Order XML to DevEx to create Despatch Advice (`DEVEX_API_KEY`). |
| **GET** | `/orders/:id/despatch?adviceId=<uuid>` | **DevEx integration:** retrieve Despatch Advice (by `adviceId`, or omit for lookup by order XML). |
| **POST** | `/auth/forgot-password` | Request a password reset (email in body). |
| **POST** | `/auth/reset-password` | Complete reset with `token` and `newPassword`. |
| **POST** | `/auth/logout` | Revoke JWT (`Authorization: Bearer …`). |

For full request/response schemas and examples, use **Swagger UI** at **`GET /docs`** after starting the server (spec: OpenAPI 3.0).

### Order request body

Create-order and **change-order** requests use this JSON shape (e.g. `POST /orders`, `POST /v1/orders/generate`, or **`PUT /orders/{id}/change`**):

```json
{
  "buyer": {
    "external_id": "BUYER-001",
    "name": "Example Buyer Pty Ltd",
    "email": "buyer@example.com",
    "street": "123 Market St",
    "city": "Sydney",
    "country": "AU",
    "postal_code": "2000"
  },
  "seller": {
    "external_id": "SELLER-001",
    "name": "Example Seller Pty Ltd"
  },
  "currency": "AUD",
  "issue_date": "2025-03-10",
  "order_note": "Optional note",
  "order_lines": [
    {
      "line_id": "1",
      "description": "Wireless Keyboard",
      "quantity": 2,
      "unit_price": 49.99,
      "unit_code": "EA"
    }
  ]
}
```

- **Required:** `buyer`, `seller`, `currency`, `issue_date` (YYYY-MM-DD), `order_lines` (non-empty array). Each party needs `external_id` and `name`. Each line needs `line_id`, `description`, `quantity`, `unit_price`.
- **Optional:** `order_note`; party fields `email`, `street`, `city`, `country`, `postal_code`; line field `unit_code` (defaults to `EA`).

---

## Response format

All JSON responses (except raw XML from `/v1/orders/:id/xml`) follow this envelope:

**Success:**

```json
{
  "success": true,
  "message": "Human-readable message",
  "data": { ... },
  "error": null
}
```

**Error:**

```json
{
  "success": false,
  "message": "Short description",
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Detailed message",
    "validationErrors": []
  }
}
```

- `validationErrors` is optional and used for validation failures (e.g. field-level errors).
- Use `success` to decide whether to read `data` or `error`. HTTP status codes still reflect the outcome (4xx client errors, 5xx server errors).

---

## Project structure

```text
Northbound/
├── src/
│   ├── app.ts              # Express app: middleware, routes, /docs
│   ├── server.ts           # Entry point: starts HTTP server
│   ├── errors.ts           # Standard response helpers (ok, fail, AppError)
│   ├── auth/               # Registration, login, JWT
│   ├── health/             # Health check route
│   ├── orders/             # Order CRUD, UBL generation, storage
│   └── validation/         # Order input validation
├── openapi.yaml            # OpenAPI 3.0 spec for API docs (Swagger UI)
├── package.json
├── tsconfig.json
└── .env                    # Not committed; copy from .env.example
```

- **Other teams:** Use the same base URL (e.g. deployed `https://northbound-w6b3.onrender.com` or local `http://localhost:3000`). Use `/auth/login` or `/auth/register` for a token; send `Authorization: Bearer <token>` when required. Use `POST /orders` or `POST /v1/orders/generate` to create orders; use **`PUT /orders/{orderID}/change`** to replace an order (full body); use **`POST /orders/{orderID}/cancel`** to cancel. See [Order request body](#order-request-body) or Swagger UI at `/docs`.

---

## Testing

- **Run all tests**

  ```bash
  npm test
  ```

  Uses Jest; test files sit next to source (e.g. `*.test.ts`).

- **Test environment:** Set `NODE_ENV=test` (or the test runner does). Ensure `.env` or test setup provides any required env vars (e.g. `JWT_SECRET`, Supabase) for tests that hit the API or DB.

---

## Deployment

The API can be deployed to any Node-friendly host (e.g. Render, Vercel, Railway). Ensure the following are set in the environment:

- `PORT` (if required by the platform)
- `JWT_SECRET` (required for auth)
- `SUPABASE_URL` and `SUPABASE_ANON_KEY` (required for order storage and retrieval)

**Live example:** [https://northbound-w6b3.onrender.com](https://northbound-w6b3.onrender.com) — the root URL redirects to Swagger UI at [/docs](https://northbound-w6b3.onrender.com/docs/); health check at `/health`.

---

## Repository & support

- **Repository:** [github.com/CongeeZee/Northbound](https://github.com/CongeeZee/Northbound)
- **Issues:** [GitHub Issues](https://github.com/CongeeZee/Northbound/issues)

For integration questions or bugs, open an issue or contact the Northbound team.
