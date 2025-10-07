output "instance_id" {
  description = "The RDS instance ID"
  value       = aws_db_instance.main.id
}

output "instance_arn" {
  description = "The ARN of the RDS instance"
  value       = aws_db_instance.main.arn
}

output "instance_address" {
  description = "The address of the RDS instance"
  value       = aws_db_instance.main.address
}

output "instance_endpoint" {
  description = "The connection endpoint"
  value       = aws_db_instance.main.endpoint
}

output "instance_port" {
  description = "The database port"
  value       = aws_db_instance.main.port
}

output "database_name" {
  description = "The database name"
  value       = aws_db_instance.main.db_name
}

output "master_username" {
  description = "The master username for the database"
  value       = aws_db_instance.main.username
  sensitive   = true
}

output "security_group_id" {
  description = "The security group ID of the RDS instance"
  value       = aws_security_group.rds.id
}

output "secret_arn" {
  description = "The ARN of the secret containing the database credentials"
  value       = aws_secretsmanager_secret.db_password.arn
}

output "read_replica_ids" {
  description = "List of read replica instance IDs"
  value       = aws_db_instance.read_replica[*].id
}

output "read_replica_endpoints" {
  description = "List of read replica endpoints"
  value       = aws_db_instance.read_replica[*].endpoint
}