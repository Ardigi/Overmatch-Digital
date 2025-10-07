# PowerShell script to insert missing methods into ControlsService

$serviceFile = "C:\Users\Ryann\Documents\Work\Coding\overmatch-digital\services\control-service\src\modules\controls\controls.service.ts"
$methodsFile = "C:\Users\Ryann\Documents\Work\Coding\overmatch-digital\services\control-service\src\modules\controls\missing-methods.ts"

# Read the current service file content
$content = Get-Content -Path $serviceFile -Raw

# Read the methods to insert
$methodsContent = Get-Content -Path $methodsFile -Raw

# Find the last closing brace position
$lastBracePos = $content.LastIndexOf("}")

if ($lastBracePos -eq -1) {
    Write-Host "Could not find the closing brace" -ForegroundColor Red
    exit 1
}

# Insert the methods before the last closing brace
$beforeBrace = $content.Substring(0, $lastBracePos)
$newContent = $beforeBrace + "`n" + $methodsContent + "`n}"

# Write the updated content back to the file
$newContent | Set-Content -Path $serviceFile

Write-Host "Successfully inserted methods into controls.service.ts" -ForegroundColor Green