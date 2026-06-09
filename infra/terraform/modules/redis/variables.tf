variable "environment" {
  type        = string
  description = "Deployment environment (dev/staging/production)"
}

variable "subnet_ids" {
  type        = list(string)
  description = "VPC subnet IDs for ElastiCache subnet group"
}

variable "security_group_ids" {
  type        = list(string)
  description = "Security group IDs for ElastiCache cluster"
}

variable "node_type" {
  type        = string
  description = "ElastiCache node type"
  default     = "cache.t3.small"
}
