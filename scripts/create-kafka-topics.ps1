# Create Kafka Topics for all microservices
# PowerShell script for Windows environments

Write-Host "🚀 Creating Kafka topics for SOC Compliance Platform..." -ForegroundColor Cyan

# Kafka connection details
$KAFKA_CONTAINER = "overmatch-digital-kafka-1"
$KAFKA_BOOTSTRAP_SERVER = "localhost:9092"

# Function to create a topic
function Create-KafkaTopic {
    param(
        [string]$TopicName,
        [int]$Partitions = 3,
        [int]$Replication = 1
    )
    
    Write-Host "Creating topic: $TopicName (partitions: $Partitions, replication: $Replication)" -ForegroundColor Yellow
    
    $cmd = @"
kafka-topics --create --if-not-exists --bootstrap-server $KAFKA_BOOTSTRAP_SERVER --topic $TopicName --partitions $Partitions --replication-factor $Replication --config retention.ms=604800000 --config compression.type=snappy --config min.insync.replicas=1
"@
    
    docker exec $KAFKA_CONTAINER sh -c $cmd
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Topic $TopicName created successfully" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Topic $TopicName may already exist or failed to create" -ForegroundColor Yellow
    }
}

# Service event topics
Write-Host ""
Write-Host "📊 Creating service event topics..." -ForegroundColor Cyan
Create-KafkaTopic -TopicName "auth-events" -Partitions 3 -Replication 1
Create-KafkaTopic -TopicName "client-events" -Partitions 3 -Replication 1
Create-KafkaTopic -TopicName "policy-events" -Partitions 3 -Replication 1
Create-KafkaTopic -TopicName "control-events" -Partitions 3 -Replication 1
Create-KafkaTopic -TopicName "evidence-events" -Partitions 3 -Replication 1
Create-KafkaTopic -TopicName "workflow-events" -Partitions 3 -Replication 1
Create-KafkaTopic -TopicName "reporting-events" -Partitions 3 -Replication 1
Create-KafkaTopic -TopicName "audit-events" -Partitions 3 -Replication 1
Create-KafkaTopic -TopicName "integration-events" -Partitions 3 -Replication 1
Create-KafkaTopic -TopicName "notification-events" -Partitions 3 -Replication 1
Create-KafkaTopic -TopicName "ai-events" -Partitions 3 -Replication 1

# Cross-service communication topics
Write-Host ""
Write-Host "🔄 Creating cross-service communication topics..." -ForegroundColor Cyan
Create-KafkaTopic -TopicName "user-created" -Partitions 3 -Replication 1
Create-KafkaTopic -TopicName "organization-created" -Partitions 3 -Replication 1
Create-KafkaTopic -TopicName "control-updated" -Partitions 3 -Replication 1
Create-KafkaTopic -TopicName "evidence-uploaded" -Partitions 3 -Replication 1
Create-KafkaTopic -TopicName "workflow-triggered" -Partitions 3 -Replication 1
Create-KafkaTopic -TopicName "report-generated" -Partitions 3 -Replication 1
Create-KafkaTopic -TopicName "notification-sent" -Partitions 3 -Replication 1

# Dead letter queues
Write-Host ""
Write-Host "☠️ Creating dead letter queue topics..." -ForegroundColor Cyan
Create-KafkaTopic -TopicName "dlq-auth" -Partitions 1 -Replication 1
Create-KafkaTopic -TopicName "dlq-client" -Partitions 1 -Replication 1
Create-KafkaTopic -TopicName "dlq-policy" -Partitions 1 -Replication 1
Create-KafkaTopic -TopicName "dlq-control" -Partitions 1 -Replication 1
Create-KafkaTopic -TopicName "dlq-evidence" -Partitions 1 -Replication 1
Create-KafkaTopic -TopicName "dlq-workflow" -Partitions 1 -Replication 1
Create-KafkaTopic -TopicName "dlq-reporting" -Partitions 1 -Replication 1
Create-KafkaTopic -TopicName "dlq-audit" -Partitions 1 -Replication 1
Create-KafkaTopic -TopicName "dlq-integration" -Partitions 1 -Replication 1
Create-KafkaTopic -TopicName "dlq-notification" -Partitions 1 -Replication 1
Create-KafkaTopic -TopicName "dlq-ai" -Partitions 1 -Replication 1

# Saga pattern topics for distributed transactions
Write-Host ""
Write-Host "🔄 Creating saga pattern topics..." -ForegroundColor Cyan
Create-KafkaTopic -TopicName "saga-orchestrator" -Partitions 3 -Replication 1
Create-KafkaTopic -TopicName "saga-compensation" -Partitions 3 -Replication 1

# System monitoring topics
Write-Host ""
Write-Host "📈 Creating system monitoring topics..." -ForegroundColor Cyan
Create-KafkaTopic -TopicName "system-metrics" -Partitions 3 -Replication 1
Create-KafkaTopic -TopicName "system-alerts" -Partitions 1 -Replication 1
Create-KafkaTopic -TopicName "system-health" -Partitions 1 -Replication 1

# List all topics
Write-Host ""
Write-Host "📋 Listing all Kafka topics:" -ForegroundColor Cyan
docker exec $KAFKA_CONTAINER kafka-topics --list --bootstrap-server $KAFKA_BOOTSTRAP_SERVER

Write-Host ""
Write-Host "✅ Kafka topic creation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Topic Configuration Details:" -ForegroundColor Cyan
Write-Host "  - Retention: 7 days (604800000 ms)"
Write-Host "  - Compression: Snappy"
Write-Host "  - Min In-Sync Replicas: 1"
Write-Host "  - Default Partitions: 3"
Write-Host "  - Replication Factor: 1 (increase for production)"
Write-Host ""
Write-Host "💡 To view topic details, run:" -ForegroundColor Yellow
Write-Host "  docker exec $KAFKA_CONTAINER kafka-topics --describe --bootstrap-server $KAFKA_BOOTSTRAP_SERVER --topic <topic-name>"