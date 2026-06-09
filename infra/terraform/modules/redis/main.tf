# Redis module — session state, rate limiting, constitutional state cache
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

resource "aws_elasticache_subnet_group" "redis" {
  name       = "${var.environment}-clubhub-redis"
  subnet_ids = var.subnet_ids
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "${var.environment}-clubhub-redis"
  description          = "ClubHub Redis — session state and constitutional state cache"

  engine         = "redis"
  engine_version = "7.2"
  node_type      = var.node_type
  num_cache_clusters = var.environment == "production" ? 2 : 1

  subnet_group_name  = aws_elasticache_subnet_group.redis.name
  security_group_ids = var.security_group_ids

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  snapshot_retention_limit = var.environment == "production" ? 7 : 1
  snapshot_window          = "04:00-05:00"

  tags = {
    Environment = var.environment
    Project     = "clubhub"
    Purpose     = "session-and-constitutional-state"
  }
}
