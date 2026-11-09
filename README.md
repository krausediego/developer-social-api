# Developer Social API

> A developer-focused social platform powered by GitHub activity.

Developer Social API is the backend of a personal project designed to transform GitHub activity into developer profiles, contribution statistics, coding streaks, and community challenges.

The project focuses on backend architecture, asynchronous processing, data consistency, and reliable integration with the GitHub API.

**Status:** 🚧 Work in progress — backend under active development.

## Tech Stack

| Technology       | Purpose                           |
| ---------------- | --------------------------------- |
| NestJS           | Backend framework                 |
| TypeScript       | Type-safe development             |
| PostgreSQL       | Relational database               |
| Drizzle ORM      | Database queries and migrations   |
| Redis            | Queue infrastructure              |
| BullMQ           | Background job processing         |
| Better Auth      | Authentication and GitHub OAuth   |
| Docker Compose   | Local infrastructure              |
| Pino             | Structured logging                |
| nestjs-i18n      | Internationalization (EN / pt-BR) |
| Swagger / Scalar | API documentation                 |
| Vitest           | Testing                           |

## Features

### Authentication & Profiles

- GitHub OAuth authentication
- Authenticated user profile management
- Public and private profile visibility
- GitHub account metadata integration
- User locale and timezone preferences
- Public developer profile endpoints

Profiles are **private by default** and can be explicitly published by their owners.

### GitHub Synchronization

- Automatic repository synchronization
- Commit collection per repository
- Paginated GitHub API requests
- Historical commit backfill
- Incremental synchronization
- Persistent synchronization cursors
- Idempotent database upserts
- Background processing with retries and deduplication
- Scheduled synchronization jobs

### Activity Tracking

GitHub contributions are normalized and stored in a shared activity event model.

Currently supported:

- Commit events

Planned activity sources:

- Pull requests opened
- Issues opened
- Pull request reviews submitted

These events will power daily activity statistics, developer streaks, and community challenges.

## Architecture

GitHub synchronization is handled asynchronously to avoid blocking HTTP requests.

```text
                NestJS Scheduler
                       |
                       v
              Check Sync Cursors
                       |
                       v
             Find Outdated Resources
                       |
                       v
                 Redis + BullMQ
                       |
                       v
                GitHub Sync Worker
                       |
                       v
                  GitHub API
                       |
                       v
              Validate & Normalize
                       |
                       v
                 PostgreSQL
                  (Drizzle)
                       |
          +------------+------------+
          |            |            |
          v            v            v
     Repositories    Activity     Sync Cursors
                      Events
```

### Synchronization Strategy

Each synchronization job operates on a specific resource context:

```typescript
interface GithubSyncContext {
  userId: string;
  resourceType: GithubSyncResource;
  repositoryId: string | null;
}
```

This design supports:

- Independent synchronization per resource
- Deduplication of concurrent jobs
- Historical backfills
- Incremental updates
- Per-resource expiration policies
- Retry handling
- Persistent synchronization progress

The scheduler periodically checks for outdated resources and enqueues jobs only when synchronization is required.

## Database

The application uses PostgreSQL with Drizzle ORM.

Some of the main tables include:

| Table                    | Responsibility                     |
| ------------------------ | ---------------------------------- |
| `app_profiles`           | Developer profile information      |
| `github_repositories`    | Repository metadata                |
| `user_repository_access` | User-to-repository associations    |
| `github_activity_events` | Normalized GitHub activity         |
| `github_sync_cursors`    | Synchronization state and progress |
| `user_daily_activities`  | Daily activity aggregates          |
| `user_follows`           | Developer relationships            |
| `challenges`             | Community challenges               |
| `challenge_participants` | Challenge enrollment               |
| `challenge_progress`     | Challenge progress tracking        |
| `challenge_achievements` | Challenge achievements             |

Authentication and organization data are managed through Better Auth.

## Getting Started

### Prerequisites

- Node.js
- pnpm
- Docker
- Docker Compose
- GitHub OAuth App credentials

### Installation

Clone the repository:

```bash
git clone https://github.com/krausediego/developer-social-api
cd ./developer-social-api
```

Install dependencies:

```bash
pnpm install
```

### Environment Variables

Configure your local environment using a `.env` file.

The application requires configuration for:

- PostgreSQL
- Redis
- Better Auth
- GitHub OAuth
- Application URLs and allowed origins

> Never commit `.env` files, OAuth secrets, access tokens, or database credentials.

### Start Infrastructure

Start PostgreSQL and Redis:

```bash
docker compose up -d
```

Apply the database migrations using the migration script configured in `package.json`.

### Run the Application

```bash
pnpm start:dev
```

The API runs locally with interactive documentation available through the configured Swagger / Scalar endpoint.

## API Endpoints

### Users

| Method  | Endpoint                      | Description               |
| ------- | ----------------------------- | ------------------------- |
| `GET`   | `/api/v1/users/me`            | Get authenticated user    |
| `PATCH` | `/api/v1/users/me`            | Update user profile       |
| `PATCH` | `/api/v1/users/me/visibility` | Update profile visibility |

### Profiles

| Method | Endpoint                        | Description                  |
| ------ | ------------------------------- | ---------------------------- |
| `GET`  | `/api/v1/profiles/:githubLogin` | Get public developer profile |

### GitHub Synchronization

| Method | Endpoint                     | Description                                  |
| ------ | ---------------------------- | -------------------------------------------- |
| `POST` | `/api/v1/github/sync`        | Request repository synchronization           |
| `POST` | `/api/v1/github/sync/ensure` | Ensure synchronization when data is outdated |
| `GET`  | `/api/v1/github/sync/status` | Get synchronization status                   |

GitHub synchronization also runs automatically through scheduled background jobs.

Development-only endpoints are not part of the intended public API.

## Roadmap

### Foundation

- [x] NestJS project setup
- [x] PostgreSQL and Drizzle ORM
- [x] GitHub OAuth authentication
- [x] User profile management
- [x] Public/private profile visibility
- [x] Internationalization
- [x] Structured logging
- [x] API documentation

### GitHub Integration

- [x] Repository synchronization
- [x] Redis and BullMQ integration
- [x] Background job processing
- [x] Scheduled synchronization
- [x] Synchronization cursors
- [x] Commit collection
- [x] Historical backfill
- [x] Incremental synchronization
- [x] Activity event persistence

### Activity & Social Features

- [ ] Daily activity aggregation
- [ ] Developer streak calculation from collected events
- [ ] Pull request synchronization
- [ ] Issue synchronization
- [ ] Review synchronization
- [ ] Developer following workflows
- [ ] Organization-based challenges
- [ ] Challenge progress tracking
- [ ] Challenge achievements

### Future

- [ ] Frontend application
- [ ] Production deployment
- [ ] Monitoring and observability improvements

## Privacy & Security

Privacy is an important part of the project.

- Developer profiles are private by default.
- Users control whether their profiles are publicly visible.
- GitHub OAuth tokens are handled through the authentication layer.
- Private repository details must not be exposed through public endpoints.
- Synchronization jobs operate within a user's authorized repository access.

This project is still under development and is not production-ready.

## Project Goals

Beyond building a social platform, this project explores practical backend engineering challenges:

- Designing modular and maintainable APIs
- Working with third-party integrations
- Processing asynchronous workloads
- Building reliable synchronization pipelines
- Handling pagination, retries, and rate limits
- Maintaining data consistency
- Designing efficient database models
- Supporting internationalization and privacy

## Contributing

This is currently a personal project under active development.

Contributions, feedback, and suggestions may be considered as the project evolves.

---

**Built with NestJS, TypeScript, and curiosity.**
