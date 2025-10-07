output "cluster_arn" {
  description = "Amazon Resource Name (ARN) of the MSK cluster"
  value       = aws_msk_cluster.main.arn
}

output "cluster_name" {
  description = "MSK cluster name"
  value       = aws_msk_cluster.main.cluster_name
}

output "bootstrap_brokers" {
  description = "Comma separated list of one or more hostname:port pairs of Kafka brokers"
  value       = aws_msk_cluster.main.bootstrap_brokers
}

output "bootstrap_brokers_tls" {
  description = "Comma separated list of one or more hostname:port pairs of Kafka brokers (TLS)"
  value       = aws_msk_cluster.main.bootstrap_brokers_tls
}

output "bootstrap_brokers_sasl_iam" {
  description = "Comma separated list of one or more hostname:port pairs of Kafka brokers (SASL/IAM)"
  value       = aws_msk_cluster.main.bootstrap_brokers_sasl_iam
}

output "bootstrap_brokers_sasl_scram" {
  description = "Comma separated list of one or more hostname:port pairs of Kafka brokers (SASL/SCRAM)"
  value       = aws_msk_cluster.main.bootstrap_brokers_sasl_scram
}

output "zookeeper_connect_string" {
  description = "Comma separated list of one or more hostname:port pairs to connect to the Apache Zookeeper cluster"
  value       = aws_msk_cluster.main.zookeeper_connect_string
}

output "zookeeper_connect_string_tls" {
  description = "Comma separated list of one or more hostname:port pairs to connect to the Apache Zookeeper cluster via TLS"
  value       = aws_msk_cluster.main.zookeeper_connect_string_tls
}

output "security_group_id" {
  description = "Security group ID for the MSK cluster"
  value       = aws_security_group.msk.id
}

output "configuration_arn" {
  description = "ARN of the MSK configuration"
  value       = aws_msk_configuration.main.arn
}

output "configuration_latest_revision" {
  description = "Latest revision of the MSK configuration"
  value       = aws_msk_configuration.main.latest_revision
}

output "cloudwatch_log_group_name" {
  description = "Name of the CloudWatch log group for MSK logs"
  value       = aws_cloudwatch_log_group.msk.name
}