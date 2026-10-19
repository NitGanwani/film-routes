# film-routes

Guided film routes for one specific person: build a short path of films with
notes, send it, and see how each film lands.

> Work in progress. The product idea is in [docs/concept.md](docs/concept.md).

## Structure

```
apps/api         Express 5 + TypeScript + Prisma 7 (PostgreSQL)
packages/shared  Constants and types shared by the API and the web client
docs/            Product and design documentation
```

The web client (`apps/web`) is planned and not created yet.

## Requirements

- Node.js 24 (see `.nvmrc`)
- Docker (for the local PostgreSQL)

## Getting started

```bash
npm install

# Local database
docker compose up -d

# API environment
cp apps/api/.env.example apps/api/.env

# Generate the Prisma client and create the tables
npm run db:generate -w @film-routes/api
npm run db:migrate -w @film-routes/api -- --name init

# Run the API (http://localhost:3000/health)
npm run dev:api
```

## Scripts

| Command                | What it does                      |
| ---------------------- | --------------------------------- |
| `npm run dev:api`      | API with hot reload               |
| `npm run build`        | Production build of every package |
| `npm run typecheck`    | TypeScript check                  |
| `npm run lint`         | ESLint                            |
| `npm run test`         | Unit and integration tests        |
| `npm run format:check` | Prettier check                    |

## Credits

Film data and images are provided by [TMDB](https://www.themoviedb.org/).
This product uses the TMDB API but is not endorsed or certified by TMDB.
