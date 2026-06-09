output "primary_endpoint" {
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
  description = "Redis primary endpoint address"
}

output "port" {
  value       = aws_elasticache_replication_group.redis.port
  description = "Redis port"
}
