variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "soc-compliance"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.11.0/24", "10.0.12.0/24", "10.0.13.0/24"]
}

variable "kubernetes_version" {
  description = "Kubernetes version for EKS"
  type        = string
  default     = "1.28"
}

variable "rds_instance_class" {
  description = "Instance class for RDS"
  type        = string
  default     = "db.r6g.xlarge"
}

variable "redis_node_type" {
  description = "Node type for ElastiCache Redis"
  type        = string
  default     = "cache.r6g.large"
}

variable "documentdb_instance_class" {
  description = "Instance class for DocumentDB"
  type        = string
  default     = "db.r6g.large"
}

variable "elasticsearch_instance_type" {
  description = "Instance type for Elasticsearch"
  type        = string
  default     = "r6g.large.elasticsearch"
}

variable "kafka_instance_type" {
  description = "Instance type for MSK Kafka brokers"
  type        = string
  default     = "kafka.m5.large"
}

variable "service_names" {
  description = "List of microservice names for ECR repositories"
  type        = list(string)
  default = [
    "auth-service",
    "client-service",
    "audit-service",
    "control-service",
    "evidence-service",
    "policy-service",
    "reporting-service",
    "notification-service",
    "integration-service",
    "ai-service",
    "api-gateway"
  ]
}