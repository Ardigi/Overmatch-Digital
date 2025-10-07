#!/bin/bash

# Create Kafka Topics for all microservices
# This script creates all required Kafka topics for service communication

echo "🚀 Creating Kafka topics for SOC Compliance Platform..."

# Kafka connection details
KAFKA_CONTAINER="overmatch-digital-kafka-1"
KAFKA_BOOTSTRAP_SERVER="localhost:9092"

# Function to create a topic
create_topic() {
    local TOPIC_NAME=$1
    local PARTITIONS=${2:-3}
    local REPLICATION=${3:-1}
    
    echo "Creating topic: $TOPIC_NAME (partitions: $PARTITIONS, replication: $REPLICATION)"
    
    docker exec $KAFKA_CONTAINER kafka-topics.sh \
        --create \
        --if-not-exists \
        --bootstrap-server $KAFKA_BOOTSTRAP_SERVER \
        --topic $TOPIC_NAME \
        --partitions $PARTITIONS \
        --replication-factor $REPLICATION \
        --config retention.ms=604800000 \
        --config compression.type=snappy \
        --config min.insync.replicas=1
    
    if [ $? -eq 0 ]; then
        echo "✅ Topic $TOPIC_NAME created successfully"
    else
        echo "⚠️  Topic $TOPIC_NAME may already exist or failed to create"
    fi
}

# Service event topics
echo ""
echo "📊 Creating service event topics..."
create_topic "auth-events" 3 1
create_topic "client-events" 3 1
create_topic "policy-events" 3 1
create_topic "control-events" 3 1
create_topic "evidence-events" 3 1
create_topic "workflow-events" 3 1
create_topic "reporting-events" 3 1
create_topic "audit-events" 3 1
create_topic "integration-events" 3 1
create_topic "notification-events" 3 1
create_topic "ai-events" 3 1

# Cross-service communication topics
echo ""
echo "🔄 Creating cross-service communication topics..."
create_topic "user-created" 3 1
create_topic "organization-created" 3 1
create_topic "control-updated" 3 1
create_topic "evidence-uploaded" 3 1
create_topic "workflow-triggered" 3 1
create_topic "report-generated" 3 1
create_topic "notification-sent" 3 1

# Dead letter queues
echo ""
echo "☠️ Creating dead letter queue topics..."
create_topic "dlq-auth" 1 1
create_topic "dlq-client" 1 1
create_topic "dlq-policy" 1 1
create_topic "dlq-control" 1 1
create_topic "dlq-evidence" 1 1
create_topic "dlq-workflow" 1 1
create_topic "dlq-reporting" 1 1
create_topic "dlq-audit" 1 1
create_topic "dlq-integration" 1 1
create_topic "dlq-notification" 1 1
create_topic "dlq-ai" 1 1

# Saga pattern topics for distributed transactions
echo ""
echo "🔄 Creating saga pattern topics..."
create_topic "saga-orchestrator" 3 1
create_topic "saga-compensation" 3 1

# System monitoring topics
echo ""
echo "📈 Creating system monitoring topics..."
create_topic "system-metrics" 3 1
create_topic "system-alerts" 1 1
create_topic "system-health" 1 1

# List all topics
echo ""
echo "📋 Listing all Kafka topics:"
docker exec $KAFKA_CONTAINER kafka-topics.sh \
    --list \
    --bootstrap-server $KAFKA_BOOTSTRAP_SERVER

echo ""
echo "✅ Kafka topic creation complete!"
echo ""
echo "📊 Topic Configuration Details:"
echo "  - Retention: 7 days (604800000 ms)"
echo "  - Compression: Snappy"
echo "  - Min In-Sync Replicas: 1"
echo "  - Default Partitions: 3"
echo "  - Replication Factor: 1 (increase for production)"
echo ""
echo "💡 To view topic details, run:"
echo "  docker exec $KAFKA_CONTAINER kafka-topics.sh --describe --bootstrap-server $KAFKA_BOOTSTRAP_SERVER --topic <topic-name>"