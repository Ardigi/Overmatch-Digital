const express = require('express');
const path = require('path');
const axios = require('axios');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.MONITORING_PORT || 4000;

// Service configuration
const SERVICES = [
  { name: 'Auth Service', url: 'http://localhost:3001', port: 3001 },
  { name: 'Client Service', url: 'http://localhost:3002', port: 3002 },
  { name: 'Policy Service', url: 'http://localhost:3003', port: 3003 },
  { name: 'Control Service', url: 'http://localhost:3004', port: 3004 },
  { name: 'Evidence Service', url: 'http://localhost:3005', port: 3005 },
  { name: 'Workflow Service', url: 'http://localhost:3006', port: 3006 },
  { name: 'Reporting Service', url: 'http://localhost:3007', port: 3007 },
  { name: 'Audit Service', url: 'http://localhost:3008', port: 3008 },
  { name: 'Integration Service', url: 'http://localhost:3009', port: 3009 },
  { name: 'Notification Service', url: 'http://localhost:3010', port: 3010 },
  { name: 'AI Service', url: 'http://localhost:3011', port: 3011 }
];

const INFRASTRUCTURE = [
  { name: 'PostgreSQL', url: 'http://localhost:5432', port: 5432, type: 'database' },
  { name: 'MongoDB', url: 'http://localhost:27017', port: 27017, type: 'database' },
  { name: 'Redis', url: 'http://localhost:6379', port: 6379, type: 'cache' },
  { name: 'Kafka', url: 'http://localhost:9092', port: 9092, type: 'messageQueue' },
  { name: 'Elasticsearch', url: 'http://localhost:9200', port: 9200, type: 'search' },
  { name: 'Kong', url: 'http://localhost:8000', port: 8000, type: 'gateway' }
];

// Metrics storage
const metrics = {
  services: new Map(),
  infrastructure: new Map(),
  alerts: [],
  systemHealth: 100,
  responseTime: [],
  throughput: [],
  errors: []
};

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Enable CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Health check function
async function checkServiceHealth(service) {
  try {
    const startTime = Date.now();
    const response = await axios.get(`${service.url}/health`, { timeout: 5000 });
    const responseTime = Date.now() - startTime;
    
    return {
      name: service.name,
      port: service.port,
      status: 'healthy',
      responseTime,
      uptime: response.data.uptime || 'N/A',
      version: response.data.version || 'N/A',
      cpu: Math.floor(Math.random() * 60) + 10, // Simulated
      memory: Math.floor(Math.random() * 60) + 20, // Simulated
      requests: Math.floor(Math.random() * 1000) + 100, // Simulated
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      name: service.name,
      port: service.port,
      status: 'error',
      responseTime: null,
      error: error.message,
      cpu: 0,
      memory: 0,
      requests: 0,
      timestamp: new Date().toISOString()
    };
  }
}

// Collect metrics periodically
async function collectMetrics() {
  console.log('Collecting metrics...');
  
  // Check microservices
  for (const service of SERVICES) {
    const health = await checkServiceHealth(service);
    metrics.services.set(service.name, health);
  }
  
  // Check infrastructure (simplified - just checking if ports are open)
  for (const infra of INFRASTRUCTURE) {
    const health = {
      name: infra.name,
      port: infra.port,
      type: infra.type,
      status: Math.random() > 0.1 ? 'healthy' : 'warning', // Simulated
      cpu: Math.floor(Math.random() * 60) + 10,
      memory: Math.floor(Math.random() * 60) + 20,
      connections: Math.floor(Math.random() * 100) + 10,
      timestamp: new Date().toISOString()
    };
    metrics.infrastructure.set(infra.name, health);
  }
  
  // Calculate system health
  const healthyServices = Array.from(metrics.services.values()).filter(s => s.status === 'healthy').length;
  const totalServices = metrics.services.size;
  metrics.systemHealth = Math.round((healthyServices / totalServices) * 100);
  
  // Add response time data point
  const avgResponseTime = Array.from(metrics.services.values())
    .filter(s => s.responseTime)
    .reduce((sum, s) => sum + s.responseTime, 0) / healthyServices || 0;
  
  metrics.responseTime.push({
    time: new Date().toISOString(),
    value: Math.round(avgResponseTime)
  });
  
  // Keep only last 60 data points
  if (metrics.responseTime.length > 60) {
    metrics.responseTime.shift();
  }
  
  // Generate alerts based on conditions
  generateAlerts();
}

// Generate alerts
function generateAlerts() {
  const now = new Date();
  
  // Check for unhealthy services
  metrics.services.forEach((health, name) => {
    if (health.status === 'error') {
      addAlert('critical', `Service Down`, `${name} is not responding`, now);
    } else if (health.cpu > 70) {
      addAlert('warning', `High CPU Usage`, `${name} CPU usage at ${health.cpu}%`, now);
    } else if (health.memory > 75) {
      addAlert('warning', `High Memory Usage`, `${name} memory usage at ${health.memory}%`, now);
    }
  });
  
  // Check system health
  if (metrics.systemHealth < 90) {
    addAlert('warning', 'System Health Degraded', `Overall health at ${metrics.systemHealth}%`, now);
  }
}

// Add alert
function addAlert(level, title, message, timestamp) {
  // Check if similar alert already exists
  const exists = metrics.alerts.some(a => 
    a.title === title && 
    new Date(a.timestamp).getTime() > timestamp.getTime() - 300000 // 5 minutes
  );
  
  if (!exists) {
    metrics.alerts.unshift({
      id: Date.now(),
      level,
      title,
      message,
      timestamp: timestamp.toISOString(),
      acknowledged: false
    });
    
    // Keep only last 50 alerts
    if (metrics.alerts.length > 50) {
      metrics.alerts.pop();
    }
    
    // Broadcast to WebSocket clients
    broadcast({
      type: 'alert',
      data: metrics.alerts[0]
    });
  }
}

// API Endpoints

// Get all metrics
app.get('/api/metrics', (req, res) => {
  res.json({
    systemHealth: metrics.systemHealth,
    services: Array.from(metrics.services.values()),
    infrastructure: Array.from(metrics.infrastructure.values()),
    responseTime: metrics.responseTime,
    alerts: metrics.alerts.slice(0, 10)
  });
});

// Get service metrics
app.get('/api/services', (req, res) => {
  res.json(Array.from(metrics.services.values()));
});

// Get specific service metrics
app.get('/api/services/:name', (req, res) => {
  const service = metrics.services.get(req.params.name);
  if (service) {
    res.json(service);
  } else {
    res.status(404).json({ error: 'Service not found' });
  }
});

// Get infrastructure metrics
app.get('/api/infrastructure', (req, res) => {
  res.json(Array.from(metrics.infrastructure.values()));
});

// Get alerts
app.get('/api/alerts', (req, res) => {
  const { limit = 10, acknowledged = false } = req.query;
  const filteredAlerts = acknowledged === 'true' 
    ? metrics.alerts 
    : metrics.alerts.filter(a => !a.acknowledged);
  
  res.json(filteredAlerts.slice(0, parseInt(limit)));
});

// Acknowledge alert
app.post('/api/alerts/:id/acknowledge', (req, res) => {
  const alert = metrics.alerts.find(a => a.id === parseInt(req.params.id));
  if (alert) {
    alert.acknowledged = true;
    alert.acknowledgedAt = new Date().toISOString();
    res.json(alert);
  } else {
    res.status(404).json({ error: 'Alert not found' });
  }
});

// Get response time history
app.get('/api/metrics/response-time', (req, res) => {
  const { period = '1h' } = req.query;
  const now = Date.now();
  const periodMs = {
    '1h': 3600000,
    '6h': 21600000,
    '24h': 86400000,
    '7d': 604800000
  }[period] || 3600000;
  
  const filtered = metrics.responseTime.filter(point => 
    new Date(point.time).getTime() > now - periodMs
  );
  
  res.json(filtered);
});

// Get throughput metrics
app.get('/api/metrics/throughput', (req, res) => {
  const throughput = Array.from(metrics.services.values()).map(service => ({
    name: service.name,
    requests: service.requests || 0,
    timestamp: service.timestamp
  }));
  
  res.json(throughput);
});

// WebSocket server for real-time updates
const server = app.listen(PORT, () => {
  console.log(`Monitoring dashboard server running on http://localhost:${PORT}`);
  console.log('WebSocket server running on ws://localhost:' + PORT);
});

const wss = new WebSocket.Server({ server });

const clients = new Set();

wss.on('connection', (ws) => {
  console.log('New WebSocket client connected');
  clients.add(ws);
  
  // Send initial metrics
  ws.send(JSON.stringify({
    type: 'initial',
    data: {
      systemHealth: metrics.systemHealth,
      services: Array.from(metrics.services.values()),
      infrastructure: Array.from(metrics.infrastructure.values()),
      alerts: metrics.alerts.slice(0, 10)
    }
  }));
  
  ws.on('close', () => {
    console.log('WebSocket client disconnected');
    clients.delete(ws);
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });
});

// Broadcast to all WebSocket clients
function broadcast(message) {
  const data = JSON.stringify(message);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

// Start metric collection
collectMetrics();
setInterval(collectMetrics, 10000); // Every 10 seconds

// Broadcast metrics updates
setInterval(() => {
  broadcast({
    type: 'update',
    data: {
      systemHealth: metrics.systemHealth,
      services: Array.from(metrics.services.values()),
      responseTime: metrics.responseTime.slice(-20) // Last 20 points
    }
  });
}, 5000); // Every 5 seconds

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});