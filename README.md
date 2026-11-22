# SocialFlow

SocialFlow is a social media workspace with account authentication, OAuth account linking, post and schedule storage, analytics, and an AI-assisted planner.

## Quick start

```bash
npm install
npm install --prefix backend
npm install --prefix frontend
copy .env.example .env
npm run dev
```

Open `http://localhost:5173` and create an account. There is no seeded user or sample account. The backend creates and persists its SQLite database at `backend/data/socialflow.sqlite` by default; set `DB_PATH` to use another persistent location.

`npm run db:reset` destructively recreates the SQLite database with an empty schema. It does not create demo users or records.

## Configuration

The backend reads environment variables for authentication secrets, OAuth clients, and AI generation. Set the social provider client credentials listed in `.env.example` and register each callback URL with the matching provider app:

`http://localhost:4000/api/social/callback/{platform}`

Use the public HTTPS API URL for production OAuth callbacks. Provider app review, enabled scopes, and account eligibility are controlled by each social platform.

AI Studio and the planner require both `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL`. They return an error when the provider is not configured; they do not generate placeholder content.

## Data and publishing

The API reads and writes user-scoped records in SQLite. Dashboard statistics, calendar entries, activity, connected accounts, posts, and plans are based on saved records. The dashboard refreshes periodically while open.

OAuth account linking stores provider tokens encrypted at rest. The application does not currently have provider-specific post publishing adapters. Immediate and scheduled publishing will report a failure rather than mark a post as published when no real provider publish call has occurred.

Telegram uses a separate bot/login integration and is not supported by the OAuth adapter.

## Docker

```bash
docker compose up --build
```

API docs are at `http://localhost:4000/api/docs`.

## Architecture

React/Vite SPA → Express REST API → persistent SQLite database → scheduled job worker.

Security features include bcrypt password hashing, short-lived access JWTs, refresh tokens, AES-256-GCM token encryption, Zod validation, Helmet, CORS, rate limits, OAuth state/PKCE, and per-user authorization.
