# Dev environment — lightweight, no HA, no read replicas
terraform {
  required_version = ">= 1.6.0"
  backend "local" {
    path = "terraform.tfstate"
  }
}

provider "aws" {
  region = var.region
}

module "postgresql" {
  source = "../../modules/postgresql"

  environment           = "dev"
  subnet_ids            = var.subnet_ids
  security_group_ids    = var.security_group_ids
  instance_class        = "db.t3.small"
  allocated_storage     = 20
  master_username       = var.db_username
  master_password       = var.db_password
  backup_retention_days = 7
  monitoring_role_arn   = var.monitoring_role_arn
  enable_read_replica   = false
}

module "redis" {
  source = "../../modules/redis"

  environment        = "dev"
  subnet_ids         = var.subnet_ids
  security_group_ids = var.security_group_ids
  node_type          = "cache.t3.micro"
}

module "object_storage" {
  source = "../../modules/object-storage"

  environment = "dev"
  region      = var.region
}
