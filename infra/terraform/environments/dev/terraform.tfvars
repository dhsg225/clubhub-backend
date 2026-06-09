# Dev environment — populate with actual dev values
region             = "us-east-1"
subnet_ids         = ["subnet-dev-1", "subnet-dev-2"]
security_group_ids = ["sg-dev-postgresql"]
# db_username and db_password set via TF_VAR_ environment variables
monitoring_role_arn = "arn:aws:iam::ACCOUNT:role/dev-clubhub-monitoring"
