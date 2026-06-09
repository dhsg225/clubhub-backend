# Staging environment — HA-capable, read replica enabled, mirrors production shape
terraform {
  required_version = ">= 1.6.0"
  backend "s3" {
    bucket = "clubhub-terraform-state-staging"
    key    = "staging/terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" {
  region = var.region
}

module "postgresql" {
  source = "../../modules/postgresql"

  environment           = "staging"
  subnet_ids            = var.subnet_ids
  security_group_ids    = var.security_group_ids
  instance_class        = "db.t3.medium"
  allocated_storage     = 100
  master_username       = var.db_username
  master_password       = var.db_password
  backup_retention_days = 14
  monitoring_role_arn   = var.monitoring_role_arn
  enable_read_replica   = true
  replica_instance_class = "db.t3.small"
}

module "redis" {
  source = "../../modules/redis"

  environment        = "staging"
  subnet_ids         = var.subnet_ids
  security_group_ids = var.security_group_ids
  node_type          = "cache.t3.small"
}

module "object_storage" {
  source = "../../modules/object-storage"

  environment = "staging"
  region      = var.region
}
