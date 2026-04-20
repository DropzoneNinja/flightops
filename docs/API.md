# API Documentation

All endpoints require a `Bearer` token in the `Authorization` header unless otherwise noted. Tokens are obtained via the login endpoint.

---

## Authentication

### Register
```http
POST /auth/register
Content-Type: application/json

{
  "email": "pilot@example.com",
  "password": "SecurePassword123"
}
```

> Registration requires the email to be pre-authorized by an admin. See [adding a pre-authorized email](#pre-authorized-emails).

### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "pilot@example.com",
  "password": "SecurePassword123"
}
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "pilot@example.com",
    "role": "user"
  }
}
```

### Pre-authorized Emails

Add an email to the whitelist via psql:
```bash
docker compose exec postgres psql -U flightops -d flightops -c \
  "INSERT INTO pre_authorized_emails (email, role) VALUES ('your@email.com', 'admin');"
```

---

## Sites

### List Sites
```http
GET /sites
```

### Create Site
```http
POST /sites
Content-Type: application/json

{
  "name": "Mountain Ridge",
  "takeoffLat": 52.3555,
  "takeoffLon": -1.1743,
  "parkingLat": 52.3550,
  "parkingLon": -1.1750
}
```

### Toggle Site Active Status
```http
PATCH /sites/:id/toggle
```

---

## Weather

### Get Site Forecast
```http
GET /weather/sites/:siteId/forecast
```

Response includes 3-day hourly forecasts with wind speed, gust speed, rain, temperature, and safety scores per hour.

### Trigger Manual Weather Update
```http
POST /weather/fetch
```

> Admin only.

---

## Media

### Upload Media
```http
POST /media
Content-Type: multipart/form-data

file:         <File>
flight_date:  2026-01-15
uploaded_by:  username
pilots:       ["Pilot 1", "Pilot 2"]
notes:        Optional notes
site_id:      uuid (optional)
```

### List Media by Date
```http
GET /media?date=2026-01-15
```

### List Media by Site
```http
GET /media?site=uuid
```

### Get Dates with Media Counts
```http
GET /media/dates/counts
```

### Get Sites with Media Counts
```http
GET /media/sites/counts
```

### Delete Media
```http
DELETE /media/:id
```

> Users can only delete their own media. Admins can delete any media.

---

## Settings

### Get Settings
```http
GET /settings
```

### Update Settings
```http
PATCH /settings
Content-Type: application/json

{
  "windThresholds": {
    "calm": 3,
    "optimal": 15,
    "marginal": 20,
    "highRisk": 25
  }
}
```

> Admin only.

---

## Environment Variables

### Backend

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DB_HOST` | PostgreSQL host | `localhost` | Yes |
| `DB_PORT` | PostgreSQL port | `5432` | Yes |
| `DB_USERNAME` | Database username | `flightops` | Yes |
| `DB_PASSWORD` | Database password | — | Yes |
| `DB_DATABASE` | Database name | `flightops` | Yes |
| `JWT_SECRET` | Secret for JWT signing | — | Yes |
| `JWT_EXPIRATION` | Token expiration | `7d` | No |
| `PORT` | Backend server port | `3000` | No |
| `NODE_ENV` | Environment | `development` | No |
| `WEATHER_UPDATE_INTERVAL` | Cron expression for weather updates | `0 */6 * * *` | No |
| `MAX_LOGIN_ATTEMPTS` | Max failed login attempts before lockout | `5` | No |
| `LOCKOUT_DURATION` | Account lockout duration (minutes) | `30` | No |
| `MEDIA_STORAGE_PATH` | Path for media file storage | `/app/media` | No |
| `MAX_UPLOAD_SIZE` | Maximum file upload size (bytes) | `524288000` | No |

### Frontend

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `VITE_API_URL` | Backend API URL | `http://localhost:3000` | Yes |
| `VITE_MAP_CENTER_LAT` | Default map center latitude | `51.5074` | No |
| `VITE_MAP_CENTER_LON` | Default map center longitude | `-0.1278` | No |
| `VITE_MAP_ZOOM` | Default map zoom level | `6` | No |
