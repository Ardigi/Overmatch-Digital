# Create all Kafka topics for SOC Compliance Platform
Write-Host "Creating all Kafka topics..." -ForegroundColor Cyan

$topics = @(
    # Service event topics
    "auth-events",
    "client-events",
    "policy-events",
    "control-events",
    "evidence-events",
    "workflow-events",
    "reporting-events",
    "audit-events",
    "integration-events",
    "notification-events",
    "ai-events",
    # Cross-service communication
    "user-created",
    "organization-created",
    "control-updated",
    "evidence-uploaded",
    "workflow-triggered",
    "report-generated",
    "notification-sent",
    # Dead letter queues
    "dlq-auth",
    "dlq-client",
    "dlq-policy",
    "dlq-control",
    "dlq-evidence",
    "dlq-workflow",
    "dlq-reporting",
    "dlq-audit",
    "dlq-integration",
    "dlq-notification",
    "dlq-ai",
    # Saga patterns
    "saga-orchestrator",
    "saga-compensation"
)

foreach ($topic in $topics) {
    Write-Host "Creating topic: $topic" -ForegroundColor Yellow
    docker exec overmatch-digital-kafka-1 kafka-topics --create --if-not-exists --bootstrap-server localhost:9092 --topic $topic --partitions 3 --replication-factor 1
}

Write-Host "`nAll topics created! Listing current topics:" -ForegroundColor Green
docker exec overmatch-digital-kafka-1 kafka-topics --list --bootstrap-server localhost:9092