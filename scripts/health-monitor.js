const axios = require('axios');
const Table = require('cli-table3');
const chalk = require('chalk');
const blessed = require('blessed');

/**
 * Real-time Service Health Monitor
 * Provides a dashboard view of all services and their dependencies
 */
class ServiceHealthMonitor {
  constructor() {
    this.services = [
      { name: 'PostgreSQL', type: 'infra', check: this.checkPostgres.bind(this) },
      { name: 'Redis', type: 'infra', check: this.checkRedis.bind(this) },
      { name: 'Kafka', type: 'infra', check: this.checkKafka.bind(this) },
      { name: 'Kong Gateway', type: 'infra', check: this.checkKong.bind(this) },
      { name: 'Auth Service', type: 'service', port: 3001, path: '/health' },
      { name: 'Client Service', type: 'service', port: 3002, path: '/api/v1/health' },
      { name: 'Policy Service', type: 'service', port: 3003, path: '/health' },
      { name: 'Control Service', type: 'service', port: 3004, path: '/health' },
      { name: 'Evidence Service', type: 'service', port: 3005, path: '/health' },
      { name: 'Workflow Service', type: 'service', port: 3006, path: '/health' },
      { name: 'Reporting Service', type: 'service', port: 3007, path: '/health' },
      { name: 'Audit Service', type: 'service', port: 3008, path: '/health' },
      { name: 'Integration Service', type: 'service', port: 3009, path: '/health' },
      { name: 'Notification Service', type: 'service', port: 3010, path: '/health' },
      { name: 'AI Service', type: 'service', port: 3011, path: '/health' },
    ];

    this.status = {};
    this.screen = null;
    this.widgets = {};
  }

  async start() {
    if (process.argv.includes('--simple')) {
      // Simple mode - just print to console
      await this.runSimpleMode();
    } else {
      // Dashboard mode
      this.setupDashboard();
      await this.runDashboard();
    }
  }

  async runSimpleMode() {
    console.log('🏥 Service Health Monitor - Simple Mode\n');

    while (true) {
      await this.checkAllServices();
      this.printSimpleStatus();
      await this.sleep(5000); // Check every 5 seconds
    }
  }

  printSimpleStatus() {
    console.clear();
    console.log('🏥 Service Health Status - ' + new Date().toLocaleTimeString());
    console.log('═'.repeat(60));

    const table = new Table({
      head: ['Service', 'Status', 'Response Time', 'Details'],
      colWidths: [25, 12, 15, 30],
    });

    for (const service of this.services) {
      const status = this.status[service.name] || { status: 'Unknown' };
      const statusColor =
        status.status === 'Healthy'
          ? chalk.green
          : status.status === 'Degraded'
            ? chalk.yellow
            : chalk.red;

      table.push([
        service.name,
        statusColor(status.status),
        status.responseTime ? `${status.responseTime}ms` : '-',
        status.details || '-',
      ]);
    }

    console.log(table.toString());

    // Summary
    const healthy = Object.values(this.status).filter((s) => s.status === 'Healthy').length;
    const total = this.services.length;
    const healthPercentage = Math.round((healthy / total) * 100);

    console.log('\n' + '─'.repeat(60));
    console.log(`Overall Health: ${this.getHealthBar(healthPercentage)} ${healthPercentage}%`);
    console.log(`Healthy Services: ${healthy}/${total}`);

    // Critical alerts
    const critical = Object.entries(this.status).filter(
      ([, status]) => status.status === 'Unhealthy' && status.critical
    );

    if (critical.length > 0) {
      console.log('\n' + chalk.red('⚠️  CRITICAL ALERTS:'));
      critical.forEach(([name, status]) => {
        console.log(chalk.red(`   - ${name}: ${status.error}`));
      });
    }
  }

  getHealthBar(percentage) {
    const filled = Math.round(percentage / 5);
    const empty = 20 - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);

    if (percentage >= 80) return chalk.green(bar);
    if (percentage >= 50) return chalk.yellow(bar);
    return chalk.red(bar);
  }

  async checkAllServices() {
    const checks = this.services.map(async (service) => {
      const startTime = Date.now();

      try {
        if (service.type === 'infra' && service.check) {
          const result = await service.check();
          this.status[service.name] = {
            status: result.healthy ? 'Healthy' : 'Unhealthy',
            responseTime: Date.now() - startTime,
            details: result.details,
            critical: service.type === 'infra',
            lastCheck: new Date(),
          };
        } else if (service.type === 'service') {
          const response = await axios.get(`http://localhost:${service.port}${service.path}`, {
            timeout: 5000,
          });

          const isHealthy =
            response.status === 200 &&
            (response.data.status === 'ok' || response.data.healthy !== false);

          this.status[service.name] = {
            status: isHealthy ? 'Healthy' : 'Degraded',
            responseTime: Date.now() - startTime,
            details: JSON.stringify(response.data).substring(0, 50),
            lastCheck: new Date(),
          };
        }
      } catch (error) {
        this.status[service.name] = {
          status: 'Unhealthy',
          responseTime: Date.now() - startTime,
          error: error.message,
          critical: service.type === 'infra',
          lastCheck: new Date(),
        };
      }
    });

    await Promise.all(checks);
  }

  async checkPostgres() {
    try {
      // Simple TCP check for PostgreSQL
      const net = require('net');
      return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(2000);

        socket.on('connect', () => {
          socket.destroy();
          resolve({ healthy: true, details: 'Port 5432 accessible' });
        });

        socket.on('error', () => {
          resolve({ healthy: false, details: 'Cannot connect to port 5432' });
        });

        socket.on('timeout', () => {
          socket.destroy();
          resolve({ healthy: false, details: 'Connection timeout' });
        });

        socket.connect(5432, 'localhost');
      });
    } catch (error) {
      return { healthy: false, details: error.message };
    }
  }

  async checkRedis() {
    try {
      const net = require('net');
      return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(2000);

        socket.on('connect', () => {
          socket.destroy();
          resolve({ healthy: true, details: 'Port 6379 accessible' });
        });

        socket.on('error', () => {
          resolve({ healthy: false, details: 'Cannot connect to port 6379' });
        });

        socket.on('timeout', () => {
          socket.destroy();
          resolve({ healthy: false, details: 'Connection timeout' });
        });

        socket.connect(6379, 'localhost');
      });
    } catch (error) {
      return { healthy: false, details: error.message };
    }
  }

  async checkKafka() {
    try {
      const net = require('net');
      return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(2000);

        socket.on('connect', () => {
          socket.destroy();
          resolve({ healthy: true, details: 'Port 9092 accessible' });
        });

        socket.on('error', () => {
          resolve({ healthy: false, details: 'Cannot connect to port 9092' });
        });

        socket.on('timeout', () => {
          socket.destroy();
          resolve({ healthy: false, details: 'Connection timeout' });
        });

        socket.connect(9092, 'localhost');
      });
    } catch (error) {
      return { healthy: false, details: error.message };
    }
  }

  async checkKong() {
    try {
      const response = await axios.get('http://localhost:8001', { timeout: 2000 });
      return { healthy: response.status === 200, details: 'Admin API accessible' };
    } catch (error) {
      return { healthy: false, details: error.message };
    }
  }

  setupDashboard() {
    // Create blessed screen
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Service Health Monitor',
    });

    // Header
    this.widgets.header = blessed.box({
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: '{center}🏥 SOC Compliance Platform - Service Health Monitor{/center}',
      tags: true,
      style: {
        fg: 'white',
        bg: 'blue',
      },
    });

    // Service list
    this.widgets.serviceList = blessed.list({
      top: 3,
      left: 0,
      width: '50%',
      height: '70%',
      label: ' Services ',
      border: {
        type: 'line',
      },
      style: {
        fg: 'white',
        border: {
          fg: 'cyan',
        },
        selected: {
          bg: 'blue',
        },
      },
      keys: true,
      mouse: true,
      vi: true,
    });

    // Details panel
    this.widgets.details = blessed.box({
      top: 3,
      left: '50%',
      width: '50%',
      height: '70%',
      label: ' Details ',
      border: {
        type: 'line',
      },
      style: {
        fg: 'white',
        border: {
          fg: 'cyan',
        },
      },
      scrollable: true,
      alwaysScroll: true,
      mouse: true,
    });

    // Alerts panel
    this.widgets.alerts = blessed.log({
      bottom: 0,
      left: 0,
      width: '100%',
      height: '25%',
      label: ' Alerts ',
      border: {
        type: 'line',
      },
      style: {
        fg: 'white',
        border: {
          fg: 'red',
        },
      },
      scrollable: true,
      alwaysScroll: true,
      mouse: true,
    });

    // Add widgets to screen
    this.screen.append(this.widgets.header);
    this.screen.append(this.widgets.serviceList);
    this.screen.append(this.widgets.details);
    this.screen.append(this.widgets.alerts);

    // Quit on q or Control-C
    this.screen.key(['q', 'C-c'], () => {
      return process.exit(0);
    });

    // Handle service selection
    this.widgets.serviceList.on('select', (item, index) => {
      this.showServiceDetails(this.services[index]);
    });

    this.screen.render();
  }

  async runDashboard() {
    while (true) {
      await this.checkAllServices();
      this.updateDashboard();
      await this.sleep(5000);
    }
  }

  updateDashboard() {
    // Update service list
    const items = this.services.map((service) => {
      const status = this.status[service.name] || { status: 'Unknown' };
      const icon = status.status === 'Healthy' ? '✅' : status.status === 'Degraded' ? '⚠️ ' : '❌';
      const color =
        status.status === 'Healthy'
          ? '{green-fg}'
          : status.status === 'Degraded'
            ? '{yellow-fg}'
            : '{red-fg}';

      return `${icon} ${color}${service.name}{/}`;
    });

    this.widgets.serviceList.setItems(items);

    // Update alerts
    const alerts = Object.entries(this.status)
      .filter(([, status]) => status.status !== 'Healthy')
      .map(([name, status]) => {
        const time = new Date().toLocaleTimeString();
        return `[${time}] ${name}: ${status.error || status.details}`;
      });

    alerts.forEach((alert) => this.widgets.alerts.log(alert));

    // Update header with summary
    const healthy = Object.values(this.status).filter((s) => s.status === 'Healthy').length;
    const total = this.services.length;
    const percentage = Math.round((healthy / total) * 100);

    this.widgets.header.setContent(
      `{center}🏥 Service Health Monitor - ${healthy}/${total} Healthy (${percentage}%){/center}`
    );

    this.screen.render();
  }

  showServiceDetails(service) {
    const status = this.status[service.name] || { status: 'Unknown' };
    const details = `
Service: ${service.name}
Type: ${service.type}
Status: ${status.status}
Response Time: ${status.responseTime || '-'}ms
Last Check: ${status.lastCheck || '-'}

Details:
${JSON.stringify(status, null, 2)}
    `;

    this.widgets.details.setContent(details);
    this.screen.render();
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Check if required modules are installed
try {
  require('cli-table3');
  require('chalk');
  require('blessed');
} catch (error) {
  console.log('Installing required dependencies...');
  require('child_process').execSync('npm install cli-table3 chalk blessed', { stdio: 'inherit' });
}

// Run the monitor
const monitor = new ServiceHealthMonitor();
monitor.start().catch(console.error);
