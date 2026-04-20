![Throttle Junkies](raw/Throttle%20Junkies.png)

# FlightOps

A full-stack web application for paramotor (PPG) pilots to assess weather conditions across multiple flying sites from a single interface.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Features

**Interactive Map**
An interactive map displays all flight sites as color-coded markers reflecting current weather safety scores. Markers cluster when zoomed out, and clicking any marker shows a per-site weather summary with a 3-day hourly breakdown.

**Weather Forecasts**
Weather data is fetched automatically from [Open-Meteo](https://open-meteo.com) on a configurable schedule. Each site shows heat bars for wind, gusts, rain, and cloud conditions scored green, yellow, or red. All thresholds are configurable via the settings page.

**Site Management**
Pilots can add, edit, enable, or disable flight sites. Each site stores takeoff and parking coordinates. Sites are shared across all users.

**Media Gallery**
Upload photos and videos from flights and browse them by date or site. A calendar view shows which dates have media; a map view shows which sites have media. Thumbnails are generated automatically and a full-screen viewer supports keyboard and swipe navigation.

**Mobile Support**
The UI is fully responsive with a breakpoint at 900px. On mobile, a bottom navigation bar and swipeable forecast cards replace the desktop layout. Controls are sized for one-handed outdoor use.

**Mission Planning**
Pilots can plan flights by building waypoint routes on an interactive map. Each mission calculates per-leg distance, estimated flight time, and fuel burn based on configurable speed, fuel consumption rate, and wind conditions. Missions can be linked to a launch site, searched and filtered, and annotated with notes and media. Only the creator (or an admin) can edit a mission; other users can view it and adjust local performance assumptions without saving.

**User Management**
Registration is restricted to pre-authorized emails managed by an admin. Authentication uses JWT. Admins have extended permissions including triggering weather updates and managing settings.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Tailwind CSS, Vite, Leaflet |
| Backend | NestJS, TypeScript, Node.js |
| Database | PostgreSQL 15, TypeORM |
| Auth | JWT + Passport |
| Weather | Open-Meteo API (no key required) |
| Infrastructure | Docker, Docker Compose |

---

## Deployment

Images are published to GitHub Container Registry on each version tag. To deploy or update a running instance:

```bash
docker compose pull
docker compose up -d
```

### First-time Setup

1. Copy and configure environment files:

   ```bash
   cp .env.example .env
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

   Edit `backend/.env` with your database credentials and a strong `JWT_SECRET`. See [docs/API.md](docs/API.md) for all available variables.

2. Start the stack:

   ```bash
   docker compose up -d
   ```

3. Run database migrations:

   ```bash
   docker compose exec backend npm run migration:run
   ```

4. Add your first admin user to the pre-authorized emails list:

   ```bash
   docker compose exec postgres psql -U flightops -d flightops -c \
     "INSERT INTO pre_authorized_emails (email, role) VALUES ('your@email.com', 'admin');"
   ```

5. Register at `http://your-host/register`.

### Version Management

```bash
npm --prefix ./frontend version 1.2.0 --no-git-tag-version
npm --prefix ./backend version 1.2.0 --no-git-tag-version
git add frontend/package.json backend/package.json
git commit -m "v1.2.0"
git tag v1.2.0
git push && git push --tags
```

Pushing a tag triggers the GitHub Actions build workflow, which pushes new images to the registry. Run `docker compose pull && docker compose up -d` on the server once the build completes (~3-5 minutes).

---

## Documentation

- [API Reference](docs/API.md)
- [Contributing](docs/CONTRIBUTING.md)
- [Operations](OPERATIONS.md)

---

## License

MIT. See [LICENSE](LICENSE).
