# Production environment — full HA, read replica, deletion protection, 30-day backups
terraform {
  required_version = ">= 1.6.0"
  backend "s3" {
    bucket         = "clubhub-terraform-state-production"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "clubhub-terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.region
}

module "postgresql" {
  source = "../../modules/postgresql"

  environment           = "production"
  subnet_ids            = var.subnet_ids
  security_group_ids    = var.security_group_ids
  instance_class        = "db.r6g.large"
  allocated_storage     = 500
  master_username       = var.db_username
  master_password       = var.db_password
  backup_retention_days = 30
  monitoring_role_arn   = var.monitoring_role_arn
  enable_read_replica   = true
  replica_instance_class = "db.r6g.large"
}

module "redis" {
  source = "../../modules/redis"

  environment        = "production"
  subnet_ids         = var.subnet_ids
  security_group_ids = var.security_group_ids
  node_type          = "cache.r7g.large"
}

module "object_storage" {
  source = "../../modules/object-storage"

  environment = "production"
  region      = var.region
}
