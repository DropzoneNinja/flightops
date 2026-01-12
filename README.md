# FlightOps - Paramotor Flight Site Weather Application

<div align="center">

![FlightOps Logo](frontend/public/logo.png)

**A full-stack web application for paramotor (PPG) pilots to visualize weather conditions at multiple flying sites**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)

[Features](#-features) • [Installation](#-installation--setup) • [Usage](#-usage) • [API Documentation](#-api-documentation) • [Contributing](#-contributing)

</div>

---

## Table of Contents

- [About](#-about)
- [Features](#-features)
- [Weather Scoring System](#-weather-scoring-system)
- [Technology Stack](#-technology-stack)
- [Installation & Setup](#-installation--setup)
- [Usage](#-usage)
- [Project Structure](#-project-structure)
- [API Documentation](#-api-documentation)
- [Environment Variables](#-environment-variables)
- [Database Schema](#-database-schema)
- [Security](#-security)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)
- [Acknowledgments](#-acknowledgments)

---

## 🎯 About

**FlightOps** addresses the critical need for paramotor pilots to quickly assess weather conditions at multiple flying sites before planning flights. Instead of checking multiple weather sources manually, pilots can view all their favorite sites on a single interactive map with color-coded weather forecasts.

### Key Benefits

- **Save Time**: Check all your flying sites at a glance
- **Stay Safe**: PPG-specific weather thresholds based on industry safety standards
- **Plan Ahead**: 3-day forecast with detailed hourly breakdowns
- **Historical Data**: Track weather patterns over time
- **Custom Sites**: Add your own secret spots

---

## ✨ Features

### 🗺️ Interactive Map Display
- Interactive map with flight site markers powered by Leaflet
- Clustered markers when zoomed out for better performance
- Clickable markers showing site summary with weather overview
- Sunrise/sunset calculations per site and day

### 🌦️ Weather Visualization
- **3-day forecast heat bars** for each site (green → yellow → red)
- Detailed hourly weather breakdown with temperature, wind, gusts, and rain
- Visual heat bars showing optimal, marginal, and unsafe flying conditions
- Real-time weather updates via scheduled background jobs

### 📍 Site Management
- Add new flight sites with coordinates (takeoff and parking locations)
- Edit existing sites with full details
- Enable/disable sites without deleting them
- Bulk operations for managing multiple sites

### 👥 User Management
- User registration with pre-authorized email system
- JWT-based authentication with secure token handling
- Admin user roles with extended permissions
- Password reset functionality
- Account lockout after failed login attempts

### ⚙️ Configurable Settings
- Adjustable weather refresh intervals
- Editable PPG weather thresholds
- Unit preferences (km/h, mph, m/s)
- Map display settings
- Global and per-site configuration options

---

## 🌦️ Weather Scoring System

FlightOps implements a comprehensive PPG (Paramotor) weather scoring system based on industry safety standards. The system is designed to be conservative and trike-safe by default, with all thresholds configurable via the settings page.

### Wind Speed (km/h)

| Wind Speed | Condition | Color | Description |
|------------|-----------|-------|-------------|
| 0-3 km/h | Too Calm | 🟠 Amber | Risk of nil-wind issues |
| 4-12 km/h | Optimal | 🟢 Green | Ideal flying conditions |
| 13-18 km/h | Marginal | 🟡 Yellow | Flyable but requires caution |
| 19-24 km/h | High Risk | 🟠 Orange | Experienced pilots only |
| ≥25 km/h | Unsafe | 🔴 Red | Do not fly |

### Gust Speed (km/h)

| Gust Speed | Condition | Color | Description |
|------------|-----------|-------|-------------|
| ≤15 km/h | Smooth Air | 🟢 Green | Calm and stable |
| 16-22 km/h | Moderate | 🟡 Yellow | Some turbulence expected |
| 23-28 km/h | Strong | 🟠 Orange | Significant turbulence |
| ≥29 km/h | Dangerous | 🔴 Red | Do not fly |

### Gust Spread (Gust - Sustained Wind)

| Spread | Meaning | Color |
|--------|---------|-------|
| ≤5 km/h | Stable Air | 🟢 Green |
| 6-10 km/h | Unstable | 🟡 Yellow |
| ≥11 km/h | Very Turbulent | 🔴 Red |

### Rain / Precipitation

| Rain (mm/hr) | Condition | Color |
|--------------|-----------|-------|
| 0.0 | Dry | 🟢 Green |
| 0.1-0.5 | Light Drizzle | 🟡 Yellow |
| >0.5 | Rain | 🔴 Red |

> **Note:** Any hour with rain >0.5 mm/hr is automatically marked as unsafe for flying.

---

## 🏗️ Technology Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS
- **Map Library**: Leaflet with React-Leaflet
- **State Management**: React Context API with custom hooks
- **Build Tool**: Vite
- **HTTP Client**: Axios

### Backend
- **Framework**: NestJS with TypeScript
- **Runtime**: Node.js
- **API**: RESTful endpoints
- **Authentication**: JWT with Passport
- **Validation**: class-validator and class-transformer
- **Scheduling**: node-cron for automated weather updates

### Database
- **DBMS**: PostgreSQL 15
- **ORM**: TypeORM
- **Migrations**: TypeORM CLI

### Infrastructure
- **Containerization**: Docker & Docker Compose
- **Weather API**: Open-Meteo (free, no authentication required)
- **Background Jobs**: Node-cron scheduler

---

## 🚀 Installation & Setup

### Prerequisites

- **Docker** (v20.10 or higher)
- **Docker Compose** (v2.0 or higher)
- **Node.js** (v18 or higher) - for development only
- **npm** or **yarn** - for development only

### Quick Start (Production)

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/flightops.git
   cd flightops
   ```

2. **Set up environment variables**
   ```bash
   # Copy example environment files
   cp .env.example .env
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

3. **Configure environment variables**

   Edit `backend/.env` with your settings:
   ```env
   # Database
   DB_HOST=postgres
   DB_PORT=5432
   DB_USERNAME=flightops
   DB_PASSWORD=your_secure_password
   DB_DATABASE=flightops

   # JWT
   JWT_SECRET=your_jwt_secret_key_here
   JWT_EXPIRATION=7d

   # Weather API
   WEATHER_UPDATE_INTERVAL=6h

   # Application
   PORT=3000
   NODE_ENV=production
   ```

4. **Start the application**
   ```bash
   docker-compose up -d
   ```

5. **Run database migrations**
   ```bash
   docker-compose exec backend npm run migration:run
   ```

6. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000
   - API Documentation: http://localhost:3000/api

7. **Create your first admin user**

   The application uses a pre-authorized email system. First, add your email to the database:
   ```bash
   docker-compose exec postgres psql -U flightops -d flightops -c \
     "INSERT INTO pre_authorized_emails (email, role) VALUES ('your@email.com', 'admin');"
   ```

   Then register at http://localhost:5173/register

### Development Setup

1. **Start development containers**
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```

2. **Install frontend dependencies**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   npm run start:dev
   ```

4. **Run migrations**
   ```bash
   cd backend
   npm run migration:run
   ```

5. **Generate a new migration** (after entity changes)
   ```bash
   cd backend
   npm run migration:generate -- src/database/migrations/YourMigrationName
   ```

---

## 📖 Usage

### Adding Your First Flight Site

1. Log in to the application
2. Click the "Add Site" button
3. Click on the map to set the takeoff location
4. Click again to set the parking location
5. Enter the site name and save
6. Wait for the next weather update (or trigger manually from settings)

### Viewing Weather Forecasts

1. Browse the map to see all flight sites
2. Sites display mini heat bars showing 3-day conditions
3. Click any site marker for detailed hourly breakdown
4. Green = good conditions, Yellow = marginal, Red = unsafe

### Adjusting Weather Thresholds

1. Navigate to Settings
2. Go to "Weather Thresholds" section
3. Adjust wind, gust, and rain thresholds
4. Save changes
5. Scores will be recalculated on the next weather update

---

## 📁 Project Structure

```
flightops/
├── backend/                      # NestJS backend application
│   ├── src/
│   │   ├── auth/                 # Authentication & authorization
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── jwt.strategy.ts
│   │   │   └── guards/
│   │   ├── users/                # User management
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   └── entities/user.entity.ts
│   │   ├── sites/                # Flight site management
│   │   │   ├── sites.controller.ts
│   │   │   ├── sites.service.ts
│   │   │   └── entities/site.entity.ts
│   │   ├── weather/              # Weather processing & scoring
│   │   │   ├── weather.controller.ts
│   │   │   ├── weather.service.ts
│   │   │   ├── weather.scheduler.ts
│   │   │   └── entities/
│   │   ├── settings/             # Application settings
│   │   │   ├── settings.controller.ts
│   │   │   ├── settings.service.ts
│   │   │   └── entities/settings.entity.ts
│   │   ├── database/             # Database configuration
│   │   │   ├── migrations/
│   │   │   └── data-source.ts
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
│
├── frontend/                     # React frontend application
│   ├── src/
│   │   ├── components/           # Reusable components
│   │   │   ├── Map/
│   │   │   │   ├── Map.tsx
│   │   │   │   ├── SiteMarker.tsx
│   │   │   │   └── ClusterMarker.tsx
│   │   │   ├── Weather/
│   │   │   │   ├── HeatBar.tsx
│   │   │   │   ├── WeatherDetail.tsx
│   │   │   │   └── WeatherSummary.tsx
│   │   │   └── UI/
│   │   ├── pages/                # Page components
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Login.tsx
│   │   │   ├── Register.tsx
│   │   │   ├── Settings.tsx
│   │   │   └── SiteManager.tsx
│   │   ├── services/             # API services
│   │   │   ├── api.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── sites.service.ts
│   │   │   └── weather.service.ts
│   │   ├── hooks/                # Custom React hooks
│   │   │   ├── useAuth.ts
│   │   │   ├── useSites.ts
│   │   │   └── useWeather.ts
│   │   ├── context/              # React context
│   │   │   └── AuthContext.tsx
│   │   ├── types/                # TypeScript types
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── public/
│   ├── package.json
│   ├── vite.config.ts
│   └── Dockerfile
│
├── docker-compose.yml            # Production configuration
├── docker-compose.dev.yml        # Development configuration
├── .env.example                  # Example environment variables
├── PROJECT.md                    # Original design specification
├── README.md                     # This file
└── LICENSE
```

---

## 📡 API Documentation

### Authentication

#### Register User
```http
POST /auth/register
Content-Type: application/json

{
  "email": "pilot@example.com",
  "password": "SecurePassword123"
}
```

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "pilot@example.com",
  "password": "SecurePassword123"
}

Response:
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "pilot@example.com",
    "role": "user"
  }
}
```

### Sites

#### Get All Sites
```http
GET /sites
Authorization: Bearer {token}

Response:
[
  {
    "id": "uuid",
    "name": "Coastal Launch",
    "takeoffLat": 51.5074,
    "takeoffLon": -0.1278,
    "parkingLat": 51.5070,
    "parkingLon": -0.1280,
    "isActive": true
  }
]
```

#### Create Site
```http
POST /sites
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Mountain Ridge",
  "takeoffLat": 52.3555,
  "takeoffLon": -1.1743,
  "parkingLat": 52.3550,
  "parkingLon": -1.1750
}
```

#### Toggle Site Status
```http
PATCH /sites/:id/toggle
Authorization: Bearer {token}

Response:
{
  "id": "uuid",
  "isActive": false
}
```

### Weather

#### Get Site Forecast
```http
GET /weather/sites/:siteId/forecast
Authorization: Bearer {token}

Response:
{
  "site": { ... },
  "forecasts": [
    {
      "date": "2026-01-13",
      "sunrise": "08:15:00",
      "sunset": "16:30:00",
      "hourly": [
        {
          "timestamp": "2026-01-13T09:00:00Z",
          "temperature": 12.5,
          "windSpeed": 8.5,
          "gustSpeed": 12.3,
          "rain": 0.0,
          "score": 85,
          "windScore": "green",
          "gustScore": "green",
          "rainScore": "green"
        }
      ]
    }
  ]
}
```

#### Trigger Weather Update
```http
POST /weather/fetch
Authorization: Bearer {token} (Admin only)

Response:
{
  "message": "Weather update started",
  "sitesUpdated": 15
}
```

### Settings

#### Get Settings
```http
GET /settings
Authorization: Bearer {token}

Response:
{
  "weatherUpdateInterval": "6h",
  "windThresholds": {
    "calm": 3,
    "optimal": 12,
    "marginal": 18,
    "highRisk": 24
  },
  "gustThresholds": { ... },
  "rainThreshold": 0.5
}
```

#### Update Settings
```http
PATCH /settings
Authorization: Bearer {token} (Admin only)
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

---

## 🔐 Environment Variables

### Backend (.env)

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DB_HOST` | PostgreSQL host | `localhost` | Yes |
| `DB_PORT` | PostgreSQL port | `5432` | Yes |
| `DB_USERNAME` | Database username | `flightops` | Yes |
| `DB_PASSWORD` | Database password | - | Yes |
| `DB_DATABASE` | Database name | `flightops` | Yes |
| `JWT_SECRET` | Secret for JWT signing | - | Yes |
| `JWT_EXPIRATION` | Token expiration time | `7d` | No |
| `PORT` | Backend server port | `3000` | No |
| `NODE_ENV` | Environment | `development` | No |
| `WEATHER_UPDATE_INTERVAL` | Cron expression for weather updates | `0 */6 * * *` | No |
| `MAX_LOGIN_ATTEMPTS` | Max failed login attempts | `5` | No |
| `LOCKOUT_DURATION` | Account lockout duration (minutes) | `30` | No |

### Frontend (.env)

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `VITE_API_URL` | Backend API URL | `http://localhost:3000` | Yes |
| `VITE_MAP_CENTER_LAT` | Default map center latitude | `51.5074` | No |
| `VITE_MAP_CENTER_LON` | Default map center longitude | `-0.1278` | No |
| `VITE_MAP_ZOOM` | Default map zoom level | `6` | No |

---

## 🗄️ Database Schema

### Key Entities

#### Users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  is_active BOOLEAN DEFAULT true,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Flight Sites
```sql
CREATE TABLE flight_sites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  takeoff_lat DECIMAL(10, 8) NOT NULL,
  takeoff_lon DECIMAL(11, 8) NOT NULL,
  parking_lat DECIMAL(10, 8),
  parking_lon DECIMAL(11, 8),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Weather Forecasts
```sql
CREATE TABLE weather_forecasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID REFERENCES flight_sites(id) ON DELETE CASCADE,
  forecast_date DATE NOT NULL,
  sunrise TIME NOT NULL,
  sunset TIME NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(site_id, forecast_date)
);
```

#### Weather Hourly
```sql
CREATE TABLE weather_hourly (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  forecast_id UUID REFERENCES weather_forecasts(id) ON DELETE CASCADE,
  timestamp TIMESTAMP NOT NULL,
  temperature DECIMAL(5, 2),
  wind_speed DECIMAL(5, 2),
  gust_speed DECIMAL(5, 2),
  rain DECIMAL(5, 2),
  score INTEGER,
  wind_score VARCHAR(20),
  gust_score VARCHAR(20),
  rain_score VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🛡️ Security

FlightOps implements multiple security layers:

### Authentication & Authorization
- **JWT-based authentication** with secure token handling
- **Password hashing** using bcrypt (10 rounds)
- **Role-based access control** (User, Admin, Owner)
- **Token expiration** with configurable timeout
- **Refresh token** support (coming soon)

### Rate Limiting & Protection
- **Login rate limiting** (5 attempts per 15 minutes per IP)
- **Account lockout** after failed attempts (configurable)
- **API rate limiting** on all endpoints
- **CORS** configuration for allowed origins

### Input Validation
- **class-validator** for all DTO validation
- **SQL injection** prevention via TypeORM parameterized queries
- **XSS protection** via input sanitization
- **Email validation** with regex patterns

### Pre-authorized Email System
- Users can only register with pre-authorized emails
- Admins manage the whitelist via database or API
- Prevents unauthorized access to the application

### Best Practices
- Environment variables for secrets
- HTTPS recommended in production
- Security headers via Helmet (coming soon)
- Regular dependency updates

---

## 🔧 Troubleshooting

### Common Issues

#### Database Connection Failed
```bash
# Check if PostgreSQL container is running
docker-compose ps

# Check database logs
docker-compose logs postgres

# Verify connection settings in backend/.env
```

#### Frontend Can't Connect to Backend
```bash
# Verify VITE_API_URL in frontend/.env
# Check if backend is running
curl http://localhost:3000/health

# Check CORS settings in backend
```

#### Weather Data Not Updating
```bash
# Check backend logs
docker-compose logs backend

# Manually trigger weather update
curl -X POST http://localhost:3000/weather/fetch \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Check cron schedule in backend logs
```

#### Migration Errors
```bash
# Revert last migration
npm run migration:revert

# Drop database and recreate (WARNING: data loss)
docker-compose down -v
docker-compose up -d
npm run migration:run
```

#### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Or change port in .env
PORT=3001
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

### Getting Started

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes**
4. **Write/update tests** (when available)
5. **Commit your changes**
   ```bash
   git commit -m 'Add amazing feature'
   ```
6. **Push to your branch**
   ```bash
   git push origin feature/amazing-feature
   ```
7. **Open a Pull Request**

### Code Style

- **TypeScript**: Follow existing patterns
- **Linting**: Run `npm run lint` before committing
- **Formatting**: Use Prettier (config included)
- **Comments**: Document complex logic
- **Naming**: Use descriptive variable/function names

### Commit Messages

Follow conventional commits:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting)
- `refactor:` Code refactoring
- `test:` Adding tests
- `chore:` Maintenance tasks

### Pull Request Process

1. Update README.md with details of changes if needed
2. Update the PROJECT.md if changing architecture
3. Ensure all tests pass (when available)
4. Request review from maintainers
5. Squash commits before merging

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

**TL;DR**: You can use, modify, and distribute this software freely, even for commercial purposes, as long as you include the original license.

---

## 🙏 Acknowledgments

- **Open-Meteo** - Free weather API with no authentication required
- **Leaflet** - Open-source mapping library
- **NestJS Community** - Excellent framework and documentation
- **Paramotor Community** - Safety guidelines and threshold recommendations
- **Contributors** - Everyone who has contributed to this project

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/flightops/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/flightops/discussions)
- **Email**: support@flightops.dev (if available)

---

## 🗺️ Roadmap

- [ ] Mobile app (React Native)
- [ ] Weather notifications (email/push)
- [ ] Flight logging & history
- [ ] Social features (share sites, reports)
- [ ] Advanced wind analysis (wind rose, crosswind calculator)
- [ ] Integration with weather stations
- [ ] Offline mode support
- [ ] Multi-language support

---

<div align="center">

**Built with ❤️ for the paramotor community**

⭐ Star this repo if you find it useful!

</div>
