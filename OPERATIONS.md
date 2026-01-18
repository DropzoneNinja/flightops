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

**Note**: The PostgreSQL database is only accessible within the Docker network for security. It does not expose any external ports.

To access the database, use one of these methods:

### Method 1: Using docker exec (Recommended)
```bash
docker exec -it flightops-postgres psql -U flightops -d flightops_dev
```

### Method 2: Expose port temporarily for external tools
If you need to connect with external database tools (e.g., pgAdmin, DBeaver), temporarily expose the port in `docker-compose.yml`:

```yaml
postgres:
  ports:
    - "${POSTGRES_PORT:-5432}:5432"
```

Then connect using:
- **Host**: localhost
- **Port**: 5432
- **Database**: flightops_dev (from `.env` file)
- **Username**: flightops
- **Password**: dev_password (from `.env` file)

**Remember to remove the port exposure when done for security.**

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
