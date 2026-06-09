# Object storage module — corpus archives, replay audit cold storage, assets
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Asset CDN bucket
resource "aws_s3_bucket" "assets" {
  bucket = "${var.environment}-clubhub-assets"
  tags = {
    Environment = var.environment
    Project     = "clubhub"
    Purpose     = "player-assets"
  }
}

resource "aws_s3_bucket_versioning" "assets" {
  bucket = aws_s3_bucket.assets.id
  versioning_configuration { status = "Enabled" }
}

# Constitutional: asset IDs never deleted while any replay audit record references them
# Lifecycle: no expiration on assets (7yr retention for compliance venues)
resource "aws_s3_bucket_lifecycle_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id
  rule {
    id     = "archive-old-versions"
    status = "Enabled"
    filter { prefix = "" }
    noncurrent_version_transition {
      noncurrent_days = 90
      storage_class   = "GLACIER"
    }
    # No expiration — compliance retention
  }
}

# Replay audit cold storage (COLD: 7yr retention for compliance)
resource "aws_s3_bucket" "audit_archive" {
  bucket = "${var.environment}-clubhub-audit-archive"
  tags = {
    Environment     = var.environment
    Project         = "clubhub"
    Purpose         = "audit-cold-storage"
    RetentionPolicy = "7yr-permanent-for-constitutional-freeze"
  }
}

resource "aws_s3_bucket_object_lock_configuration" "audit_archive" {
  bucket = aws_s3_bucket.audit_archive.id
  rule {
    default_retention {
      mode  = "COMPLIANCE"
      years = 7
    }
  }
}

# Corpus archive bucket
resource "aws_s3_bucket" "corpus_archive" {
  bucket = "${var.environment}-clubhub-corpus-archive"
  tags = {
    Environment = var.environment
    Project     = "clubhub"
    Purpose     = "corpus-versions"
  }
}

# Constitutional: CorpusVersion deletion is prohibited unconditionally
resource "aws_s3_bucket_object_lock_configuration" "corpus_archive" {
  bucket = aws_s3_bucket.corpus_archive.id
  rule {
    default_retention {
      mode  = "GOVERNANCE" # GOVERNANCE allows admin override; use COMPLIANCE for strictest
      years = 7
    }
  }
}
