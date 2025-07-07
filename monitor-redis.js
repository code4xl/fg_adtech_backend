#!/usr/bin/env node

const Redis = require('ioredis');
const readline = require('readline');

// Configure Redis connection
const redis = new Redis({
  host: 'localhost', // Change to your Redis host
  port: 6379,
  // password: 'your-password', // Uncomment if needed
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
});

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

class RedisMonitor {
  constructor() {
    this.monitoring = false;
    this.monitorInterval = null;
    this.watchedKeys = new Set();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  log(message, color = 'white') {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`);
  }

  async checkRedisConnection() {
    try {
      await redis.ping();
      this.log('✅ Connected to Redis', 'green');
      return true;
    } catch (error) {
      this.log(`❌ Redis connection failed: ${error.message}`, 'red');
      return false;
    }
  }

  async monitorSpecificKeys(reservationIds, campaignIds, date) {
    this.log('🔍 Starting real-time monitoring...', 'cyan');
    this.log(`📅 Date: ${date}`, 'blue');
    this.log(`🎯 Reservation IDs: ${reservationIds.join(', ')}`, 'blue');
    this.log(`💰 Campaign IDs: ${campaignIds.join(', ')}`, 'blue');
    console.log('='.repeat(80));

    const keys = {
      reservations: reservationIds.map((id) => `budget:reservation:${id}`),
      metadata: reservationIds.map((id) => `revenue:metadata:${id}`),
      budgets: campaignIds.map((id) => `campaign:budget:daily:${id}:${date}`),
    };

    // Store keys for continuous monitoring
    [...keys.reservations, ...keys.metadata, ...keys.budgets].forEach((key) => {
      this.watchedKeys.add(key);
    });

    return keys;
  }

  async getKeyDetails(key) {
    try {
      const [exists, ttl, type] = await Promise.all([
        redis.exists(key),
        redis.ttl(key),
        redis.type(key),
      ]);

      if (!exists) {
        return { exists: false, ttl: -2, type: 'none', value: null };
      }

      let value;
      try {
        if (type === 'string') {
          value = await redis.get(key);
          // Try to parse as JSON if it looks like JSON
          if (value && (value.startsWith('{') || value.startsWith('['))) {
            try {
              value = JSON.parse(value);
            } catch (e) {
              // Keep as string if not valid JSON
            }
          }
        } else if (type === 'hash') {
          value = await redis.hgetall(key);
        } else if (type === 'list') {
          value = await redis.lrange(key, 0, -1);
        } else if (type === 'set') {
          value = await redis.smembers(key);
        } else if (type === 'zset') {
          value = await redis.zrange(key, 0, -1, 'WITHSCORES');
        }
      } catch (error) {
        value = `Error reading value: ${error.message}`;
      }

      return { exists: true, ttl, type, value };
    } catch (error) {
      return { exists: false, ttl: -2, type: 'error', value: error.message };
    }
  }

  formatTTL(ttl) {
    if (ttl === -1) return `${colors.yellow}No expiry${colors.reset}`;
    if (ttl === -2) return `${colors.red}Expired/Not exists${colors.reset}`;
    if (ttl <= 30) return `${colors.red}${ttl}s${colors.reset}`;
    if (ttl <= 120) return `${colors.yellow}${ttl}s${colors.reset}`;
    return `${colors.green}${ttl}s${colors.reset}`;
  }

  formatValue(value, key) {
    if (value === null) return `${colors.red}null${colors.reset}`;

    if (typeof value === 'object') {
      if (key.includes('metadata:')) {
        // Special formatting for metadata
        return (
          `${colors.cyan}Campaign:${colors.reset} ${value.campaignId || 'N/A'}\n` +
          `    ${colors.cyan}Amount:${colors.reset} $${value.costPerImpression || value.finalPriceCPM || 'N/A'}\n` +
          `    ${colors.cyan}Confirmed:${colors.reset} ${value.confirmed ? colors.green + 'Yes' + colors.reset : colors.red + 'No' + colors.reset}\n` +
          `    ${colors.cyan}Processed:${colors.reset} ${value.processed ? colors.green + 'Yes' + colors.reset : colors.red + 'No' + colors.reset}`
        );
      }
      return JSON.stringify(value, null, 2);
    }

    if (key.includes('budget:daily:')) {
      // Format budget amounts
      const amount = parseFloat(value) || 0;
      return `${colors.green}$${amount.toFixed(6)}${colors.reset}`;
    }

    return String(value);
  }

  async displaySnapshot() {
    console.clear();
    this.log('📊 REDIS REAL-TIME MONITOR', 'bright');
    console.log('='.repeat(80));

    const sortedKeys = Array.from(this.watchedKeys).sort();

    for (const key of sortedKeys) {
      const details = await this.getKeyDetails(key);
      const keyType = key.split(':')[0];

      let icon, color;
      switch (keyType) {
        case 'budget':
          if (key.includes('reservation:')) {
            icon = '🎯';
            color = 'magenta';
          } else {
            icon = '💰';
            color = 'green';
          }
          break;
        case 'revenue':
          icon = '📋';
          color = 'cyan';
          break;
        default:
          icon = '🔑';
          color = 'white';
      }

      const keyName = key.length > 60 ? '...' + key.slice(-57) : key;
      console.log(`\n${icon} ${colors[color]}${keyName}${colors.reset}`);

      if (details.exists) {
        console.log(
          `   ${colors.bright}Status:${colors.reset} ${colors.green}EXISTS${colors.reset} | ${colors.bright}TTL:${colors.reset} ${this.formatTTL(details.ttl)} | ${colors.bright}Type:${colors.reset} ${details.type}`,
        );

        const formattedValue = this.formatValue(details.value, key);
        if (formattedValue.includes('\n')) {
          console.log(`   ${colors.bright}Value:${colors.reset}`);
          formattedValue.split('\n').forEach((line) => {
            console.log(`    ${line}`);
          });
        } else {
          console.log(
            `   ${colors.bright}Value:${colors.reset} ${formattedValue}`,
          );
        }
      } else {
        console.log(
          `   ${colors.bright}Status:${colors.reset} ${colors.red}NOT EXISTS${colors.reset}`,
        );
      }
    }

    console.log('\n' + '='.repeat(80));
    this.log(
      `Monitoring ${this.watchedKeys.size} keys | Press 'q' to quit, 'r' to restart`,
      'yellow',
    );
  }

  async startMonitoring(interval = 2000) {
    this.monitoring = true;

    // Initial display
    await this.displaySnapshot();

    // Set up periodic updates
    this.monitorInterval = setInterval(async () => {
      if (this.monitoring) {
        await this.displaySnapshot();
      }
    }, interval);

    // Handle keyboard input
    this.rl.on('line', (input) => {
      const command = input.trim().toLowerCase();

      if (command === 'q' || command === 'quit') {
        this.stopMonitoring();
      } else if (command === 'r' || command === 'restart') {
        this.restart();
      } else if (command === 'h' || command === 'help') {
        this.showHelp();
      }
    });
  }

  stopMonitoring() {
    this.monitoring = false;
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }
    this.log('⏹️  Monitoring stopped', 'yellow');
    this.rl.close();
    redis.disconnect();
    process.exit(0);
  }

  restart() {
    this.log('🔄 Restarting monitor...', 'yellow');
    main();
  }

  showHelp() {
    console.log('\n' + '='.repeat(40));
    console.log('📖 COMMANDS:');
    console.log('  q, quit  - Stop monitoring');
    console.log('  r, restart - Restart and enter new IDs');
    console.log('  h, help  - Show this help');
    console.log('='.repeat(40) + '\n');
  }

  async promptForInput() {
    return new Promise((resolve) => {
      this.rl.question('', resolve);
    });
  }
}

async function main() {
  const monitor = new RedisMonitor();

  console.log(`${colors.bright}🔍 REDIS REAL-TIME MONITOR${colors.reset}`);
  console.log('='.repeat(50));

  // Check Redis connection
  const connected = await monitor.checkRedisConnection();
  if (!connected) {
    process.exit(1);
  }

  console.log('\n📝 Enter monitoring parameters:');

  // Get reservation IDs
  console.log(
    `${colors.cyan}Reservation IDs${colors.reset} (comma-separated):`,
  );
  console.log('Example: 74cb92f4-3c7f-4bf9-bdfb-228fc233f06f,another-id');
  const reservationInput = await monitor.promptForInput();
  const reservationIds = reservationInput
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id);

  if (reservationIds.length === 0) {
    console.log(`${colors.red}❌ No reservation IDs provided${colors.reset}`);
    process.exit(1);
  }

  // Get campaign IDs
  console.log(
    `\n${colors.green}Campaign IDs${colors.reset} (comma-separated):`,
  );
  console.log('Example: de05e77f-9dee-4dbc-9e22-cbab13aebdc3,another-campaign');
  const campaignInput = await monitor.promptForInput();
  const campaignIds = campaignInput
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id);

  if (campaignIds.length === 0) {
    console.log(`${colors.red}❌ No campaign IDs provided${colors.reset}`);
    process.exit(1);
  }

  // Get date
  console.log(
    `\n${colors.blue}Date${colors.reset} (YYYY-MM-DD, press Enter for today):`,
  );
  const dateInput = await monitor.promptForInput();
  const date = dateInput.trim() || new Date().toISOString().split('T')[0];

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    console.log(
      `${colors.red}❌ Invalid date format. Use YYYY-MM-DD${colors.reset}`,
    );
    process.exit(1);
  }

  // Get refresh interval
  console.log(
    `\n${colors.magenta}Refresh interval${colors.reset} in seconds (press Enter for 2s):`,
  );
  const intervalInput = await monitor.promptForInput();
  const interval = (parseInt(intervalInput) || 2) * 1000;

  console.log(`\n${colors.green}✅ Starting monitor...${colors.reset}`);

  // Set up monitoring
  await monitor.monitorSpecificKeys(reservationIds, campaignIds, date);
  await monitor.startMonitoring(interval);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(`\n${colors.yellow}👋 Shutting down monitor...${colors.reset}`);
  redis.disconnect();
  process.exit(0);
});

// Start the application
if (require.main === module) {
  main().catch((error) => {
    console.error(
      `${colors.red}❌ Fatal error: ${error.message}${colors.reset}`,
    );
    process.exit(1);
  });
}

module.exports = RedisMonitor;
