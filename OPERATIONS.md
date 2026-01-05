# FlightOps Operations Guide

## Making a User an Admin

When the database is running in Docker, use the following steps to promote a user to admin:

### Step 1: Connect to the PostgreSQL container

```bash
docker exec -it flightops-postgres psql -U flightops -d flightops_dev
```

**Note**: The database name is `flightops_dev` as configured in your `.env` file.

### Step 2: Update the user's admin flag

```sql
UPDATE users SET is_admin = true WHERE email = 'user@example.com';
```

### Step 3: Verify the update

```sql
SELECT email, is_admin FROM users WHERE email = 'user@example.com';
```

### Step 4: Exit the PostgreSQL shell

```sql
\q
```

### Important Notes:
- Replace `user@example.com` with the actual user's email address
- The user will need to **log out and log back in** to get a new JWT token with the updated admin status
- Admin users have access to:
  - Settings page
  - Fetch Weather button
  - Site enable/disable functionality
  - Site deletion functionality

## Database Connection Details

If you need to connect to the database using other tools:

- **Host**: localhost
- **Port**: 5432
- **Database**: flightops_dev (from `.env` file)
- **Username**: flightops
- **Password**: dev_password (from `.env` file)

## Common Database Operations

### List all users
```bash
docker exec -it flightops-postgres psql -U flightops -d flightops_dev -c "SELECT id, email, is_admin, created_at FROM users;"
```

### List all sites
```bash
docker exec -it flightops-postgres psql -U flightops -d flightops_dev -c "SELECT id, name, enabled FROM flight_sites;"
```

### View database tables
```bash
docker exec -it flightops-postgres psql -U flightops -d flightops_dev -c "\dt"
```
