# Update all Jest E2E configurations to fix duplicate mock warnings

$services = @(
    "ai-service",
    "audit-service", 
    "client-service",
    "control-service",
    "evidence-service",
    "integration-service",
    "notification-service",
    "policy-service",
    "reporting-service",
    "workflow-service"
)

$jestConfig = @'
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "../..",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  "moduleNameMapper": {
    "^@/(.*)$": "<rootDir>/src/$1"
  },
  "testTimeout": 30000,
  "moduleDirectories": ["node_modules", "src"],
  "modulePathIgnorePatterns": ["<rootDir>/dist"],
  "transformIgnorePatterns": [
    "node_modules/(?!(typeorm)/)"
  ],
  "clearMocks": true
}
'@

foreach ($service in $services) {
    $configPath = "services\$service\test\e2e\jest-e2e.json"
    if (Test-Path $configPath) {
        Write-Host "Updating $configPath..." -ForegroundColor Cyan
        Set-Content -Path $configPath -Value $jestConfig -Encoding UTF8
    } else {
        Write-Host "Warning: $configPath not found" -ForegroundColor Yellow
    }
}

Write-Host "`nAll Jest E2E configurations updated successfully!" -ForegroundColor Green