# Vault Agent Configuration for Auth Service
# This configuration enables the auth service to authenticate with Vault
# and automatically renew its token

pid_file = "/vault/agent.pid"

# Vault server configuration
vault {
  address = "http://vault:8200"
  retry {
    num_retries = 5
  }
}

# Auto-auth configuration using AppRole
auto_auth {
  method "approle" {
    mount_path = "auth/approle"
    config = {
      role_id_file_path = "/vault/keys/auth-role-id"
      secret_id_file_path = "/vault/keys/auth-secret-id"
    }
  }

  sink "file" {
    config = {
      path = "/vault/auth-token/token"
      mode = 0640
    }
  }
}

# Template for database password
template {
  source      = "/vault/templates/database.tpl"
  destination = "/vault/secrets/database"
  perms       = 0640
  command     = "echo 'Database secret updated'"
}

# Template for Redis password
template {
  source      = "/vault/templates/redis.tpl"
  destination = "/vault/secrets/redis"
  perms       = 0640
  command     = "echo 'Redis secret updated'"
}

# Template for JWT secret
template {
  source      = "/vault/templates/jwt.tpl"
  destination = "/vault/secrets/jwt"
  perms       = 0640
  command     = "echo 'JWT secret updated'"
}

# Logging
log_level = "info"
log_file = "/vault/logs/agent.log"

# API proxy for service to use
api_proxy {
  use_auto_auth_token = true
}

# Listener for API proxy
listener "tcp" {
  address = "127.0.0.1:8100"
  tls_disable = true
}