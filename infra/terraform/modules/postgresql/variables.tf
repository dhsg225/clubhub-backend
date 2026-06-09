variable "environment" {
  type        = string
  description = "Deployment environment (dev/staging/production)"
}

variable "subnet_ids" {
  type        = list(string)
  description = "VPC subnet IDs for DB subnet group"
}

variable "security_group_ids" {
  type        = list(string)
  description = "Security group IDs for DB instance"
}

variable "instance_class" {
  type        = string
  description = "RDS instance class"
  default     = "db.t3.medium"
}

variable "allocated_storage" {
  type        = number
  description = "Allocated storage in GB"
  default     = 100
}

variable "database_name" {
  type        = string
  description = "Database name"
  default     = "clubhub"
}

variable "master_username" {
  type        = string
  description = "Master username"
  sensitive   = true
}

variable "master_password" {
  type        = string
  description = "Master password"
  sensitive   = true
}

variable "backup_retention_days" {
  type        = number
  description = "Backup retention in days (minimum 7 for compliance)"
  default     = 7

  validation {
    condition     = var.backup_retention_days >= 7
    error_message = "Constitutional requirement: backup_retention_days must be >= 7 for compliance."
  }
}

variable "monitoring_role_arn" {
  type        = string
  description = "IAM role ARN for enhanced monitoring"
}

variable "enable_read_replica" {
  type        = bool
  description = "Enable read replica for audit queries"
  default     = false
}

variable "replica_instance_class" {
  type        = string
  description = "Read replica instance class"
  default     = "db.t3.small"
}
