#!/bin/bash
# Script to start all services in order with health checks

echo "🚀 Starting SOC Compliance Platform Services..."

# Function to check service health
check_health() {
    local service=$1
    local url=$2
    local max_attempts=30
    local attempt=1
    
    echo -n "  Waiting for $service to be healthy..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f "$url" > /dev/null 2>&1; then
            echo " ✅ Healthy!"
            return 0
        fi
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo " ❌ Failed after $max_attempts attempts"
    return 1
}

# Start services in dependency order
echo "📦 Starting infrastructure services..."
docker-compose up -d postgres redis kafka zookeeper mongodb elasticsearch opa kong

# Wait for infrastructure
sleep 10

echo ""
echo "🔧 Starting microservices..."

# Start Auth Service first (no dependencies)
echo "Starting Auth Service..."
docker-compose up -d auth-service
check_health "Auth Service" "http://localhost:3001/health"

# Start Client Service (depends on Auth)
echo "Starting Client Service..."
docker-compose up -d client-service
check_health "Client Service" "http://localhost:3002/api/v1/health"

# Start Policy Service
echo "Starting Policy Service..."
docker-compose up -d policy-service
check_health "Policy Service" "http://localhost:3003/health"

# Start Control Service
echo "Starting Control Service..."
docker-compose up -d control-service
check_health "Control Service" "http://localhost:3004/health"

# Start Evidence Service
echo "Starting Evidence Service..."
docker-compose up -d evidence-service
check_health "Evidence Service" "http://localhost:3005/health"

# Start Workflow Service
echo "Starting Workflow Service..."
docker-compose up -d workflow-service
check_health "Workflow Service" "http://localhost:3006/health"

# Start Reporting Service
echo "Starting Reporting Service..."
docker-compose up -d reporting-service
check_health "Reporting Service" "http://localhost:3007/health"

# Start Audit Service
echo "Starting Audit Service..."
docker-compose up -d audit-service
check_health "Audit Service" "http://localhost:3008/health"

# Start Integration Service
echo "Starting Integration Service..."
docker-compose up -d integration-service
check_health "Integration Service" "http://localhost:3009/health"

# Start Notification Service
echo "Starting Notification Service..."
docker-compose up -d notification-service
check_health "Notification Service" "http://localhost:3010/health"

# Start AI Service
echo "Starting AI Service..."
docker-compose up -d ai-service
check_health "AI Service" "http://localhost:3011/health"

echo ""
echo "✅ All services started!"
echo ""
echo "Running connectivity test..."
cd test/integration && node service-connectivity.test.js