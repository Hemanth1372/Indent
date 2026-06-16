# NCC Indent API

Node/Express REST API for NCC Indent identity, project tenancy, RBAC, and master data.

## Setup

1. Create a PostgreSQL database.
2. Run `schema.sql`.
3. Copy `.env.example` to `.env` and update the values.
4. Run `npm install`.
5. Run `npm run dev`.

## Routes

- `POST /api/auth/login`
- `GET /api/users`
- `POST /api/users`
- `GET /api/projects`
