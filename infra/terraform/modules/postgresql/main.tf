# PostgreSQL module — ClubHub constitutional database requirements
#
# Constitutional requirements enforced via DB:
# - replay_audit_records partitioned from day 1 (cannot retrofit)
# - enforce_append_only() trigger on operational tables
# - RLS enabled on all tenant-scoped tables
# - ConstitutionalFreezeLog = PERMANENT retention

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

resource "aws_db_subnet_group" "postgresql" {
  name       = "${var.environment}-clubhub-postgresql"
  subnet_ids = var.subnet_ids
  tags = {
    Environment = var.environment
    Project     = "clubhub"
  }
}

resource "aws_db_instance" "postgresql" {
  identifier        = "${var.environment}-clubhub-postgresql"
  engine            = "postgres"
  engine_version    = "15.4"
  instance_class    = var.instance_class
  allocated_storage = var.allocated_storage
  storage_type      = "gp3"
  storage_encrypted = true

  db_name  = var.database_name
  username = var.master_username
  password = var.master_password

  db_subnet_group_name   = aws_db_subnet_group.postgresql.name
  vpc_security_group_ids = var.security_group_ids

  backup_retention_period = var.backup_retention_days
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:04:00-sun:05:00"

  deletion_protection       = var.environment == "production" ? true : false
  skip_final_snapshot       = var.environment == "production" ? false : true
  final_snapshot_identifier = var.environment == "production" ? "${var.environment}-clubhub-postgresql-final" : null

  performance_insights_enabled = true
  monitoring_interval          = 60
  monitoring_role_arn          = var.monitoring_role_arn

  # Constitutional: enable logical replication for audit trail
  parameter_group_name = aws_db_parameter_group.postgresql.name

  tags = {
    Environment      = var.environment
    Project          = "clubhub"
    ConstitutionalDB = "true"
    RetentionPolicy  = "7yr-compliance-records"
  }
}

resource "aws_db_parameter_group" "postgresql" {
  name   = "${var.environment}-clubhub-postgresql-15"
  family = "postgres15"

  parameter {
    name  = "wal_level"
    value = "logical"
  }

  parameter {
    name  = "max_wal_senders"
    value = "10"
  }

  parameter {
    name  = "row_security"
    value = "on"
  }

  # Constitutional: ensure append-only triggers cannot be bypassed
  parameter {
    name  = "session_replication_role"
    value = "DEFAULT" # Never set to REPLICA in application connections
  }
}

# Read replica for audit queries (WARM tier)
resource "aws_db_instance" "postgresql_replica" {
  count = var.enable_read_replica ? 1 : 0

  identifier          = "${var.environment}-clubhub-postgresql-replica"
  instance_class      = var.replica_instance_class
  storage_encrypted   = true
  replicate_source_db = aws_db_instance.postgresql.identifier

  tags = {
    Environment = var.environment
    Project     = "clubhub"
    Role        = "read-replica"
  }
}
