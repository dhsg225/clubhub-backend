output "endpoint" {
  value       = aws_db_instance.postgresql.endpoint
  description = "PostgreSQL connection endpoint"
}

output "port" {
  value       = aws_db_instance.postgresql.port
  description = "PostgreSQL port"
}

output "database_name" {
  value       = aws_db_instance.postgresql.db_name
  description = "Database name"
}

output "replica_endpoint" {
  value       = var.enable_read_replica ? aws_db_instance.postgresql_replica[0].endpoint : null
  description = "Read replica endpoint (null if not enabled)"
}
