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

## Pre-Authorizing User Email Addresses

Pre-authorized emails allow specific users to register without needing an existing authorization. This is useful for controlling who can create accounts.

### Step 1: Connect to the PostgreSQL container

```bash
docker exec -it flightops-postgres psql -U flightops -d flightops_dev
```

### Step 2: Add the pre-authorized email

**Basic (email only):**
```sql
INSERT INTO pre_authorized_emails (email) VALUES ('user@example.com');
```

**With notes:**
```sql
INSERT INTO pre_authorized_emails (email, notes)
VALUES ('user@example.com', 'Authorized for testing');
```

### Step 3: Verify the entry was added

```sql
SELECT email, notes, used, created_at FROM pre_authorized_emails WHERE email = 'user@example.com';
```

### Step 4: Exit the PostgreSQL shell

```sql
\q
```

### Important Notes:
- Replace `user@example.com` with the actual email address
- Once a user registers with a pre-authorized email, the `used` flag will be set to `true`
- Email addresses must be unique (case-sensitive)
- You can add notes to track why an email was pre-authorized

### List all pre-authorized emails
```bash
docker exec -it flightops-postgres psql -U flightops -d flightops_dev -c "SELECT email, notes, used, created_at FROM pre_authorized_emails ORDER BY created_at DESC;"
```

### Remove a pre-authorized email
```bash
docker exec -it flightops-postgres psql -U flightops -d flightops_dev -c "DELETE FROM pre_authorized_emails WHERE email = 'user@example.com';"
```

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

## Troubleshooting Network Connectivity Issues

If you're experiencing timeout errors when fetching weather data (ETIMEDOUT), follow these steps:

### Quick Diagnostics

Run the network diagnostics script:
```bash
./docker-network-test.sh
```

This will check:
- Container status
- DNS resolution
- External network connectivity
- HTTPS access to Open-Meteo API
- Docker network configuration

### Common Issues and Solutions

#### 1. DNS Resolution Failures

**Symptoms:**
- `ETIMEDOUT` errors in logs
- `DNS resolution failed` errors
- Cannot resolve `api.open-meteo.com`

**Solution:**
The `docker-compose.yml` has been configured with multiple DNS servers:
- Google DNS: 8.8.8.8, 8.8.4.4
- Cloudflare DNS: 1.1.1.1

After updating `docker-compose.yml`, restart the backend:
```bash
docker compose down
docker compose up -d
```

**Manual DNS test:**
```bash
# Test DNS resolution from inside the container
docker exec flightops-backend nslookup api.open-meteo.com

# Should return IP addresses like:
# Name:      api.open-meteo.com
# Address: 188.245.101.164
```

#### 2. Firewall/Security Group Blocking

**Symptoms:**
- DNS works but HTTPS requests timeout
- Can ping external IPs but not reach HTTPS endpoints

**Solution:**
Ensure your firewall/security groups allow:
- Outbound HTTPS (port 443) to all destinations
- Outbound DNS (port 53) to DNS servers

**Test HTTPS connectivity:**
```bash
docker exec flightops-backend curl -I --max-time 10 \
  https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&hourly=temperature_2m
```

#### 3. Corporate Proxy Required

**Symptoms:**
- Network works for other services but not external APIs
- Using corporate/enterprise network

**Solution:**
Add proxy settings to `docker-compose.yml` backend service:
```yaml
backend:
  environment:
    HTTP_PROXY: http://proxy.company.com:8080
    HTTPS_PROXY: http://proxy.company.com:8080
    NO_PROXY: postgres,localhost,127.0.0.1
```

#### 4. Docker Network Configuration

**Check network mode:**
```bash
docker inspect flightops-backend | grep NetworkMode
```

**Verify bridge network allows external access:**
```bash
docker network inspect flightops-network
```

**Test basic connectivity:**
```bash
# Test if container can reach internet
docker exec flightops-backend ping -c 3 8.8.8.8

# Test if container can resolve and reach external hosts
docker exec flightops-backend wget --spider https://www.google.com
```

### Viewing Weather Fetch Logs

Monitor weather fetching in real-time:
```bash
docker logs -f flightops-backend | grep -E "(WeatherProcessor|OpenMeteo)"
```

Look for these log patterns:
- `✓ Successfully fetched forecast` - API call succeeded
- `✗ Failed to fetch forecast` - API call failed (check error details)
- `Connection timeout` - Network connectivity issue
- `DNS resolution failed` - DNS configuration issue

### Testing Weather Fetch Manually

After fixing network issues, test weather fetch:

```bash
# Get an admin JWT token first (see login endpoint)
# Then trigger weather fetch:
curl -X POST http://your-server:5173/api/weather/fetch \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

Watch the logs to verify it works:
```bash
docker logs -f flightops-backend
```

### Advanced Diagnostics

**Check container's network interfaces:**
```bash
docker exec flightops-backend ip addr show
```

**Check container's routing table:**
```bash
docker exec flightops-backend ip route
```

**Check container's actual DNS config:**
```bash
docker exec flightops-backend cat /etc/resolv.conf
```

**Test with verbose curl:**
```bash
docker exec flightops-backend curl -v --max-time 30 \
  'https://api.open-meteo.com/v1/forecast?latitude=-37.96&longitude=145.25&hourly=temperature_2m'
```

### Production Deployment Checklist

Before deploying to production, verify:
- [ ] DNS servers configured in `docker-compose.yml`
- [ ] Outbound HTTPS (port 443) allowed in firewall
- [ ] Proxy settings configured if required
- [ ] Network diagnostics script runs successfully
- [ ] Manual weather fetch works
- [ ] Logs show successful API calls

### Still Having Issues?

1. Check Docker daemon configuration (`/etc/docker/daemon.json`)
2. Restart Docker daemon: `sudo systemctl restart docker`
3. Rebuild containers: `docker compose build --no-cache`
4. Check system-wide DNS: `cat /etc/resolv.conf` on host
5. Try changing DNS servers to different providers
