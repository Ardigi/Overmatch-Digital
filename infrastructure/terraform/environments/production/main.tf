terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
  }
  
  backend "s3" {
    bucket         = "soc-compliance-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "soc-compliance-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Environment = "production"
      Project     = "soc-compliance-platform"
      ManagedBy   = "terraform"
    }
  }
}

# Data sources for existing resources
data "aws_availability_zones" "available" {
  state = "available"
}

# VPC Module
module "vpc" {
  source = "../../modules/vpc"
  
  name               = "${var.project_name}-${var.environment}"
  cidr               = var.vpc_cidr
  availability_zones = data.aws_availability_zones.available.names
  
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  
  enable_nat_gateway = true
  enable_vpn_gateway = false
  
  tags = local.common_tags
}

# EKS Cluster
module "eks" {
  source = "../../modules/eks"
  
  cluster_name    = "${var.project_name}-${var.environment}"
  cluster_version = var.kubernetes_version
  
  vpc_id              = module.vpc.vpc_id
  private_subnet_ids  = module.vpc.private_subnet_ids
  
  node_groups = {
    general = {
      desired_capacity = 3
      min_capacity     = 3
      max_capacity     = 10
      instance_types   = ["t3.large"]
      
      labels = {
        role = "general"
      }
      
      taints = []
    }
    
    compute = {
      desired_capacity = 2
      min_capacity     = 2
      max_capacity     = 5
      instance_types   = ["c5.xlarge"]
      
      labels = {
        role = "compute"
      }
      
      taints = [{
        key    = "compute"
        value  = "true"
        effect = "NO_SCHEDULE"
      }]
    }
  }
  
  tags = local.common_tags
}

# RDS PostgreSQL
module "rds" {
  source = "../../modules/rds"
  
  identifier = "${var.project_name}-${var.environment}"
  
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = var.rds_instance_class
  
  allocated_storage     = 100
  max_allocated_storage = 1000
  storage_encrypted     = true
  
  database_name = "soc_compliance"
  username      = "soc_admin"
  
  vpc_id                  = module.vpc.vpc_id
  database_subnet_ids     = module.vpc.private_subnet_ids
  allowed_security_groups = [module.eks.cluster_security_group_id]
  
  backup_retention_period = 30
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"
  
  enabled_cloudwatch_logs_exports = ["postgresql"]
  
  tags = local.common_tags
}

# ElastiCache Redis
module "elasticache" {
  source = "../../modules/elasticache"
  
  cluster_id = "${var.project_name}-${var.environment}"
  
  engine               = "redis"
  engine_version       = "7.1"
  node_type           = var.redis_node_type
  number_cache_nodes  = 3
  
  vpc_id                  = module.vpc.vpc_id
  subnet_ids              = module.vpc.private_subnet_ids
  allowed_security_groups = [module.eks.cluster_security_group_id]
  
  snapshot_retention_limit = 7
  snapshot_window         = "03:00-05:00"
  
  tags = local.common_tags
}

# S3 Buckets
module "s3" {
  source = "../../modules/s3"
  
  buckets = {
    evidence = {
      name = "${var.project_name}-${var.environment}-evidence"
      versioning = true
      lifecycle_rules = [{
        id      = "archive_old_evidence"
        enabled = true
        
        transition = [{
          days          = 90
          storage_class = "STANDARD_IA"
        }]
        
        transition = [{
          days          = 365
          storage_class = "GLACIER"
        }]
      }]
    }
    
    documents = {
      name = "${var.project_name}-${var.environment}-documents"
      versioning = true
      lifecycle_rules = []
    }
    
    reports = {
      name = "${var.project_name}-${var.environment}-reports"
      versioning = true
      lifecycle_rules = []
    }
  }
  
  tags = local.common_tags
}

# DocumentDB (MongoDB compatible)
module "documentdb" {
  source = "../../modules/documentdb"
  
  cluster_identifier = "${var.project_name}-${var.environment}"
  
  engine         = "docdb"
  engine_version = "5.0.0"
  instance_class = var.documentdb_instance_class
  instance_count = 3
  
  master_username = "soc_admin"
  
  vpc_id                  = module.vpc.vpc_id
  subnet_ids              = module.vpc.private_subnet_ids
  allowed_security_groups = [module.eks.cluster_security_group_id]
  
  backup_retention_period = 30
  preferred_backup_window = "03:00-04:00"
  
  tags = local.common_tags
}

# Elasticsearch
module "elasticsearch" {
  source = "../../modules/elasticsearch"
  
  domain_name = "${var.project_name}-${var.environment}"
  
  elasticsearch_version = "8.11"
  
  instance_type  = var.elasticsearch_instance_type
  instance_count = 3
  
  ebs_enabled = true
  volume_type = "gp3"
  volume_size = 100
  
  vpc_options = {
    subnet_ids         = module.vpc.private_subnet_ids
    security_group_ids = [module.eks.cluster_security_group_id]
  }
  
  encrypt_at_rest = {
    enabled = true
  }
  
  node_to_node_encryption = {
    enabled = true
  }
  
  tags = local.common_tags
}

# MSK (Kafka)
module "msk" {
  source = "../../modules/msk"
  
  cluster_name = "${var.project_name}-${var.environment}"
  
  kafka_version      = "3.5.1"
  number_of_brokers  = 3
  instance_type      = var.kafka_instance_type
  
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnet_ids
  
  ebs_volume_size = 100
  
  encryption_info = {
    encryption_at_rest_kms_key_arn = aws_kms_key.kafka.arn
    encryption_in_transit = {
      client_broker = "TLS"
      in_cluster    = true
    }
  }
  
  tags = local.common_tags
}

# KMS Keys
resource "aws_kms_key" "kafka" {
  description             = "KMS key for MSK encryption"
  deletion_window_in_days = 10
  
  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-kafka"
  })
}

# Kong API Gateway (using Helm)
resource "helm_release" "kong" {
  name       = "kong"
  repository = "https://charts.konghq.com"
  chart      = "kong"
  namespace  = "kong"
  version    = "2.33.0"
  
  create_namespace = true
  
  values = [
    templatefile("${path.module}/helm-values/kong.yaml", {
      environment = var.environment
    })
  ]
  
  depends_on = [module.eks]
}

# Prometheus & Grafana (using Helm)
resource "helm_release" "prometheus" {
  name       = "prometheus"
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "kube-prometheus-stack"
  namespace  = "monitoring"
  version    = "54.0.0"
  
  create_namespace = true
  
  values = [
    templatefile("${path.module}/helm-values/prometheus.yaml", {
      environment = var.environment
      grafana_admin_password = random_password.grafana_admin.result
    })
  ]
  
  depends_on = [module.eks]
}

resource "random_password" "grafana_admin" {
  length  = 16
  special = true
}

# Outputs
output "vpc_id" {
  value = module.vpc.vpc_id
}

output "eks_cluster_endpoint" {
  value = module.eks.cluster_endpoint
}

output "rds_endpoint" {
  value     = module.rds.endpoint
  sensitive = true
}

output "redis_endpoint" {
  value     = module.elasticache.endpoint
  sensitive = true
}

output "documentdb_endpoint" {
  value     = module.documentdb.endpoint
  sensitive = true
}

output "elasticsearch_endpoint" {
  value     = module.elasticsearch.endpoint
  sensitive = true
}

output "kafka_bootstrap_servers" {
  value     = module.msk.bootstrap_brokers
  sensitive = true
}

locals {
  common_tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
  }
}