output "assets_bucket" {
  value       = aws_s3_bucket.assets.id
  description = "Assets S3 bucket name"
}

output "assets_bucket_arn" {
  value       = aws_s3_bucket.assets.arn
  description = "Assets S3 bucket ARN"
}

output "audit_archive_bucket" {
  value       = aws_s3_bucket.audit_archive.id
  description = "Audit archive S3 bucket name (COMPLIANCE locked, 7yr)"
}

output "corpus_archive_bucket" {
  value       = aws_s3_bucket.corpus_archive.id
  description = "Corpus archive S3 bucket name (GOVERNANCE locked, 7yr)"
}
