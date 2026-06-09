variable "environment" {
  type        = string
  description = "Deployment environment (dev/staging/production)"
}

variable "region" {
  type        = string
  description = "AWS region for bucket creation"
}
