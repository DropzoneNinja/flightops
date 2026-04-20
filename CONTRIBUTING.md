# Contributing

Contributions are welcome. Please follow the guidelines below.

## Getting Started

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Commit using conventional commits (see below)
5. Push and open a Pull Request

## Development Setup

Start the development environment:

```bash
docker compose -f docker-compose.dev.yml up -d
```

Install and run the frontend:

```bash
cd frontend
npm install
npm run dev
```

Install and run the backend:

```bash
cd backend
npm install
npm run start:dev
```

Run database migrations:

```bash
cd backend
npm run migration:run
```

Generate a migration after entity changes:

```bash
cd backend
npm run migration:generate -- src/database/migrations/YourMigrationName
```

## Code Style

- Run `npm run lint` before committing
- Use Prettier for formatting (config included)
- Follow existing TypeScript patterns

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation changes
- `style:` formatting only
- `refactor:` code restructuring without behavior change
- `test:` adding or updating tests
- `chore:` maintenance

## Pull Request Process

1. Ensure all tests pass
2. Update documentation if your change affects behavior
3. Squash commits before merging
4. Request a review from a maintainer
