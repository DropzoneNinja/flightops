# Paramotor Flight Site Weather Web App

**Purpose:**
This document is a structured build guide intended for **Claude** (or any LLM-based coding assistant) to design and implement a full-stack web application for **paramotor (PPG) flight site weather visualisation and scoring**.

The app displays multiple geographical paramotor flying sites on a map, overlays **daily flight-condition heat graphs**, and allows detailed inspection per site.

---

## 1. High-Level Goals

* Display a **map** with many paramotor flying sites
* For each site, show **3-day flight condition summaries**
* Weather data sourced from **Open-Meteo**
* Weather data processing automated via **n8n**
* Frontend built in **React**
* Backend server + **PostgreSQL** database
* Persist **historical weather & flight condition scores**
* Visualise weather suitability using **heat bars** (green → red)
* Allow users to **add new flight sites**
* deployable via docker-compose
* write and maintain a document on how to start and test the system

---

## 2. Core Architecture

### 2.1 Technology Stack

**Frontend**

* React (TypeScript preferred)
* Map library: Leaflet or Mapbox GL JS
* UI framework optional (MUI, Chakra, Tailwind)

**Backend**

* Node.js (Express / Fastify / NestJS)
* REST or GraphQL API

**Database**

* PostgreSQL

**Automation / ETL**

* n8n for scheduled weather ingestion & processing

**Weather API**

* Open-Meteo (no auth required)

---

## 3. Weather Data Requirements

### 3.1 Forecast Window

For each flight site:

* Retrieve **3 days of forecast**:

  * Tomorrow
  * Day +2
  * Day +3

### 3.2 Time Constraints

* Only retrieve and process weather **between sunrise and sunset**
* Sunrise/sunset must be calculated **per site, per day**

### 3.3 Hourly Parameters (per site)

Request from Open-Meteo:

* Temperature (°C)
* Wind speed (m/s or km/h)
* Wind gust speed
* Rain / precipitation

Hourly granularity is required.

---

## 4. Weather Processing & Scoring Logic

### 4.1 PPG Weather Thresholds (Authoritative)

Claude **must use these thresholds** as the baseline definition of *optimal*, *marginal*, and *unsafe* paramotor (PPG) flying conditions. These values are designed to be conservative and trike-safe by default, and should be configurable via settings.

#### Wind Speed (at flying height / surface proxy)

| Wind Speed | Condition                          | Colour |
| ---------- | ---------------------------------- | ------ |
| 0–3 km/h   | Too calm (risk of nil-wind issues) | Amber  |
| 4–12 km/h  | Optimal flying                     | Green  |
| 13–18 km/h | Flyable but marginal               | Yellow |
| 19–24 km/h | High risk                          | Orange |
| ≥25 km/h   | Unsafe                             | Red    |

#### Wind Gust Speed

| Gust Speed | Condition           | Colour |
| ---------- | ------------------- | ------ |
| ≤15 km/h   | Smooth air          | Green  |
| 16–22 km/h | Moderate turbulence | Yellow |
| 23–28 km/h | Strong turbulence   | Orange |
| ≥29 km/h   | Dangerous           | Red    |

#### Gust Spread (Gust – Sustained Wind)

| Spread    | Meaning        | Colour |
| --------- | -------------- | ------ |
| ≤5 km/h   | Stable air     | Green  |
| 6–10 km/h | Unstable       | Yellow |
| ≥11 km/h  | Very turbulent | Red    |

#### Rain / Precipitation

| Rain (mm/hr) | Condition     | Colour |
| ------------ | ------------- | ------ |
| 0.0          | Dry           | Green  |
| 0.1–0.5      | Light drizzle | Yellow |
| >0.5         | Rain          | Red    |

**Any rain > 0.5 mm/hr should automatically mark the hour as unsafe.**

---

### 4.2 Raw Hourly Data

Each hour between sunrise and sunset should store:

* Timestamp
* Temperature (°C)
* Wind speed (km/h)
* Gust speed (km/h)
* Gust spread (derived)
* Rain (mm)
* Individual factor scores (wind, gust, rain)
* Final suitability score (0–100)

### 4.1 Raw Hourly Data

Each hour between sunrise and sunset should store:

* Timestamp
* Temperature
* Wind speed
* Gust speed
* Rain

### 4.2 Flight Condition Scoring (PPG)

Claude should design a **scoring algorithm** that converts hourly weather into a **0–100 suitability score**.

Example considerations:

* Low wind = green
* High gust spread = red
* Rain = red
* Extreme temperature = amber/red

The score should be:

* Deterministic
* Adjustable via config/constants

### 4.3 Heat Bar Generation

For each day:

* Generate **three horizontal heat bars** representing:

  1. Wind suitability
  2. Gust / turbulence risk
  3. Rain risk

Each bar:

* Starts at sunrise
* Ends at sunset
* Uses a gradient: **green → yellow → red**

---

## 5. Map Display Requirements

### 5.1 Map Overview

Each flight site marker should show a **compact summary card**:

**Summary Data Group:**

* Site name
* Average daytime temperature
* 3 small horizontal heat bars (one per day)

Markers should be:

* Clustered when zoomed out
* Clickable

### 5.2 Marker Interaction

**On click:**

* Open a modal or side panel
* Show detailed weather breakdown per day

---

## 6. Detailed Modal View

For a selected site, display:

* Site name
* Coordinates
* Sunrise & sunset times
* Hour-by-hour table or chart
* Expanded heat bars with labels
* Wind, gust, rain numeric values

Optional:

* Toggle between days
* Historical comparison

---

## 7. Flight Site Management

### 7.1 Add Flight Site Feature

Users must be able to add a new flight site with:

* Site name
* Takeoff location (lat, lon)
* Parking location (lat, lon)

Suggested UX:

* Map click to drop pins
* Editable form

### 7.2 Database Model (Suggested)

**flight_sites**

* id
* name
* takeoff_lat
* takeoff_lon
* parking_lat
* parking_lon
* created_at

**weather_forecasts**

* id
* site_id
* forecast_date
* sunrise
* sunset

**weather_hourly**

* id
* forecast_id
* timestamp
* temperature
* wind_speed
* gust_speed
* rain
* score

---

## 8. Weather Retrieval & Scheduling (Backend)

### 8.1 Scheduling Responsibility

**n8n is no longer used for scheduling.**

The **backend server** is responsible for:

* Periodic weather retrieval
* Processing & scoring
* Persisting results

Scheduling should be implemented using:

* A server-side scheduler (e.g. cron, node-cron, or framework-native scheduler)

---

### 8.2 Backend Weather Job Responsibilities

For each scheduled run:

1. Load all enabled flight sites
2. Fetch Open-Meteo data per site
3. Calculate sunrise/sunset per day
4. Filter hourly data to daylight only
5. Apply PPG thresholds and scoring logic
6. Store processed results in PostgreSQL

The job **must be idempotent** (safe to rerun).

---

### 8.3 Configurable Schedule

The schedule frequency must be configurable via settings:

* Every X hours
* Specific times of day (e.g. 05:00 & 17:00)

Claude should design:

* A scheduled n8n workflow
* Runs once or twice daily
* Steps:

  1. Fetch all flight sites from backend
  2. Query Open-Meteo per site
  3. Calculate sunrise/sunset
  4. Filter hourly data
  5. Calculate suitability scores
  6. Store results in PostgreSQL

Error handling and retries are required.

---

## 9. API Requirements

Backend API endpoints should include:

* `GET /sites`
* `POST /sites`
* `GET /sites/:id/forecast`
* `GET /sites/:id/forecast/:date`

Responses should be frontend-ready (minimal transformation needed in React).

---

## 10. Settings Page

A dedicated **Settings page** must be implemented.

### 10.1 Global Settings

* Weather refresh frequency
* Units (km/h, m/s)
* Default PPG profile (conservative / normal / advanced)

### 10.2 Editable PPG Thresholds

All thresholds defined in Section 4 must be editable:

* Wind speed ranges
* Gust speed limits
* Gust spread tolerance
* Rain cutoff

Changes must:

* Persist to the database
* Immediately affect future scoring

### 10.3 Per-Site Overrides (Optional)

* Enable/disable site
* Custom wind limits (e.g. inland vs coastal)

---

## 11. Frontend State & Performance

* Cache forecast results

* Avoid refetching static site data

* Lazy-load detailed modals

* Cache forecast results

* Avoid refetching static site data

* Lazy-load detailed modals

---

## 11. Non-Goals (Out of Scope)

* User authentication (for now)
* Booking or flight logging
* Live tracking

---

## 12. Output Expectation for Claude

Claude should:

* Propose a full folder structure
* Generate backend schemas & migrations
* Write n8n workflow logic
* Implement React map + heat bar UI
* Clearly comment scoring logic

---

**This document is the single source of truth Claude should follow when building the project.**
