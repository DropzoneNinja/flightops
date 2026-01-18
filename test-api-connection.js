// Test script to diagnose Open-Meteo API connectivity
const https = require('https');
const http = require('http');

console.log('Testing Open-Meteo API connectivity...\n');

// Test HTTPS connection
const testUrl = 'https://api.open-meteo.com/v1/forecast?latitude=-37.96&longitude=145.25&hourly=temperature_2m&forecast_days=1';

console.log(`Target URL: ${testUrl}`);
console.log(`Timestamp: ${new Date().toISOString()}\n`);

const req = https.get(testUrl, {
  timeout: 30000,
  family: 4, // Force IPv4 (family: 4) instead of IPv6 (family: 6)
  headers: {
    'User-Agent': 'FlightOps-Diagnostic/1.0'
  }
}, (res) => {
  console.log(`✓ Connection successful!`);
  console.log(`Status: ${res.statusCode} ${res.statusMessage}`);
  console.log(`Headers:`, res.headers);

  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log(`\n✓ Response received (${data.length} bytes)`);
      console.log(`Sample data:`, JSON.stringify(json, null, 2).substring(0, 500));
      process.exit(0);
    } catch (e) {
      console.log(`\n✓ Response received but not JSON (${data.length} bytes)`);
      console.log(data.substring(0, 500));
      process.exit(0);
    }
  });
});

req.on('error', (error) => {
  console.error(`\n✗ Connection failed!`);
  console.error(`Error code: ${error.code}`);
  console.error(`Error message: ${error.message}`);
  console.error(`Full error:`, error);

  if (error.code === 'ETIMEDOUT') {
    console.error('\n[DIAGNOSIS] Connection timeout - possible causes:');
    console.error('  1. Firewall blocking outbound HTTPS (port 443)');
    console.error('  2. Network routing issue');
    console.error('  3. Server firewall/security groups');
    console.error('  4. IPv6 routing problems (try forcing IPv4)');
  } else if (error.code === 'ENOTFOUND') {
    console.error('\n[DIAGNOSIS] DNS resolution failed');
  } else if (error.code === 'ECONNREFUSED') {
    console.error('\n[DIAGNOSIS] Connection refused by remote server');
  } else if (error.code === 'ECONNRESET') {
    console.error('\n[DIAGNOSIS] Connection reset - possibly blocked by firewall');
  }

  process.exit(1);
});

req.on('timeout', () => {
  console.error(`\n✗ Request timeout after 30 seconds`);
  req.destroy();
  process.exit(1);
});

console.log('Attempting connection...');
