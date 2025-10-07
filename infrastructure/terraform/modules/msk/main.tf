resource "aws_security_group" "msk" {
  name_prefix = "${var.cluster_name}-msk-"
  vpc_id      = var.vpc_id
  description = "Security group for MSK cluster"

  ingress {
    from_port       = 9092
    to_port         = 9092
    protocol        = "tcp"
    security_groups = var.allowed_security_groups
    cidr_blocks     = var.allowed_cidr_blocks
    description     = "Kafka plaintext"
  }

  ingress {
    from_port       = 9094
    to_port         = 9094
    protocol        = "tcp"
    security_groups = var.allowed_security_groups
    cidr_blocks     = var.allowed_cidr_blocks
    description     = "Kafka TLS"
  }

  ingress {
    from_port       = 2181
    to_port         = 2181
    protocol        = "tcp"
    security_groups = var.allowed_security_groups
    cidr_blocks     = var.allowed_cidr_blocks
    description     = "Zookeeper"
  }

  ingress {
    from_port       = 2182
    to_port         = 2182
    protocol        = "tcp"
    security_groups = var.allowed_security_groups
    cidr_blocks     = var.allowed_cidr_blocks
    description     = "Zookeeper TLS"
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
      Name = "${var.cluster_name}-msk-sg"
    }
  )
}

resource "aws_cloudwatch_log_group" "msk" {
  name              = "/aws/msk/${var.cluster_name}"
  retention_in_days = var.log_retention_days

  tags = merge(
    var.tags,
    {
      Name = "${var.cluster_name}-msk-logs"
    }
  )
}

resource "aws_msk_configuration" "main" {
  kafka_versions = [var.kafka_version]
  name           = "${var.cluster_name}-config"

  server_properties = join("\n", [
    "auto.create.topics.enable=${var.auto_create_topics_enable}",
    "delete.topic.enable=${var.delete_topic_enable}",
    "log.retention.hours=${var.log_retention_hours}",
    "log.retention.bytes=${var.log_retention_bytes}",
    "num.partitions=${var.default_num_partitions}",
    "default.replication.factor=${var.default_replication_factor}",
    "min.insync.replicas=${var.min_insync_replicas}",
    "compression.type=${var.compression_type}",
    var.custom_configuration
  ])

  description = "Configuration for ${var.cluster_name} MSK cluster"
}

resource "aws_msk_cluster" "main" {
  cluster_name           = var.cluster_name
  kafka_version          = var.kafka_version
  number_of_broker_nodes = var.number_of_broker_nodes

  broker_node_group_info {
    instance_type   = var.instance_type
    client_subnets  = var.subnet_ids
    security_groups = [aws_security_group.msk.id]

    storage_info {
      ebs_storage_info {
        volume_size            = var.ebs_volume_size
        provisioned_throughput {
          enabled           = var.provisioned_throughput_enabled
          volume_throughput = var.provisioned_throughput_enabled ? var.volume_throughput : null
        }
      }
    }

    connectivity_info {
      public_access {
        type = var.public_access_enabled ? "SERVICE_PROVIDED_EIPS" : "DISABLED"
      }
    }
  }

  configuration_info {
    arn      = aws_msk_configuration.main.arn
    revision = aws_msk_configuration.main.latest_revision
  }

  encryption_info {
    encryption_at_rest_kms_key_arn = var.kms_key_arn

    encryption_in_transit {
      client_broker = var.encryption_in_transit_client_broker
      in_cluster    = var.encryption_in_transit_in_cluster
    }
  }

  client_authentication {
    sasl {
      iam   = var.client_authentication_sasl_iam
      scram = var.client_authentication_sasl_scram
    }

    tls {
      certificate_authority_arns = var.client_authentication_tls_certificate_authority_arns
    }

    unauthenticated = var.client_allow_unauthenticated
  }

  logging_info {
    broker_logs {
      cloudwatch_logs {
        enabled   = true
        log_group = aws_cloudwatch_log_group.msk.name
      }
      
      s3 {
        enabled = var.s3_logs_bucket != null
        bucket  = var.s3_logs_bucket
        prefix  = var.s3_logs_prefix
      }
    }
  }

  open_monitoring {
    prometheus {
      jmx_exporter {
        enabled_in_broker = var.enhanced_monitoring == "PER_BROKER" || var.enhanced_monitoring == "PER_TOPIC_PER_BROKER"
      }
      
      node_exporter {
        enabled_in_broker = var.enhanced_monitoring != "DEFAULT"
      }
    }
  }

  tags = merge(
    var.tags,
    {
      Name = var.cluster_name
    }
  )
}

resource "aws_msk_scram_secret_association" "main" {
  count = var.client_authentication_sasl_scram ? length(var.scram_secret_arns) : 0

  cluster_arn     = aws_msk_cluster.main.arn
  secret_arn_list = var.scram_secret_arns
}