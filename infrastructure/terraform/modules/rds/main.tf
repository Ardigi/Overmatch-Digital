resource "aws_db_subnet_group" "main" {
  name       = "${var.identifier}-subnet-group"
  subnet_ids = var.subnet_ids

  tags = merge(
    var.tags,
    {
      Name = "${var.identifier}-subnet-group"
    }
  )
}

resource "aws_security_group" "rds" {
  name_prefix = "${var.identifier}-rds-"
  vpc_id      = var.vpc_id
  description = "Security group for RDS database"

  ingress {
    from_port       = var.port
    to_port         = var.port
    protocol        = "tcp"
    security_groups = var.allowed_security_groups
    cidr_blocks     = var.allowed_cidr_blocks
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.identifier}-rds-sg"
    }
  )
}

resource "random_password" "master" {
  length  = 32
  special = true
}

resource "aws_secretsmanager_secret" "db_password" {
  name_prefix = "${var.identifier}-db-password-"
  description = "Master password for RDS database ${var.identifier}"

  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id = aws_secretsmanager_secret.db_password.id
  secret_string = jsonencode({
    username = var.master_username
    password = random_password.master.result
    engine   = var.engine
    host     = aws_db_instance.main.address
    port     = var.port
    dbname   = var.database_name
  })
}

resource "aws_db_parameter_group" "main" {
  name_prefix = "${var.identifier}-"
  family      = var.parameter_group_family

  dynamic "parameter" {
    for_each = var.parameters
    content {
      name  = parameter.value.name
      value = parameter.value.value
    }
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.identifier}-parameter-group"
    }
  )
}

resource "aws_db_instance" "main" {
  identifier = var.identifier

  engine            = var.engine
  engine_version    = var.engine_version
  instance_class    = var.instance_class
  allocated_storage = var.allocated_storage
  storage_type      = var.storage_type
  storage_encrypted = true
  kms_key_id        = var.kms_key_arn

  db_name                = var.database_name
  username               = var.master_username
  password               = random_password.master.result
  port                   = var.port

  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
  parameter_group_name   = aws_db_parameter_group.main.name

  backup_retention_period = var.backup_retention_period
  backup_window          = var.backup_window
  maintenance_window     = var.maintenance_window

  multi_az               = var.multi_az
  publicly_accessible    = false
  deletion_protection    = var.deletion_protection
  skip_final_snapshot    = false
  final_snapshot_identifier = "${var.identifier}-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"

  enabled_cloudwatch_logs_exports = var.enabled_cloudwatch_logs_exports
  performance_insights_enabled    = var.performance_insights_enabled
  performance_insights_retention_period = var.performance_insights_enabled ? var.performance_insights_retention_period : null

  apply_immediately = var.apply_immediately
  
  tags = merge(
    var.tags,
    {
      Name = var.identifier
    }
  )
}

resource "aws_db_instance" "read_replica" {
  count = var.read_replica_count

  identifier = "${var.identifier}-read-${count.index + 1}"
  
  replicate_source_db = aws_db_instance.main.identifier
  instance_class      = var.read_replica_instance_class != "" ? var.read_replica_instance_class : var.instance_class
  
  publicly_accessible = false
  auto_minor_version_upgrade = false
  
  performance_insights_enabled = var.performance_insights_enabled
  
  tags = merge(
    var.tags,
    {
      Name = "${var.identifier}-read-${count.index + 1}"
    }
  )
}