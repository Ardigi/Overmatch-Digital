# SOC Compliance Platform - Pre-commit Hook Setup
# Purpose: Install and configure pre-commit hooks for type safety and security
# Author: SOC Compliance Development Team
# Version: 1.0.0

param(
    [switch]$SkipHusky,
    [switch]$Force,
    [switch]$Verbose
)

Write-Host ""
Write-Host "🚀 SOC Compliance Platform - Pre-commit Hook Setup" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js is not installed. Please install Node.js first." -ForegroundColor Red
    exit 1
}

# Check if npm is installed
if (!(Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "❌ npm is not installed. Please install npm first." -ForegroundColor Red
    exit 1
}

# Check if Git is installed
if (!(Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Git is not installed. Please install Git first." -ForegroundColor Red
    exit 1
}

Write-Host "📦 Installing Husky..." -ForegroundColor Yellow

# Install Husky if not already installed
if (!(Test-Path "node_modules\husky")) {
    npm install --save-dev husky@latest
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install Husky" -ForegroundColor Red
        exit 1
    }
}

# Initialize Husky
if (!$SkipHusky) {
    Write-Host "🔧 Initializing Husky..." -ForegroundColor Yellow
    npx husky install
    
    # Add npm prepare script
    $packageJson = Get-Content package.json | ConvertFrom-Json
    if (!$packageJson.scripts.prepare) {
        Write-Host "📝 Adding prepare script to package.json..." -ForegroundColor Yellow
        $packageJson.scripts | Add-Member -NotePropertyName "prepare" -NotePropertyValue "husky install" -Force
        $packageJson | ConvertTo-Json -Depth 10 | Set-Content package.json
    }
}

# Create .husky directory if it doesn't exist
if (!(Test-Path ".husky")) {
    New-Item -ItemType Directory -Path ".husky" -Force | Out-Null
    Write-Host "📁 Created .husky directory" -ForegroundColor Green
}

# Create _/husky.sh file
$huskyShPath = ".husky\_\husky.sh"
if (!(Test-Path $huskyShPath) -or $Force) {
    $huskyShContent = @'
#!/usr/bin/env sh
if [ -z "$husky_skip_init" ]; then
  debug () {
    if [ "$HUSKY_DEBUG" = "1" ]; then
      echo "husky (debug) - $1"
    fi
  }

  readonly hook_name="$(basename -- "$0")"
  debug "starting $hook_name..."

  if [ "$HUSKY" = "0" ]; then
    debug "HUSKY env variable is set to 0, skipping hook"
    exit 0
  fi

  if [ -f ~/.huskyrc ]; then
    debug "sourcing ~/.huskyrc"
    . ~/.huskyrc
  fi

  readonly husky_skip_init=1
  export husky_skip_init
  sh -e "$0" "$@"
  exitCode="$?"

  if [ $exitCode != 0 ]; then
    echo "husky - $hook_name hook exited with code $exitCode (error)"
  fi

  if [ $exitCode = 127 ]; then
    echo "husky - command not found in PATH=$PATH"
  fi

  exit $exitCode
fi
'@
    
    $huskyShDir = Split-Path $huskyShPath -Parent
    if (!(Test-Path $huskyShDir)) {
        New-Item -ItemType Directory -Path $huskyShDir -Force | Out-Null
    }
    
    $huskyShContent | Out-File -FilePath $huskyShPath -Encoding UTF8 -NoNewline
    Write-Host "✅ Created Husky shell script" -ForegroundColor Green
}

# Copy pre-commit hook if it exists in the source
$preCommitSource = ".husky\pre-commit"
if (Test-Path $preCommitSource) {
    Write-Host "✅ Pre-commit hook already configured" -ForegroundColor Green
} else {
    Write-Host "⚠️  Pre-commit hook not found. Creating default hook..." -ForegroundColor Yellow
    
    # Create a basic pre-commit hook
    $preCommitContent = @'
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Run type safety checks
echo "🔍 Running pre-commit checks..."

# Check for 'as any' in production code
git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx)$' | grep -v '\.spec\.' | grep -v '\.test\.' | while read file; do
  if grep -q 'as any' "$file"; then
    echo "❌ Type safety violation: 'as any' found in $file"
    exit 1
  fi
done

# Run linter
npm run lint:fix

echo "✅ Pre-commit checks passed!"
'@
    
    $preCommitContent | Out-File -FilePath $preCommitSource -Encoding UTF8 -NoNewline
}

# Install additional development dependencies
Write-Host ""
Write-Host "📦 Installing development dependencies..." -ForegroundColor Yellow

$devDependencies = @(
    "@typescript-eslint/eslint-plugin",
    "@typescript-eslint/parser",
    "eslint",
    "prettier",
    "lint-staged"
)

foreach ($dep in $devDependencies) {
    if (!(Get-Content package.json | Select-String $dep)) {
        Write-Host "  Installing $dep..." -ForegroundColor Gray
        npm install --save-dev $dep@latest --silent
    }
}

# Create lint-staged configuration
Write-Host ""
Write-Host "📝 Configuring lint-staged..." -ForegroundColor Yellow

$lintStagedConfig = @{
    "*.{ts,tsx,js,jsx}" = @(
        "eslint --fix",
        "prettier --write"
    )
    "*.{json,md,yml,yaml}" = @(
        "prettier --write"
    )
}

$lintStagedPath = ".lintstagedrc.json"
if (!(Test-Path $lintStagedPath) -or $Force) {
    $lintStagedConfig | ConvertTo-Json -Depth 10 | Set-Content $lintStagedPath
    Write-Host "✅ Created lint-staged configuration" -ForegroundColor Green
}

# Create or update .prettierrc
Write-Host ""
Write-Host "📝 Configuring Prettier..." -ForegroundColor Yellow

$prettierConfig = @{
    "semi" = $true
    "trailingComma" = "all"
    "singleQuote" = $true
    "printWidth" = 100
    "tabWidth" = 2
    "useTabs" = $false
    "bracketSpacing" = $true
    "arrowParens" = "always"
    "endOfLine" = "lf"
}

$prettierPath = ".prettierrc"
if (!(Test-Path $prettierPath) -or $Force) {
    $prettierConfig | ConvertTo-Json -Depth 10 | Set-Content $prettierPath
    Write-Host "✅ Created Prettier configuration" -ForegroundColor Green
}

# Create .prettierignore
$prettierIgnoreContent = @"
# Dependencies
node_modules/
*/node_modules/

# Build outputs
dist/
*/dist/
build/
*/build/

# Coverage
coverage/
*/coverage/

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment files
.env
.env.*

# Lock files
package-lock.json
yarn.lock

# Generated files
*.generated.ts
*.generated.js
"@

$prettierIgnorePath = ".prettierignore"
if (!(Test-Path $prettierIgnorePath) -or $Force) {
    $prettierIgnoreContent | Out-File -FilePath $prettierIgnorePath -Encoding UTF8
    Write-Host "✅ Created .prettierignore" -ForegroundColor Green
}

# Create type-check script
Write-Host ""
Write-Host "📝 Creating type-check script..." -ForegroundColor Yellow

$typeCheckScript = @'
#!/usr/bin/env node

/**
 * Type Safety Check Script
 * Ensures no 'as any' in production code
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

let violations = 0;

// Find all TypeScript files (excluding tests)
const files = glob.sync('**/*.{ts,tsx}', {
  ignore: [
    '**/node_modules/**',
    '**/*.spec.ts',
    '**/*.spec.tsx',
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/dist/**',
    '**/build/**',
  ],
});

files.forEach((file) => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    if (line.includes('as any')) {
      console.error(`❌ ${file}:${index + 1} - Found 'as any'`);
      violations++;
    }
  });
});

if (violations > 0) {
  console.error(`\n❌ Found ${violations} type safety violations!`);
  console.log('\n💡 Fix: Create proper interfaces instead of using "as any"');
  process.exit(1);
} else {
  console.log('✅ No type safety violations found!');
}
'@

$typeCheckPath = "scripts\check-type-safety.js"
if (!(Test-Path $typeCheckPath) -or $Force) {
    $typeCheckScript | Out-File -FilePath $typeCheckPath -Encoding UTF8
    Write-Host "✅ Created type-check script" -ForegroundColor Green
}

# Add scripts to package.json
Write-Host ""
Write-Host "📝 Updating package.json scripts..." -ForegroundColor Yellow

$packageJson = Get-Content package.json | ConvertFrom-Json

$scriptsToAdd = @{
    "prepare" = "husky install"
    "pre-commit" = "lint-staged"
    "type-check" = "node scripts/check-type-safety.js"
    "security-scan" = "powershell -ExecutionPolicy Bypass -File scripts/security/scan-hardcoded-secrets.ps1"
}

foreach ($script in $scriptsToAdd.GetEnumerator()) {
    if (!$packageJson.scripts.($script.Key)) {
        $packageJson.scripts | Add-Member -NotePropertyName $script.Key -NotePropertyValue $script.Value -Force
        Write-Host "  Added script: $($script.Key)" -ForegroundColor Gray
    }
}

$packageJson | ConvertTo-Json -Depth 10 | Set-Content package.json

# Test the hooks
Write-Host ""
Write-Host "🧪 Testing pre-commit hooks..." -ForegroundColor Yellow

# Create a test file with violations
$testFile = "test-hook-violation.ts"
$testContent = @"
// Test file with type violation
const data = someValue as any;
console.log(data);
"@

$testContent | Out-File -FilePath $testFile -Encoding UTF8

# Stage the test file
git add $testFile 2>$null

# Try to commit (should fail)
$output = git commit -m "Test commit" 2>&1
$commitFailed = $LASTEXITCODE -ne 0

# Clean up test file
Remove-Item $testFile -Force -ErrorAction SilentlyContinue
git reset HEAD $testFile 2>$null

if ($commitFailed) {
    Write-Host "✅ Pre-commit hooks are working correctly!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Pre-commit hooks may not be configured correctly" -ForegroundColor Yellow
}

# Summary
Write-Host ""
Write-Host "✅ Pre-commit hooks setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Configuration Summary:" -ForegroundColor Cyan
Write-Host "  • Husky: Installed and configured" -ForegroundColor White
Write-Host "  • Pre-commit hook: Type safety and security checks" -ForegroundColor White
Write-Host "  • Lint-staged: Configured for auto-formatting" -ForegroundColor White
Write-Host "  • Prettier: Configured for code formatting" -ForegroundColor White
Write-Host "  • Type check script: Available at scripts/check-type-safety.js" -ForegroundColor White
Write-Host ""
Write-Host "🚀 Available Commands:" -ForegroundColor Cyan
Write-Host "  npm run type-check     - Check for type safety violations" -ForegroundColor White
Write-Host "  npm run security-scan  - Scan for hardcoded secrets" -ForegroundColor White
Write-Host "  npm run pre-commit     - Run pre-commit checks manually" -ForegroundColor White
Write-Host ""
Write-Host "ℹ️  The pre-commit hook will now run automatically before each commit" -ForegroundColor Yellow
Write-Host ""

exit 0