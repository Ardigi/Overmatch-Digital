variable "cluster_name" {
  description = "Name of the MSK cluster"
  type        = string
}

variable "kafka_version" {
  description = "Kafka version"
  type        = string
  default     = "3.5.1"
}

variable "number_of_broker_nodes" {
  description = "Number of broker nodes in the cluster"
  type        = number
  default     = 3
}

variable "instance_type" {
  description = "Instance type for Kafka brokers"
  type        = string
  default     = "kafka.m5.large"
}

variable "ebs_volume_size" {
  description = "EBS volume size for Kafka brokers in GB"
  type        = number
  default     = 100
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "subnet_ids" {
  description = "List of subnet IDs for the MSK cluster"
  type        = list(string)
}

variable "allowed_security_groups" {
  description = "List of security groups allowed to connect"
  type        = list(string)
  default     = []
}

variable "allowed_cidr_blocks" {
  description = "List of CIDR blocks allowed to connect"
  type        = list(string)
  default     = []
}

variable "kms_key_arn" {
  description = "ARN of the KMS key for encryption at rest"
  type        = string
}

variable "encryption_in_transit_client_broker" {
  description = "Encryption setting for data in transit between clients and brokers"
  type        = string
  default     = "TLS"
}

variable "encryption_in_transit_in_cluster" {
  description = "Whether data communication among broker nodes is encrypted"
  type        = bool
  default     = true
}

variable "client_authentication_sasl_iam" {
  description = "Enables IAM client authentication"
  type        = bool
  default     = true
}

variable "client_authentication_sasl_scram" {
  description = "Enables SCRAM client authentication"
  type        = bool
  default     = false
}

variable "scram_secret_arns" {
  description = "List of AWS Secrets Manager secret ARNs for SCRAM authentication"
  type        = list(string)
  default     = []
}

variable "client_authentication_tls_certificate_authority_arns" {
  description = "List of ACM Certificate Authority ARNs for TLS authentication"
  type        = list(string)
  default     = []
}

variable "client_allow_unauthenticated" {
  description = "Enables unauthenticated access"
  type        = bool
  default     = false
}

variable "enhanced_monitoring" {
  description = "Specify the desired enhanced MSK CloudWatch monitoring level"
  type        = string
  default     = "PER_TOPIC_PER_BROKER"
}

variable "s3_logs_bucket" {
  description = "Name of the S3 bucket to deliver logs to"
  type        = string
  default     = null
}

variable "s3_logs_prefix" {
  description = "Prefix to append to the S3 logs"
  type        = string
  default     = "msk-logs"
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}

variable "auto_create_topics_enable" {
  description = "Enable auto creation of topics"
  type        = bool
  default     = true
}

variable "delete_topic_enable" {
  description = "Enable deletion of topics"
  type        = bool
  default     = true
}

variable "log_retention_hours" {
  description = "Log retention in hours"
  type        = number
  default     = 168
}

variable "log_retention_bytes" {
  description = "Log retention in bytes"
  type        = number
  default     = -1
}

variable "default_num_partitions" {
  description = "Default number of partitions"
  type        = number
  default     = 3
}

variable "default_replication_factor" {
  description = "Default replication factor"
  type        = number
  default     = 3
}

variable "min_insync_replicas" {
  description = "Minimum in-sync replicas"
  type        = number
  default     = 2
}

variable "compression_type" {
  description = "Compression type for topics"
  type        = string
  default     = "gzip"
}

variable "provisioned_throughput_enabled" {
  description = "Enable provisioned throughput"
  type        = bool
  default     = false
}

variable "volume_throughput" {
  description = "Throughput in MiB/s (only if provisioned_throughput_enabled is true)"
  type        = number
  default     = 250
}

variable "public_access_enabled" {
  description = "Enable public access"
  type        = bool
  default     = false
}

variable "custom_configuration" {
  description = "Custom Kafka configuration properties"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Map of tags to assign to resources"
  type        = map(string)
  default     = {}
}