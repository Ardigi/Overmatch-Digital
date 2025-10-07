#!/bin/bash
# Start Auth Service with proper configuration

echo "Starting Auth Service..."

# Wait for PostgreSQL
until docker exec postgres pg_isready -U soc_user; do
  echo "Waiting for PostgreSQL..."
  sleep 2
done

# Wait for Redis
until docker exec redis redis-cli ping; do
  echo "Waiting for Redis..."
  sleep 2
done

# Wait for Kafka
until docker exec kafka kafka-broker-api-versions --bootstrap-server localhost:9092; do
  echo "Waiting for Kafka..."
  sleep 2
done

echo "All dependencies ready. Starting Auth Service..."

# Start Auth Service
docker run -d \
  --name soc-auth-service \
  --network overmatch-digital_default \
  -p 3001:3001 \
  -e NODE_ENV=development \
  -e DB_HOST=postgres \
  -e DB_PORT=5432 \
  -e DB_USERNAME=soc_user \
  -e DB_PASSWORD=soc_pass \
  -e DB_NAME=soc_auth \
  -e REDIS_HOST=redis \
  -e REDIS_PORT=6379 \
  -e REDIS_PASSWORD=soc_redis_pass \
  -e KAFKA_BROKERS=kafka:29092 \
  -e JWT_SECRET=your-super-secret-jwt-key-change-this-in-production \
  -e EMAIL_SERVICE=console \
  overmatch-digital-auth-service:latest

echo "Auth Service started. Checking logs..."
sleep 5
docker logs soc-auth-service --tail 20