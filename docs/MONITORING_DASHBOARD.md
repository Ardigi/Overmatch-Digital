# Monitoring Dashboard Documentation

**Last Updated**: August 10, 2025  
**Version**: 1.0.0

## Overview

The SOC Compliance Platform Monitoring Dashboard provides real-time visibility into the health, performance, and status of all microservices and infrastructure components.

## Features

### Real-Time Monitoring
- **Service Health**: Live status of all 11 microservices
- **Infrastructure Status**: Database, cache, and message queue health
- **Performance Metrics**: Response time, throughput, and resource usage
- **Alert Management**: Critical alerts and warnings
- **WebSocket Updates**: Real-time metric streaming

### Key Metrics
- System health percentage
- Service availability (up/down status)
- Average response time
- Requests per minute
- CPU and memory usage
- Active connections
- Error rates

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Browser (Client)                       │
│                    - HTML/CSS/JS                         │
│                    - Chart.js                            │
│                    - WebSocket Client                    │
└─────────────────────────────────────────────────────────┘
                            │
                    HTTP/WebSocket
                            │
┌─────────────────────────────────────────────────────────┐
│              Monitoring Server (Node.js)                 │
│                    - Express API                         │
│                    - WebSocket Server                    │
│                    - Metric Collection                   │
└─────────────────────────────────────────────────────────┘
                            │
                     Health Checks
                            │
┌─────────────────────────────────────────────────────────┐
│                    Microservices                         │
│     Auth, Client, Policy, Control, Evidence, etc.       │
└─────────────────────────────────────────────────────────┘
```

## Installation

### Prerequisites
- Node.js 20+
- npm or yarn
- Running microservices (at least partially)

### Setup
```bash
# Navigate to monitoring directory
cd monitoring/dashboard

# Install dependencies
npm install

# Start the dashboard
npm start

# Or use the PowerShell script
.\scripts\start-monitoring-dashboard.ps1 -OpenBrowser
```

## Configuration

### Environment Variables
```env
# Port configuration
MONITORING_PORT=4000

# Service endpoints (optional overrides)
AUTH_SERVICE_URL=http://localhost:3001
CLIENT_SERVICE_URL=http://localhost:3002
POLICY_SERVICE_URL=http://localhost:3003

# Alert thresholds
CPU_ALERT_THRESHOLD=70
MEMORY_ALERT_THRESHOLD=75
RESPONSE_TIME_THRESHOLD=1000

# Data retention
METRICS_RETENTION_HOURS=24
ALERT_RETENTION_COUNT=100
```

### Custom Service Configuration
Edit `monitoring/dashboard/server.js`:

```javascript
const SERVICES = [
  { 
    name: 'Custom Service', 
    url: 'http://localhost:3020', 
    port: 3020,
    critical: true  // Mark as critical for priority monitoring
  }
];
```

## Usage

### Starting the Dashboard

#### Using PowerShell Script (Recommended)
```powershell
# Start with defaults
.\scripts\start-monitoring-dashboard.ps1

# Start on custom port
.\scripts\start-monitoring-dashboard.ps1 -Port 5000

# Start and open browser
.\scripts\start-monitoring-dashboard.ps1 -OpenBrowser

# Start in background
.\scripts\start-monitoring-dashboard.ps1 -Background
```

#### Manual Start
```bash
cd monitoring/dashboard
npm start

# Or for development with auto-reload
npm run dev
```

### Accessing the Dashboard

1. **Web Interface**: http://localhost:4000
2. **API Endpoints**: http://localhost:4000/api/metrics
3. **WebSocket**: ws://localhost:4000

## Dashboard Components

### 1. Header Section
- **System Status Indicator**: Overall platform health
- **Timestamp**: Current time and last update
- **Refresh Button**: Manual data refresh

### 2. Key Metrics Cards
- **System Health**: Overall health percentage
- **Active Services**: Count of running services
- **Avg Response Time**: Average across all services
- **Requests/min**: Total throughput

### 3. Response Time Chart
Real-time line chart showing response time trends:
- 1H, 6H, 24H, 7D time ranges
- Interactive tooltips
- Automatic updates every 5 seconds

### 4. Service Status Tabs

#### Microservices Tab
Shows all 11 platform services:
- Health status (healthy/warning/error)
- CPU usage percentage
- Memory usage percentage
- Requests per minute

#### Infrastructure Tab
Shows supporting services:
- Kong API Gateway
- Kafka message queue
- Redis cache
- Elasticsearch

#### Databases Tab
Shows database instances:
- PostgreSQL primary
- PostgreSQL replica
- MongoDB

### 5. Alerts Section
Recent alerts and warnings:
- Critical alerts (red)
- Warnings (yellow)
- Info messages (blue)
- Timestamp and acknowledgment status

## API Reference

### GET /api/metrics
Returns all current metrics.

**Response:**
```json
{
  "systemHealth": 98.5,
  "services": [...],
  "infrastructure": [...],
  "responseTime": [...],
  "alerts": [...]
}
```

### GET /api/services
Returns health status of all microservices.

**Response:**
```json
[
  {
    "name": "Auth Service",
    "port": 3001,
    "status": "healthy",
    "responseTime": 145,
    "cpu": 23,
    "memory": 45,
    "requests": 523,
    "timestamp": "2025-08-10T10:00:00Z"
  }
]
```

### GET /api/services/:name
Returns detailed metrics for a specific service.

**Parameters:**
- `name`: Service name (e.g., "Auth Service")

### GET /api/alerts
Returns recent alerts.

**Query Parameters:**
- `limit`: Number of alerts to return (default: 10)
- `acknowledged`: Include acknowledged alerts (default: false)

### POST /api/alerts/:id/acknowledge
Acknowledge an alert.

**Parameters:**
- `id`: Alert ID

### GET /api/metrics/response-time
Returns response time history.

**Query Parameters:**
- `period`: Time period (1h, 6h, 24h, 7d)

### GET /api/metrics/throughput
Returns throughput metrics per service.

## WebSocket Events

### Connection
```javascript
const ws = new WebSocket('ws://localhost:4000');

ws.onopen = () => {
  console.log('Connected to monitoring server');
};
```

### Message Types

#### Initial Data
Sent on connection:
```json
{
  "type": "initial",
  "data": {
    "systemHealth": 98.5,
    "services": [...],
    "infrastructure": [...],
    "alerts": [...]
  }
}
```

#### Metric Updates
Sent every 5 seconds:
```json
{
  "type": "update",
  "data": {
    "systemHealth": 98.5,
    "services": [...],
    "responseTime": [...]
  }
}
```

#### New Alert
Sent when alert is generated:
```json
{
  "type": "alert",
  "data": {
    "id": 1234567890,
    "level": "warning",
    "title": "High CPU Usage",
    "message": "Auth Service CPU at 85%",
    "timestamp": "2025-08-10T10:00:00Z"
  }
}
```

## Alert Rules

### Service Alerts
- **Service Down**: Service health check fails
- **High CPU**: CPU usage > 70%
- **High Memory**: Memory usage > 75%
- **Slow Response**: Response time > 1000ms
- **High Error Rate**: Error rate > 5%

### Infrastructure Alerts
- **Database Connection Lost**: Cannot connect to PostgreSQL
- **Cache Unavailable**: Redis connection failed
- **Message Queue Lag**: Kafka consumer lag > 1000
- **Gateway Error**: Kong returning 5xx errors

### System Alerts
- **Low System Health**: Overall health < 90%
- **Multiple Services Down**: > 2 services unhealthy
- **Cascade Failure Risk**: Critical service down

## Customization

### Adding Custom Metrics
```javascript
// In server.js, add to collectMetrics()
const customMetric = await getCustomMetric();
metrics.custom.set('my-metric', customMetric);
```

### Custom Alert Rules
```javascript
// In server.js, add to generateAlerts()
if (customCondition) {
  addAlert('warning', 'Custom Alert', 'Custom condition triggered', new Date());
}
```

### UI Customization
Edit `monitoring/dashboard/index.html`:
- Modify styles in `<style>` section
- Add new metric cards
- Customize chart options

## Performance Considerations

### Data Retention
- Metrics: Last 60 data points (10 minutes at 10s intervals)
- Alerts: Last 50 alerts
- Response time history: Configurable (1h to 7d)

### Update Intervals
- Metric collection: Every 10 seconds
- WebSocket broadcast: Every 5 seconds
- UI refresh: Every 30 seconds (auto)

### Resource Usage
- Server memory: ~50-100MB
- Client memory: ~20-50MB
- Network: ~5KB/s per connected client

## Troubleshooting

### Dashboard Not Loading
```bash
# Check if server is running
curl http://localhost:4000/api/metrics

# Check port availability
netstat -ano | findstr :4000

# Check logs
tail -f monitoring/dashboard/logs/server.log
```

### Services Show as Unhealthy
```bash
# Verify services are running
docker ps

# Check individual service health
curl http://localhost:3001/health

# Check network connectivity
ping localhost
```

### WebSocket Connection Failed
```javascript
// Check WebSocket in browser console
const ws = new WebSocket('ws://localhost:4000');
ws.onerror = (error) => console.error('WebSocket error:', error);
```

### High Memory Usage
```bash
# Restart monitoring server
.\scripts\start-monitoring-dashboard.ps1

# Clear old metrics
DELETE http://localhost:4000/api/metrics/clear
```

## Integration

### Prometheus Integration
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'soc-monitoring'
    static_configs:
      - targets: ['localhost:4000']
    metrics_path: '/api/metrics/prometheus'
```

### Grafana Integration
1. Add data source: http://localhost:4000
2. Import dashboard: `monitoring/grafana/dashboard.json`
3. Configure alerts in Grafana

### Slack Notifications
```javascript
// Add to server.js
const sendSlackAlert = async (alert) => {
  await axios.post(SLACK_WEBHOOK_URL, {
    text: `🚨 ${alert.level}: ${alert.title}\n${alert.message}`
  });
};
```

## Security

### Authentication (Not Implemented)
Future enhancement for production:
```javascript
app.use('/api', requireAuth);
app.use('/dashboard', requireLogin);
```

### HTTPS Support
```javascript
const https = require('https');
const fs = require('fs');

const server = https.createServer({
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
}, app);
```

### CORS Configuration
Currently allows all origins. For production:
```javascript
app.use(cors({
  origin: ['https://your-domain.com'],
  credentials: true
}));
```

## Deployment

### Docker Deployment
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 4000
CMD ["node", "server.js"]
```

### Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: monitoring-dashboard
spec:
  replicas: 1
  selector:
    matchLabels:
      app: monitoring-dashboard
  template:
    metadata:
      labels:
        app: monitoring-dashboard
    spec:
      containers:
      - name: dashboard
        image: soc-monitoring:latest
        ports:
        - containerPort: 4000
```

## Future Enhancements

### Planned Features
1. **Historical Data Storage**: Store metrics in TimescaleDB
2. **Advanced Analytics**: Anomaly detection with ML
3. **Multi-tenancy**: Organization-specific dashboards
4. **Mobile App**: React Native monitoring app
5. **Alert Automation**: Auto-remediation for common issues
6. **Capacity Planning**: Predictive scaling recommendations
7. **Cost Tracking**: Cloud resource cost monitoring
8. **SLA Tracking**: Service level agreement monitoring

### Community Contributions
We welcome contributions! See `CONTRIBUTING.md` for guidelines.

## Support

For issues or questions:
1. Check this documentation
2. Review troubleshooting section
3. Check GitHub issues
4. Contact the platform team

## License

Copyright 2025 SOC Compliance Platform. All rights reserved.