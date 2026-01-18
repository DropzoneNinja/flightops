#!/bin/bash
# Docker Network Diagnostics Script for FlightOps
# Run this script to diagnose network connectivity issues in production

echo "=== FlightOps Docker Network Diagnostics ==="
echo ""

# Check if containers are running
echo "1. Checking container status..."
docker ps --filter "name=flightops" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

# Test DNS resolution from backend container
echo "2. Testing DNS resolution from backend container..."
echo "   Attempting to resolve api.open-meteo.com..."
docker exec flightops-backend nslookup api.open-meteo.com || \
  docker exec flightops-backend getent hosts api.open-meteo.com || \
  echo "   ❌ DNS resolution failed"
echo ""

# Test network connectivity
echo "3. Testing network connectivity..."
echo "   Attempting to ping Google DNS (8.8.8.8)..."
docker exec flightops-backend ping -c 3 8.8.8.8 2>/dev/null || \
  echo "   ❌ Cannot reach external networks"
echo ""

# Test HTTPS connectivity
echo "4. Testing HTTPS connectivity to Open-Meteo API..."
echo "   Using wget to test connection..."
docker exec flightops-backend wget --spider --timeout=10 https://api.open-meteo.com/v1/forecast?latitude=52.52\&longitude=13.41\&hourly=temperature_2m 2>&1 | grep -E "(connected|failed|timeout)" || \
  echo "   Note: wget might not be available, trying curl..."
docker exec flightops-backend curl -I --max-time 10 https://api.open-meteo.com/v1/forecast?latitude=52.52\&longitude=13.41\&hourly=temperature_2m 2>&1 || \
  echo "   ❌ Cannot reach Open-Meteo API"
echo ""

# Check Docker network configuration
echo "5. Checking Docker network configuration..."
docker network inspect flightops-network | grep -A 5 "Config" || echo "   Network info not available"
echo ""

# Check DNS configuration in container
echo "6. Checking DNS configuration in container..."
echo "   Contents of /etc/resolv.conf:"
docker exec flightops-backend cat /etc/resolv.conf
echo ""

# Check if a proxy is needed
echo "7. Checking environment variables for proxy settings..."
docker exec flightops-backend env | grep -i proxy || echo "   No proxy settings found"
echo ""

# Check container networking mode
echo "8. Checking container network mode..."
docker inspect flightops-backend | grep -A 3 "NetworkMode"
echo ""

echo "=== Diagnostics Complete ==="
echo ""
echo "Common issues and solutions:"
echo "  - If DNS fails: Add DNS servers to docker-compose.yml"
echo "  - If ping fails: Check firewall/security groups"
echo "  - If HTTPS fails: Check if a proxy is required"
echo "  - If using bridge network: Ensure Docker daemon allows external access"
