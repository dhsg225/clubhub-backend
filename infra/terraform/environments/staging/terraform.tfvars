# Staging environment — populate with actual staging values
region             = "us-east-1"
subnet_ids         = ["subnet-staging-1", "subnet-staging-2"]
security_group_ids = ["sg-staging-postgresql"]
# db_username and db_password set via TF_VAR_ environment variables
monitoring_role_arn = "arn:aws:iam::ACCOUNT:role/staging-clubhub-monitoring"
