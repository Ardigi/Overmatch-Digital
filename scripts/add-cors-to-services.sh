#!/bin/bash

# Script to add CORS configuration to all backend services

SERVICES=(
  "client-service"
  "policy-service"
  "control-service"
  "evidence-service"
  "project-service"
  "ai-service"
  "audit-service"
  "integration-service"
  "notification-service"
  "reporting-service"
  "workflow-service"
)

CORS_CONFIG='  // Enable CORS
  app.enableCors({
    origin: (origin, callback) => {
      const allowedOrigins = configService.get('"'"'CORS_ORIGINS'"'"')?.split('"'"','"'"') || [
        '"'"'http://localhost:3000'"'"',
        '"'"'http://localhost:8000'"'"', // Kong Gateway
      ];
      
      // Allow requests with no origin (like mobile apps)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === '"'"'development'"'"') {
        callback(null, true);
      } else {
        callback(new Error('"'"'Not allowed by CORS'"'"'));
      }
    },
    credentials: true,
    methods: ['"'"'GET'"'"', '"'"'POST'"'"', '"'"'PUT'"'"', '"'"'PATCH'"'"', '"'"'DELETE'"'"', '"'"'OPTIONS'"'"'],
    allowedHeaders: ['"'"'Content-Type'"'"', '"'"'Authorization'"'"', '"'"'X-CSRF-Token'"'"', '"'"'X-Requested-With'"'"'],
    exposedHeaders: ['"'"'X-CSRF-Token'"'"', '"'"'X-Total-Count'"'"'],
    maxAge: 86400, // 24 hours
  });'

for SERVICE in "${SERVICES[@]}"; do
  MAIN_FILE="services/$SERVICE/src/main.ts"
  
  if [ -f "$MAIN_FILE" ]; then
    echo "Processing $SERVICE..."
    
    # Check if CORS is already configured
    if grep -q "enableCors" "$MAIN_FILE"; then
      echo "  CORS already configured in $SERVICE, skipping..."
    else
      # Add CORS after 'const configService = app.get(ConfigService);'
      sed -i "/const configService = app.get(ConfigService);/a\\
\\
$CORS_CONFIG" "$MAIN_FILE"
      
      echo "  Added CORS configuration to $SERVICE"
    fi
  else
    echo "  Warning: $MAIN_FILE not found"
  fi
done

echo "CORS configuration complete!"