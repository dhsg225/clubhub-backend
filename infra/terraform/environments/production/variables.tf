variable "region" {
  type    = string
  default = "us-east-1"
}

variable "subnet_ids" {
  type        = list(string)
  description = "VPC subnet IDs (minimum 3 AZs for production)"
}

variable "security_group_ids" {
  type        = list(string)
  description = "Security group IDs"
}

variable "db_username" {
  type        = string
  sensitive   = true
  description = "Master DB username — set via TF_VAR_db_username or secrets manager"
}

variable "db_password" {
  type        = string
  sensitive   = true
  description = "Master DB password — set via TF_VAR_db_password or secrets manager"
}

variable "monitoring_role_arn" {
  type        = string
  description = "IAM role ARN for RDS enhanced monitoring"
}
